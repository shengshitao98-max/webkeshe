import sqlite3
import os
import json
from datetime import datetime
from pathlib import Path

class LocalFrameDatabase:
    def __init__(self, db_path=None):
        if db_path is None:
            db_path = os.path.join(os.path.dirname(__file__), 'frames.db')
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS frame_data (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    video_id TEXT NOT NULL,
                    frame_index INTEGER NOT NULL,
                    timestamp REAL NOT NULL,
                    frame_path TEXT NOT NULL,
                    features BLOB NOT NULL,
                    risk_score REAL DEFAULT 0,
                    is_suspicious INTEGER DEFAULT 0,
                    uploaded INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(video_id, frame_index)
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS video_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    video_id TEXT NOT NULL UNIQUE,
                    video_path TEXT NOT NULL,
                    status TEXT DEFAULT 'processing',
                    total_frames INTEGER DEFAULT 0,
                    suspicious_count INTEGER DEFAULT 0,
                    uploaded_count INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS feature_templates (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    template_name TEXT NOT NULL UNIQUE,
                    description TEXT,
                    features BLOB NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_frame_video ON frame_data(video_id)
            ''')
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_frame_suspicious ON frame_data(is_suspicious)
            ''')
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_frame_uploaded ON frame_data(uploaded)
            ''')
            
            conn.commit()

    def insert_frame(self, video_id, frame_index, timestamp, frame_path, features, risk_score=0):
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT OR REPLACE INTO frame_data
                    (video_id, frame_index, timestamp, frame_path, features, risk_score, is_suspicious)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (video_id, frame_index, timestamp, frame_path, 
                      json.dumps(features).encode('utf-8'), risk_score, 
                      1 if risk_score > 50 else 0))
                conn.commit()
                return True
        except Exception as e:
            print(f"Error inserting frame: {e}")
            return False

    def insert_video_session(self, video_id, video_path):
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT OR REPLACE INTO video_sessions
                    (video_id, video_path, status, created_at, updated_at)
                    VALUES (?, ?, 'processing', ?, ?)
                ''', (video_id, video_path, datetime.now(), datetime.now()))
                conn.commit()
                return True
        except Exception as e:
            print(f"Error inserting video session: {e}")
            return False

    def update_session_status(self, video_id, status, total_frames=None, suspicious_count=None):
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                updates = ['status = ?', 'updated_at = ?']
                params = [status, datetime.now()]
                
                if total_frames is not None:
                    updates.append('total_frames = ?')
                    params.append(total_frames)
                if suspicious_count is not None:
                    updates.append('suspicious_count = ?')
                    params.append(suspicious_count)
                
                params.append(video_id)
                cursor.execute(f'''
                    UPDATE video_sessions SET {', '.join(updates)} WHERE video_id = ?
                ''', params)
                conn.commit()
                return True
        except Exception as e:
            print(f"Error updating session: {e}")
            return False

    def get_suspicious_frames(self, video_id=None, limit=100):
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                query = '''
                    SELECT * FROM frame_data 
                    WHERE is_suspicious = 1 AND uploaded = 0
                '''
                params = []
                
                if video_id:
                    query += ' AND video_id = ?'
                    params.append(video_id)
                
                query += ' ORDER BY risk_score DESC LIMIT ?'
                params.append(limit)
                
                cursor.execute(query, params)
                rows = cursor.fetchall()
                
                return [{k: row[k] for k in row.keys()} for row in rows]
        except Exception as e:
            print(f"Error getting suspicious frames: {e}")
            return []

    def mark_frame_uploaded(self, frame_id):
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    UPDATE frame_data SET uploaded = 1 WHERE id = ?
                ''', (frame_id,))
                conn.commit()
                return True
        except Exception as e:
            print(f"Error marking frame as uploaded: {e}")
            return False

    def get_frame_by_id(self, frame_id):
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute('SELECT * FROM frame_data WHERE id = ?', (frame_id,))
                row = cursor.fetchone()
                if row:
                    return {k: row[k] for k in row.keys()}
                return None
        except Exception as e:
            print(f"Error getting frame: {e}")
            return None

    def get_video_session(self, video_id):
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute('SELECT * FROM video_sessions WHERE video_id = ?', (video_id,))
                row = cursor.fetchone()
                if row:
                    return {k: row[k] for k in row.keys()}
                return None
        except Exception as e:
            print(f"Error getting video session: {e}")
            return None

    def get_all_sessions(self, status=None):
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                query = 'SELECT * FROM video_sessions'
                params = []
                
                if status:
                    query += ' WHERE status = ?'
                    params.append(status)
                
                query += ' ORDER BY created_at DESC'
                cursor.execute(query, params)
                rows = cursor.fetchall()
                
                return [{k: row[k] for k in row.keys()} for row in rows]
        except Exception as e:
            print(f"Error getting sessions: {e}")
            return []

    def add_feature_template(self, template_name, description, features):
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT OR REPLACE INTO feature_templates
                    (template_name, description, features)
                    VALUES (?, ?, ?)
                ''', (template_name, description, json.dumps(features).encode('utf-8')))
                conn.commit()
                return True
        except Exception as e:
            print(f"Error adding template: {e}")
            return False

    def get_feature_templates(self):
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute('SELECT * FROM feature_templates')
                rows = cursor.fetchall()
                
                templates = []
                for row in rows:
                    template = {k: row[k] for k in row.keys()}
                    template['features'] = json.loads(template['features'])
                    templates.append(template)
                
                return templates
        except Exception as e:
            print(f"Error getting templates: {e}")
            return []

    def clear_old_data(self, days=7):
        try:
            cutoff = datetime.now() - timedelta(days=days)
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('DELETE FROM frame_data WHERE created_at < ?', (cutoff,))
                cursor.execute('DELETE FROM video_sessions WHERE created_at < ?', (cutoff,))
                conn.commit()
                return True
        except Exception as e:
            print(f"Error clearing old data: {e}")
            return False