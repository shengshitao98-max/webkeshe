import cv2
import numpy as np
import os
import time
import uuid
import logging
from datetime import datetime
from database.local_db import LocalFrameDatabase

logger = logging.getLogger(__name__)

class LocalFrameMonitor:
    def __init__(self, video_source=0, frame_interval=0.5):
        self.video_source = video_source
        self.frame_interval = frame_interval
        self.db = LocalFrameDatabase()
        self.is_running = False
        self.current_session_id = None
        
        self.conv_kernels = {
            'edge': np.array([[-1, -1, -1], [-1, 8, -1], [-1, -1, -1]], dtype=np.float32),
            'blur': np.array([[1/9, 1/9, 1/9], [1/9, 1/9, 1/9], [1/9, 1/9, 1/9]], dtype=np.float32),
            'sharpen': np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]], dtype=np.float32),
            'sobel_x': np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], dtype=np.float32),
            'sobel_y': np.array([[-1, -2, -1], [0, 0, 0], [1, 2, 1]], dtype=np.float32),
            'laplacian': np.array([[0, 1, 0], [1, -4, 1], [0, 1, 0]], dtype=np.float32),
        }
        
        logger.info(f'LocalFrameMonitor initialized with source: {video_source}, interval: {frame_interval}s')

    def extract_conv_features(self, frame):
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        features = {}
        
        for kernel_name, kernel in self.conv_kernels.items():
            conv_result = cv2.filter2D(gray, -1, kernel)
            features[f'{kernel_name}_mean'] = float(np.mean(conv_result))
            features[f'{kernel_name}_var'] = float(np.var(conv_result))
            features[f'{kernel_name}_max'] = float(np.max(conv_result))
            features[f'{kernel_name}_min'] = float(np.min(conv_result))
        
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        features['hue_mean'] = float(np.mean(hsv[:, :, 0]))
        features['saturation_mean'] = float(np.mean(hsv[:, :, 1]))
        features['value_mean'] = float(np.mean(hsv[:, :, 2]))
        
        features['brightness'] = float(np.mean(gray))
        features['contrast'] = float(np.std(gray))
        
        hist = cv2.calcHist([gray], [0], None, [256], [0, 256])
        hist_norm = hist / hist.sum()
        entropy = -np.sum(hist_norm * np.log2(hist_norm + 1e-10))
        features['entropy'] = float(entropy)
        
        return features

    def calculate_risk_score(self, features, frame):
        risk_score = 0
        reasoning = []
        
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        skin_ranges = [
            (np.array([0, 20, 70], dtype=np.uint8), np.array([20, 255, 255], dtype=np.uint8)),
            (np.array([170, 20, 70], dtype=np.uint8), np.array([180, 255, 255], dtype=np.uint8)),
        ]
        
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        skin_pixels = 0
        for lower, upper in skin_ranges:
            mask = cv2.inRange(hsv, lower, upper)
            skin_pixels += cv2.countNonZero(mask)
        
        skin_percentage = (skin_pixels / frame.size) * 100
        
        if skin_percentage > 40:
            risk_score += 40
            reasoning.append(f"皮肤占比过高: {skin_percentage:.1f}%")
        
        if features['edge_var'] > 500:
            risk_score += 20
            reasoning.append("边缘变化剧烈")
        
        if features['brightness'] < 30 or features['brightness'] > 220:
            risk_score += 15
            reasoning.append(f"亮度异常: {features['brightness']:.1f}")
        
        if features['contrast'] < 10:
            risk_score += 10
            reasoning.append(f"对比度异常: {features['contrast']:.1f}")
        
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        blur_score = laplacian.var()
        if blur_score < 20:
            risk_score += 15
            reasoning.append(f"图像模糊: {blur_score:.1f}")
        
        if features['entropy'] > 7.5:
            risk_score += 10
            reasoning.append(f"画面过于复杂: {features['entropy']:.2f}")
        
        return min(100, risk_score), reasoning

    def start_monitoring(self, video_path=None, session_id=None):
        if self.is_running:
            logger.warning('Monitor is already running')
            return
        
        self.is_running = True
        
        if session_id:
            self.current_session_id = session_id
        else:
            self.current_session_id = str(uuid.uuid4())[:8]
        
        if video_path:
            self.db.insert_video_session(self.current_session_id, video_path)
            cap = cv2.VideoCapture(video_path)
            logger.info(f'Starting monitoring from file: {video_path}')
        else:
            self.db.insert_video_session(self.current_session_id, 'webcam')
            cap = cv2.VideoCapture(self.video_source)
            logger.info(f'Starting monitoring from webcam: {self.video_source}')
        
        if not cap.isOpened():
            logger.error(f'Cannot open video source: {video_source}')
            self.is_running = False
            return
        
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_interval_frames = int(fps * self.frame_interval)
        
        frame_index = 0
        last_process_time = time.time()
        total_frames = 0
        suspicious_count = 0
        
        temp_dir = os.path.join(os.path.dirname(__file__), '..', 'tmp', 'frames')
        os.makedirs(temp_dir, exist_ok=True)
        
        try:
            while self.is_running:
                ret, frame = cap.read()
                if not ret:
                    logger.info('End of video stream')
                    break
                
                current_time = time.time()
                elapsed = current_time - last_process_time
                
                if elapsed >= self.frame_interval:
                    features = self.extract_conv_features(frame)
                    risk_score, reasoning = self.calculate_risk_score(features, frame)
                    
                    timestamp = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000.0
                    frame_filename = f'frame_{self.current_session_id}_{frame_index}_{int(timestamp*1000)}.jpg'
                    frame_path = os.path.join(temp_dir, frame_filename)
                    
                    success, encoded = cv2.imencode('.jpg', frame)
                    if success:
                        with open(frame_path, 'wb') as f:
                            f.write(encoded.tobytes())
                    
                    feature_data = {
                        'conv_features': features,
                        'risk_score': risk_score,
                        'reasoning': reasoning,
                        'timestamp': timestamp,
                    }
                    
                    self.db.insert_frame(
                        video_id=self.current_session_id,
                        frame_index=frame_index,
                        timestamp=timestamp,
                        frame_path=frame_path,
                        features=feature_data,
                        risk_score=risk_score
                    )
                    
                    if risk_score > 50:
                        suspicious_count += 1
                        logger.info(f'Suspicious frame detected: index={frame_index}, risk={risk_score:.1f}')
                    
                    total_frames += 1
                    frame_index += 1
                    last_process_time = current_time
                    
                    if total_frames % 20 == 0:
                        logger.info(f'Processed {total_frames} frames, {suspicious_count} suspicious')
                
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    logger.info('Manual stop requested')
                    break
                
                time.sleep(0.01)
        
        except Exception as e:
            logger.error(f'Error during monitoring: {str(e)}')
        
        finally:
            cap.release()
            cv2.destroyAllWindows()
            self.is_running = False
            self.db.update_session_status(
                self.current_session_id,
                'completed',
                total_frames,
                suspicious_count
            )
            logger.info(f'Monitoring stopped. Total: {total_frames} frames, {suspicious_count} suspicious')
    
    def stop_monitoring(self):
        self.is_running = False
        logger.info('Monitoring stopped')
    
    def analyze_stored_frames(self, video_id=None):
        suspicious_frames = self.db.get_suspicious_frames(video_id)
        logger.info(f'Found {len(suspicious_frames)} suspicious frames')
        return suspicious_frames
    
    def get_session_info(self, session_id=None):
        if session_id:
            return self.db.get_video_session(session_id)
        return self.db.get_video_session(self.current_session_id)
    
    def get_all_sessions(self):
        return self.db.get_all_sessions()