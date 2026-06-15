import cv2
import numpy as np
from sklearn.svm import SVC
from sklearn.preprocessing import StandardScaler
import logging
import os

logger = logging.getLogger(__name__)

try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False

class VideoContentAnalyzer:
    """基于SVM与26维特征的不良视频检测系统（参考任栋论文）"""
    
    def __init__(self):
        self.svm_classifier = None
        self.scaler = StandardScaler()
        self.face_cascade = None
        self.yolo_model = None
        self._initialize_components()
    
    def _initialize_components(self):
        """初始化分类器和检测器"""
        try:
            C = 2
            gamma = 2 ** (-4.5)
            
            self.svm_classifier = SVC(
                kernel='rbf',
                C=C,
                gamma=gamma,
                probability=True,
                class_weight='balanced'
            )
            logger.info(f'SVM分类器初始化完成（C={C}, gamma={gamma:.4f}, RBF核）')
            
            self.face_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            )
            logger.info('人脸检测器初始化完成（AdaBoost）')
            
            if YOLO_AVAILABLE:
                try:
                    self.yolo_model = YOLO('yolov8n.pt')
                    logger.info('YOLO模型加载成功')
                except Exception as e:
                    logger.error(f'YOLO加载失败: {str(e)}')
                    self.yolo_model = None
            else:
                logger.info('YOLO不可用，仅使用SVM检测')
                
        except Exception as e:
            logger.error(f'初始化失败: {str(e)}')
    
    def _detect_skin(self, image):
        """检测肤色区域，返回肤色掩码（YCbCr+HSV双模式）"""
        ycbcr = cv2.cvtColor(image, cv2.COLOR_BGR2YCrCb)
        lower_skin = np.array([0, 133, 77], dtype=np.uint8)
        upper_skin = np.array([255, 173, 127], dtype=np.uint8)
        skin_mask_ycbcr = cv2.inRange(ycbcr, lower_skin, upper_skin)
        
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        lower_hsv = np.array([0, 20, 40], dtype=np.uint8)
        upper_hsv = np.array([25, 255, 255], dtype=np.uint8)
        skin_mask_hsv = cv2.inRange(hsv, lower_hsv, upper_hsv)
        
        combined_mask = cv2.bitwise_or(skin_mask_ycbcr, skin_mask_hsv)
        
        return combined_mask
    
    def _detect_faces(self, image):
        """检测人脸区域（使用AdaBoost）"""
        if self.face_cascade is None:
            return []
        
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        faces = self.face_cascade.detectMultiScale(
            gray, 
            scaleFactor=1.1, 
            minNeighbors=5, 
            minSize=(30, 30)
        )
        return faces
    
    def _remove_face_regions(self, skin_mask, faces):
        """从肤色掩码中去除人脸区域"""
        for (x, y, w, h) in faces:
            skin_mask[y:y+h, x:x+w] = 0
        return skin_mask
    
    def _texture_validation(self, image, skin_mask):
        """通过纹理信息验证肤色区域，排除粗糙区域"""
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        sobel_x = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
        sobel_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
        edge_magnitude = np.sqrt(sobel_x**2 + sobel_y**2)
        
        skin_edge_sum = np.sum(edge_magnitude[skin_mask > 0])
        skin_pixels = np.sum(skin_mask > 0)
        
        if skin_pixels > 0:
            avg_edge = skin_edge_sum / skin_pixels
            if avg_edge > 15:
                kernel = np.ones((3, 3), np.uint8)
                skin_mask = cv2.morphologyEx(skin_mask, cv2.MORPH_OPEN, kernel, iterations=2)
        
        return skin_mask
    
    def _morphological_processing(self, skin_mask):
        """形态学处理：排除小块区域，填补孔洞"""
        kernel = np.ones((5, 5), np.uint8)
        
        skin_mask = cv2.morphologyEx(skin_mask, cv2.MORPH_OPEN, kernel, iterations=2)
        skin_mask = cv2.morphologyEx(skin_mask, cv2.MORPH_CLOSE, kernel, iterations=2)
        
        num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(skin_mask, connectivity=8)
        min_area = 500
        
        for i in range(1, num_labels):
            if stats[i, cv2.CC_STAT_AREA] < min_area:
                skin_mask[labels == i] = 0
        
        return skin_mask
    
    def _extract_26d_features(self, image, skin_mask):
        """提取26维特征向量（基于论文）"""
        features = []
        total_pixels = image.shape[0] * image.shape[1]
        skin_pixels = np.sum(skin_mask > 0)
        
        if skin_pixels == 0:
            return [0.0] * 26
        
        skin_ratio = skin_pixels / total_pixels
        features.append(skin_ratio)
        
        num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(skin_mask, connectivity=8)
        
        if num_labels > 1:
            max_area = np.max(stats[1:, cv2.CC_STAT_AREA])
            features.append(max_area / total_pixels)
            features.append(max_area / skin_pixels)
            features.append(min(num_labels - 1, 50) / 50.0)
        else:
            features.extend([0.0, 0.0, 0.0])
        
        if num_labels > 1:
            max_label = np.argmax(stats[1:, cv2.CC_STAT_AREA]) + 1
            max_region = (labels == max_label).astype(np.uint8) * 255
            
            contours, _ = cv2.findContours(max_region, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if contours:
                cnt = contours[0]
                
                if len(cnt) >= 5:
                    ellipse = cv2.fitEllipse(cnt)
                    major_axis = max(ellipse[1][0], ellipse[1][1])
                    minor_axis = min(ellipse[1][0], ellipse[1][1])
                    eccentricity = minor_axis / (major_axis + 1e-5)
                else:
                    eccentricity = 1.0
                features.append(eccentricity)
                
                perimeter = cv2.arcLength(cnt, True)
                area = cv2.contourArea(cnt)
                compactness = perimeter / (np.sqrt(area) + 1e-5)
                features.append(min(compactness / 50.0, 1.0))
                
                x, y, w, h = cv2.boundingRect(cnt)
                rect_area = w * h
                area_ratio = area / rect_area
                features.append(area_ratio)
                
                inner_mask = np.zeros_like(max_region)
                cv2.drawContours(inner_mask, contours, 0, 255, -1)
                hole_area = np.sum(max_region > 0) - np.sum(inner_mask > 0)
                hole_ratio = hole_area / (np.sum(max_region > 0) + 1e-5)
                features.append(hole_ratio)
            else:
                features.extend([1.0, 0.0, 0.0, 0.0])
        else:
            features.extend([1.0, 0.0, 0.0, 0.0])
        
        moments = cv2.moments(skin_mask)
        hu_moments = cv2.HuMoments(moments)
        hu_moments = -np.sign(hu_moments) * np.log10(np.abs(hu_moments) + 1e-10)
        features.extend(hu_moments.flatten().tolist())
        
        b, g, r = cv2.split(image)
        skin_b = b[skin_mask > 0]
        skin_g = g[skin_mask > 0]
        skin_r = r[skin_mask > 0]
        
        for channel in [skin_r, skin_g, skin_b]:
            if len(channel) > 0:
                mean = np.mean(channel) / 255.0
                var = np.var(channel) / (255.0 ** 2)
                std = np.std(channel) / 255.0 if len(channel) > 1 else 0.0
                features.extend([mean, var, std])
            else:
                features.extend([0.0, 0.0, 0.0])
        
        return features[:26]
    
    def _detect_periodic_motion(self, frames, fps=30):
        """检测镜头内的周期运动模式"""
        if len(frames) < 10:
            return 0.0
        
        motion_scores = []
        frame_interval = max(2, fps // 15)
        
        for i in range(len(frames) - frame_interval):
            frame1 = cv2.cvtColor(frames[i], cv2.COLOR_BGR2GRAY)
            frame2 = cv2.cvtColor(frames[i + frame_interval], cv2.COLOR_BGR2GRAY)
            
            frame1 = cv2.resize(frame1, (128, 128))
            frame2 = cv2.resize(frame2, (128, 128))
            
            diff = cv2.absdiff(frame1, frame2)
            motion_energy = np.sum(diff) / (128 * 128 * 255)
            motion_scores.append(motion_energy)
        
        if not motion_scores:
            return 0.0
        
        motion_std = np.std(motion_scores)
        motion_mean = np.mean(motion_scores)
        
        if motion_mean < 0.01:
            return 0.0
        
        return min(motion_std / motion_mean, 2.0) / 2.0
    
    def _yolo_detection(self, image):
        """YOLO目标检测 - 仅检测危险物体，不包括人脸"""
        if not YOLO_AVAILABLE or self.yolo_model is None:
            return {'objects': [], 'risk_score': 0}
        
        try:
            detections = self.yolo_model(image, verbose=False)
            detected_objects = []
            risk_score = 0
            
            sensitive_classes = {
                'knife': 35, 'gun': 45, 
                'fire': 25, 'scissors': 30, 'axe': 40, 'hammer': 30,
                'bottle': 15, 'cup': 10, 'fork': 15
            }
            
            for det in detections:
                for box in det.boxes:
                    cls_name = det.names[int(box.cls[0])]
                    confidence = float(box.conf[0])
                    
                    if confidence > 0.5:
                        detected_objects.append({
                            'name': cls_name,
                            'confidence': confidence
                        })
                        
                        if cls_name in sensitive_classes:
                            risk_score += sensitive_classes[cls_name] * 0.5
            
            return {
                'objects': detected_objects,
                'risk_score': min(risk_score, 30)
            }
        except Exception as e:
            logger.error(f'YOLO检测失败: {str(e)}')
            return {'objects': [], 'risk_score': 0}
    
    def analyze_frame(self, image):
        """分析单帧图像 - SVM为主，YOLO为辅"""
        reasoning = []
        
        skin_mask = self._detect_skin(image)
        faces = self._detect_faces(image)
        skin_mask = self._remove_face_regions(skin_mask, faces)
        skin_mask = self._texture_validation(image, skin_mask)
        skin_mask = self._morphological_processing(skin_mask)
        
        features = self._extract_26d_features(image, skin_mask)
        skin_ratio = features[0]
        
        reasoning.append(f'肤色占比: {skin_ratio:.2%}')
        reasoning.append(f'人脸数量: {len(faces)}')
        
        svm_score = self._classify_features(features) * 90
        reasoning.append(f'SVM评分: {svm_score:.1f}')
        
        yolo_result = self._yolo_detection(image)
        yolo_score = yolo_result['risk_score']
        
        if yolo_result['objects']:
            reasoning.append(f'YOLO检测到: {[obj["name"] for obj in yolo_result["objects"]]}')
        
        final_score = svm_score + yolo_score
        final_score = min(final_score, 100)
        
        result_class = 'normal'
        if final_score > 70:
            result_class = 'violation'
            reasoning.append('判定为违规')
        elif final_score > 40:
            result_class = 'suspicious'
            reasoning.append('判定为可疑')
        
        return {
            'risk_score': final_score,
            'class': result_class,
            'reasoning': reasoning,
            'objects': yolo_result['objects'],
            'skin_ratio': skin_ratio,
            'svm_score': svm_score,
            'yolo_score': yolo_score
        }
    
    def _classify_features(self, features):
        """使用SVM或规则进行分类"""
        try:
            if self.svm_classifier is not None:
                features_scaled = self.scaler.fit_transform([features])
                prob = self.svm_classifier.predict_proba(features_scaled)[0]
                return prob[1] if len(prob) > 1 else 0.5
        except:
            pass
        
        return self._rule_based_score(features)
    
    def _rule_based_score(self, features):
        """基于规则的评分 - 裸体检测"""
        score = 0.0
        skin_ratio = features[0]
        
        if skin_ratio > 0.35:
            score += 0.55
            if skin_ratio > 0.45:
                score += 0.25
            if skin_ratio > 0.55:
                score += 0.15
        elif skin_ratio > 0.2:
            score += 0.35
        elif skin_ratio > 0.12:
            score += 0.15
        
        if skin_ratio > 0.15:
            compactness = features[5]
            if compactness < 0.4:
                score += 0.2
            
            eccentricity = features[4]
            if eccentricity > 0.6:
                score += 0.15
        
        return min(score, 1.0)
    
    def analyze_shot(self, frames, fps=30):
        """分析单个镜头（基于论文的完整流程）"""
        if not frames or len(frames) < 3:
            return {
                'risk_score': 0,
                'class': 'normal',
                'reasoning': ['帧数量不足']
            }
        
        reasoning = []
        frame_results = []
        sensitive_count = 0
        
        for frame in frames:
            result = self.analyze_frame(frame)
            frame_results.append(result)
            if result['class'] != 'normal':
                sensitive_count += 1
        
        avg_score = np.mean([r['risk_score'] for r in frame_results])
        max_score = np.max([r['risk_score'] for r in frame_results])
        
        sensitive_ratio = sensitive_count / len(frames)
        periodicity = self._detect_periodic_motion(frames, fps)
        
        reasoning.append(f'分析帧数: {len(frames)}')
        reasoning.append(f'平均帧评分: {avg_score:.1f}')
        reasoning.append(f'最高帧评分: {max_score:.1f}')
        reasoning.append(f'敏感帧比例: {sensitive_ratio:.1%}')
        reasoning.append(f'周期性指数: {periodicity:.2f}')
        
        final_score = avg_score * 0.5 + max_score * 0.4
        
        if sensitive_ratio > 0.15:
            extra = (sensitive_ratio - 0.15) * 80
            final_score += min(extra, 35)
            reasoning.append(f'敏感帧比例{sensitive_ratio:.1%}，加{min(extra, 35):.0f}分')
        
        if periodicity > 0.2:
            if avg_score > 10:
                extra = periodicity * 50
                final_score += min(extra, 40)
                reasoning.append(f'检测到周期性运动模式，加{min(extra, 40):.0f}分')
            else:
                extra = periodicity * 30
                final_score += min(extra, 25)
                reasoning.append(f'检测到周期性运动，加{min(extra, 25):.0f}分')
        
        final_score = min(final_score, 100)
        
        result_class = 'normal'
        if final_score > 70:
            result_class = 'violation'
        elif final_score > 40:
            result_class = 'suspicious'
        
        return {
            'risk_score': final_score,
            'class': result_class,
            'reasoning': reasoning,
            'periodicity': periodicity,
            'sensitive_ratio': sensitive_ratio
        }
    
    def classify_images(self, image_paths):
        """批量分类图像"""
        all_results = []
        
        for image_path in image_paths:
            try:
                image = self._read_image(image_path)
                if image is None:
                    result = {
                        'risk_score': 0,
                        'class': 'normal',
                        'reasoning': ['无法读取图像'],
                        'imagePath': image_path
                    }
                else:
                    result = self.analyze_frame(image)
                    result['imagePath'] = image_path
                
                all_results.append(result)
            except Exception as e:
                logger.error(f'分析图像失败 {image_path}: {str(e)}')
                all_results.append({
                    'risk_score': 0,
                    'class': 'normal',
                    'reasoning': [f'分析失败: {str(e)}'],
                    'imagePath': image_path
                })
        
        return all_results
    
    def _read_image(self, image_path):
        """读取图像（支持中文路径）"""
        try:
            image_data = np.fromfile(image_path, dtype=np.uint8)
            image = cv2.imdecode(image_data, cv2.IMREAD_COLOR)
            return image
        except Exception as e:
            logger.error(f'读取图像失败 {image_path}: {str(e)}')
            return None