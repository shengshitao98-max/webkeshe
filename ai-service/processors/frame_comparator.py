import numpy as np
import json
import logging
from database.local_db import LocalFrameDatabase

logger = logging.getLogger(__name__)

class FrameComparator:
    def __init__(self):
        self.db = LocalFrameDatabase()
        self.feature_weights = {
            'edge_mean': 0.1,
            'edge_var': 0.15,
            'blur_mean': 0.1,
            'sharpen_mean': 0.1,
            'sobel_x_mean': 0.1,
            'sobel_y_mean': 0.1,
            'laplacian_mean': 0.1,
            'hue_mean': 0.05,
            'saturation_mean': 0.05,
            'brightness': 0.05,
            'contrast': 0.05,
            'entropy': 0.05,
        }
    
    def compare_frames(self, features1, features2):
        distance = 0
        for feature, weight in self.feature_weights.items():
            val1 = features1.get(feature, 0)
            val2 = features2.get(feature, 0)
            if val1 != 0 or val2 != 0:
                distance += weight * abs(val1 - val2) / max(abs(val1), abs(val2), 1)
        return distance
    
    def calculate_anomaly_score(self, frame_features, baseline_features):
        if not baseline_features:
            return 0.0
        
        distances = []
        for baseline in baseline_features:
            dist = self.compare_frames(frame_features, baseline)
            distances.append(dist)
        
        avg_distance = np.mean(distances)
        std_distance = np.std(distances) if len(distances) > 1 else 0
        
        if std_distance > 0:
            anomaly_score = (avg_distance - np.min(distances)) / std_distance
        else:
            anomaly_score = avg_distance * 10
        
        return min(100, max(0, anomaly_score * 10))
    
    def build_baseline(self, video_id, sample_size=30):
        try:
            frames = self.db.get_suspicious_frames(video_id, limit=100)
            if not frames:
                logger.warning(f'No frames found for video {video_id}')
                return []
            
            features_list = []
            for frame in frames:
                try:
                    features_data = json.loads(frame['features'])
                    conv_features = features_data.get('conv_features', {})
                    if conv_features:
                        features_list.append(conv_features)
                except Exception as e:
                    logger.error(f'Error parsing features: {e}')
            
            if len(features_list) > sample_size:
                indices = np.random.choice(len(features_list), sample_size, replace=False)
                features_list = [features_list[i] for i in indices]
            
            logger.info(f'Built baseline with {len(features_list)} samples')
            return features_list
        
        except Exception as e:
            logger.error(f'Error building baseline: {e}')
            return []
    
    def detect_anomalies(self, video_id, threshold=70):
        try:
            baseline = self.build_baseline(video_id)
            if not baseline:
                logger.warning(f'Cannot build baseline for {video_id}')
                return []
            
            frames = self.db.get_suspicious_frames(video_id, limit=200)
            anomalies = []
            
            for frame in frames:
                try:
                    features_data = json.loads(frame['features'])
                    conv_features = features_data.get('conv_features', {})
                    anomaly_score = self.calculate_anomaly_score(conv_features, baseline)
                    
                    if anomaly_score > threshold:
                        anomalies.append({
                            'frame_id': frame['id'],
                            'frame_index': frame['frame_index'],
                            'timestamp': frame['timestamp'],
                            'risk_score': frame['risk_score'],
                            'anomaly_score': anomaly_score,
                            'frame_path': frame['frame_path'],
                            'features': features_data,
                        })
                
                except Exception as e:
                    logger.error(f'Error processing frame {frame.get("id")}: {e}')
            
            anomalies.sort(key=lambda x: x['anomaly_score'], reverse=True)
            logger.info(f'Detected {len(anomalies)} anomalies for {video_id}')
            return anomalies
        
        except Exception as e:
            logger.error(f'Error detecting anomalies: {e}')
            return []
    
    def compare_with_templates(self, frame_features):
        templates = self.db.get_feature_templates()
        results = []
        
        for template in templates:
            template_features = template.get('features', {})
            distance = self.compare_frames(frame_features, template_features)
            similarity = max(0, 100 - distance * 100)
            
            results.append({
                'template_name': template['template_name'],
                'similarity': similarity,
                'description': template.get('description', ''),
            })
        
        results.sort(key=lambda x: x['similarity'], reverse=True)
        return results
    
    def analyze_sequence(self, video_id, window_size=5):
        try:
            frames = self.db.get_suspicious_frames(video_id, limit=200)
            if len(frames) < window_size:
                return []
            
            frames.sort(key=lambda x: x['frame_index'])
            
            sequence_anomalies = []
            
            for i in range(len(frames) - window_size + 1):
                window = frames[i:i+window_size]
                risk_scores = [f['risk_score'] for f in window]
                avg_risk = np.mean(risk_scores)
                max_risk = np.max(risk_scores)
                risk_increase = risk_scores[-1] - risk_scores[0]
                
                if avg_risk > 60 or (risk_increase > 30 and max_risk > 70):
                    sequence_anomalies.append({
                        'start_frame': window[0]['frame_index'],
                        'end_frame': window[-1]['frame_index'],
                        'avg_risk': avg_risk,
                        'max_risk': max_risk,
                        'risk_increase': risk_increase,
                        'frames': [f['id'] for f in window],
                    })
            
            sequence_anomalies.sort(key=lambda x: x['avg_risk'], reverse=True)
            logger.info(f'Found {len(sequence_anomalies)} suspicious sequences')
            return sequence_anomalies
        
        except Exception as e:
            logger.error(f'Error analyzing sequence: {e}')
            return []
    
    def get_statistics(self, video_id):
        try:
            frames = self.db.get_suspicious_frames(video_id, limit=500)
            
            if not frames:
                return {
                    'total_frames': 0,
                    'suspicious_count': 0,
                    'avg_risk': 0,
                    'max_risk': 0,
                    'min_risk': 0,
                    'risk_distribution': {},
                }
            
            risk_scores = [f['risk_score'] for f in frames]
            
            distribution = {
                'low': sum(1 for r in risk_scores if r < 30),
                'medium': sum(1 for r in risk_scores if 30 <= r < 60),
                'high': sum(1 for r in risk_scores if r >= 60),
            }
            
            return {
                'total_frames': len(frames),
                'suspicious_count': sum(1 for f in frames if f['is_suspicious']),
                'avg_risk': np.mean(risk_scores),
                'max_risk': np.max(risk_scores),
                'min_risk': np.min(risk_scores),
                'risk_distribution': distribution,
            }
        
        except Exception as e:
            logger.error(f'Error getting statistics: {e}')
            return {}