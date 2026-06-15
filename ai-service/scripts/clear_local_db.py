import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'database', 'frames.db')

def clear_local_database():
    try:
        if os.path.exists(DB_PATH):
            print(f'正在连接数据库: {DB_PATH}')
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            
            print('正在获取所有表...')
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
            tables = cursor.fetchall()
            
            print('正在清空所有表...')
            for table_name in tables:
                table = table_name[0]
                if table != 'sqlite_sequence':
                    cursor.execute(f'DELETE FROM {table};')
                    print(f'已清空: {table}')
            
            conn.commit()
            conn.close()
            print('\n本地数据库清空完成!')
        else:
            print(f'数据库文件不存在: {DB_PATH}')
            
    except Exception as e:
        print(f'清空本地数据库失败: {str(e)}')
        raise

if __name__ == '__main__':
    clear_local_database()