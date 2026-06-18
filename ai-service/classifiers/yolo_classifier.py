import cv2
import numpy as np
import torch
import torch.nn as nn
from torchvision import models, transforms
from enum import Enum
from typing import Dict, List, Tuple, Optional, Any
import logging
import os
import pickle


logger = logging.getLogger(__name__)


class DetectionResult(Enum):
    NORMAL = 'normal'
    SUSPICIOUS = 'suspicious'
    VIOLATION = 'violation'


class Config:
    SKIN_LOWER_YCBCR = np.array([0, 133, 77], dtype=np.uint8)
    SKIN_UPPER_YCBCR = np.array([255, 173, 127], dtype=np.uint8)
    SKIN_LOWER_HSV = np.array([0, 20, 40], dtype=np.uint8)
    SKIN_UPPER_HSV = np.array([25, 255, 255], dtype=np.uint8)

    BLOOD_LOWER_HSV1 = np.array([0, 80, 80])
    BLOOD_UPPER_HSV1 = np.array([8, 255, 255])
    BLOOD_LOWER_HSV2 = np.array([172, 80, 80])
    BLOOD_UPPER_HSV2 = np.array([180, 255, 255])

    YOLO_LOCAL_PATHS = [
        'yolov8n.pt',
        '/models/yolov8n.pt',
        'f:/04-CODE/webkeshe/models/yolov8n.pt',
    ]

    SENSITIVE_CLASSES: Dict[str, int] = {
        'knife': 35, 'gun': 45, 'fire': 25, 'scissors': 30,
        'axe': 40, 'hammer': 30, 'bottle': 15, 'cup': 10, 'fork': 15
    }

    THRESHOLD_VIOLATION = 70
    THRESHOLD_SUSPICIOUS = 40
    THRESHOLD_SKIN_HIGH = 0.3
    THRESHOLD_SKIN_LOW = 0.1
    THRESHOLD_BREAST = 0.02
    THRESHOLD_BLOOD = 0.03


class FeatureExtractor:
    def __init__(self, model_name='resnet50'):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.transform = transforms.Compose([
            transforms.ToPILImage(),
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])

        if model_name == 'resnet101':
            self.model = models.resnet101(weights=models.ResNet101_Weights.IMAGENET1K_V1)
            self.feature_dim = 2048
        else:
            self.model = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V1)
            self.feature_dim = 2048

        self.model = nn.Sequential(*list(self.model.children())[:-1])
        for param in self.model.parameters():
            param.requires_grad = False
        self.model = self.model.to(self.device).eval()

    def extract(self, image):
        try:
            img_tensor = self.transform(image).unsqueeze(0).to(self.device)
            with torch.no_grad():
                features = self.model(img_tensor)
            return features.cpu().numpy().flatten()
        except Exception as e:
            logger.error(f'Feature extraction failed: {str(e)}')
            return np.zeros(self.feature_dim)


class SkinDetector:
    @staticmethod
    def detect(image):
        ycbcr = cv2.cvtColor(image, cv2.COLOR_BGR2YCrCb)
        mask_ycbcr = cv2.inRange(ycbcr, Config.SKIN_LOWER_YCBCR, Config.SKIN_UPPER_YCBCR)

        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        mask_hsv = cv2.inRange(hsv, Config.SKIN_LOWER_HSV, Config.SKIN_UPPER_HSV)

        return cv2.bitwise_or(mask_ycbcr, mask_hsv)

    @staticmethod
    def clean_mask(mask, image):
        kernel = np.ones((5, 5), np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=2)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)

        num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
        min_area = 500
        for i in range(1, num_labels):
            if stats[i, cv2.CC_STAT_AREA] < min_area:
                mask[labels == i] = 0

        return mask

    @staticmethod
    def remove_faces(mask, image):
        cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))

        for (x, y, w, h) in faces:
            mask[y:y+h, x:x+w] = 0

        return mask, len(faces)


class BloodDetector:
    @staticmethod
    def detect(image):
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

        mask1 = cv2.inRange(hsv, Config.BLOOD_LOWER_HSV1, Config.BLOOD_UPPER_HSV1)
        mask2 = cv2.inRange(hsv, Config.BLOOD_LOWER_HSV2, Config.BLOOD_UPPER_HSV2)
        blood_mask = cv2.bitwise_or(mask1, mask2)

        kernel = np.ones((5, 5), np.uint8)
        blood_mask = cv2.morphologyEx(blood_mask, cv2.MORPH_OPEN, kernel, iterations=2)
        blood_mask = cv2.morphologyEx(blood_mask, cv2.MORPH_CLOSE, kernel, iterations=2)

        total_pixels = image.shape[0] * image.shape[1]
        blood_pixels = np.sum(blood_mask > 0)
        blood_ratio = blood_pixels / total_pixels if total_pixels > 0 else 0

        is_blood = False
        fractal_dim = 0.0

        if blood_pixels > 500:
            contours, _ = cv2.findContours(blood_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if contours:
                largest = max(contours, key=cv2.contourArea)
                fractal_dim = BloodDetector._fractal_dimension(largest)
                contour_area = cv2.contourArea(largest)
                
                avg_saturation = np.mean(hsv[blood_mask > 0, 1])
                avg_value = np.mean(hsv[blood_mask > 0, 2])
                
                is_blood = (blood_ratio > 0.05 and 
                           contour_area > 1000 and 
                           fractal_dim > 1.4 and
                           avg_saturation > 150 and
                           avg_value > 100)

        return {
            'blood_ratio': blood_ratio,
            'fractal_dimension': fractal_dim,
            'is_blood': is_blood,
            'mask': blood_mask
        }

    @staticmethod
    def _fractal_dimension(contour):
        try:
            perimeter = cv2.arcLength(contour, True)
            area = cv2.contourArea(contour)
            if area <= 0 or perimeter <= 0:
                return 0.0

            box = cv2.minAreaRect(contour)
            max_dim = max(box[1])
            if max_dim < 10:
                return 1.0

            dimension = (4 * np.pi * area) / (perimeter ** 2 + 1e-10)
            dimension = 2 - np.log(dimension) / np.log(max_dim / 10)
            return max(1.0, min(2.0, dimension))
        except Exception:
            return 0.0


class YOLODetector:
    def __init__(self):
        self.model = None
        self._load_model()

    def _load_model(self):
        try:
            from ultralytics import YOLO
            for path in Config.YOLO_LOCAL_PATHS:
                if os.path.exists(path):
                    self.model = YOLO(path)
                    logger.info(f'YOLO loaded: {path}')
                    return

            self.model = YOLO('yolov8n.pt')
            logger.info('YOLO loaded from network')
        except Exception as e:
            logger.warning(f'YOLO not available: {str(e)}')

    def detect(self, image):
        if self.model is None:
            return {'objects': [], 'risk_score': 0}

        try:
            detections = self.model(image, verbose=False)
            objects = []
            risk_score = 0

            for det in detections:
                for box in det.boxes:
                    cls_name = det.names[int(box.cls[0])]
                    confidence = float(box.conf[0])
                    if confidence > 0.5:
                        objects.append({'name': cls_name, 'confidence': confidence})
                        if cls_name in Config.SENSITIVE_CLASSES:
                            risk_score += Config.SENSITIVE_CLASSES[cls_name] * 0.5

            return {'objects': objects, 'risk_score': min(risk_score, 30)}
        except Exception as e:
            logger.error(f'YOLO detection failed: {str(e)}')
            return {'objects': [], 'risk_score': 0}


class VideoContentAnalyzer:
    def __init__(self):
        self.feature_extractor = FeatureExtractor()
        self.skin_detector = SkinDetector()
        self.blood_detector = BloodDetector()
        self.yolo_detector = YOLODetector()
        self.high_acc_classifier = None
        self.svm_classifier = None
        self._load_high_acc_classifier()

    def _load_high_acc_classifier(self):
        try:
            from .nsfw_vit import NSFWViTClassifier
            self.high_acc_classifier = NSFWViTClassifier()
            logger.info('ViT-Large NSFW classifier loaded')
        except Exception as e:
            logger.warning(f'ViT classifier not available: {str(e)}')
            try:
                from .nsfw_high_acc import NSFWHighAccuracyClassifier
                self.high_acc_classifier = NSFWHighAccuracyClassifier(model_type='resnet101')
                logger.info('Fallback: ResNet101 classifier loaded')
            except Exception as e2:
                logger.warning(f'High accuracy classifier not available: {str(e2)}')

    def _high_acc_score(self, image):
        if self.high_acc_classifier is None:
            return 0

        try:
            result = self.high_acc_classifier.predict_cv2(image)
            if result.get('is_nsfw', False):
                confidence = result.get('confidence', 0)
                if confidence < 0.8:
                    return 0
                elif confidence < 0.9:
                    return confidence * 80
                return confidence * 95
            return 0
        except Exception:
            return 0

    def analyze_frame(self, image):
        result = {
            'risk_score': 0,
            'class': DetectionResult.NORMAL.value,
            'reasoning': [],
            'objects': [],
            'faces': 0,
            'skin_ratio': 0,
            'resnet_score': 0,
            'yolo_score': 0,
            'blood_score': 0,
            'blood_ratio': 0,
            'has_breast': False,
            'breast_ratio': 0,
            'human_ratio': 0
        }

        skin_mask = self.skin_detector.detect(image)
        skin_mask, face_count = self.skin_detector.remove_faces(skin_mask, image)
        skin_mask = self.skin_detector.clean_mask(skin_mask, image)

        total_pixels = image.shape[0] * image.shape[1]
        skin_pixels = np.sum(skin_mask > 0)
        skin_ratio = skin_pixels / total_pixels if total_pixels > 0 else 0

        breast_result = self._detect_breast(image, skin_mask)

        yolo_result = self.yolo_detector.detect(image)
        blood_result = self.blood_detector.detect(image)
        high_acc_score = self._high_acc_score(image)

        features = self._extract_features(image, skin_mask)
        features.extend([float(breast_result['has_breast']), breast_result['breast_ratio'], skin_ratio])

        svm_score = self._classify_features(features) * 90
        blood_score = self._calculate_blood_score(blood_result)

        breast_bonus = 15 if breast_result['has_breast'] and skin_ratio > Config.THRESHOLD_SKIN_LOW else 0
        
        if self.high_acc_classifier is not None:
            if blood_score > 0:
                final_score = high_acc_score * 0.35 + yolo_result['risk_score'] * 0.1 + blood_score * 0.3 + breast_bonus + svm_score * 0.15
            else:
                final_score = high_acc_score * 0.5 + yolo_result['risk_score'] * 0.15 + blood_score * 0.1 + breast_bonus + svm_score * 0.15
        else:
            final_score = svm_score * 0.4 + yolo_result['risk_score'] * 0.25 + blood_score * 0.2 + breast_bonus
        final_score = min(final_score, 100)

        result.update({
            'risk_score': final_score,
            'class': self._determine_class(final_score),
            'objects': yolo_result['objects'],
            'faces': face_count,
            'skin_ratio': skin_ratio,
            'resnet_score': high_acc_score,
            'yolo_score': yolo_result['risk_score'],
            'blood_score': blood_score,
            'blood_ratio': blood_result['blood_ratio'],
            'is_blood': blood_result['is_blood'],
            'has_breast': breast_result['has_breast'],
            'breast_ratio': breast_result['breast_ratio'],
            'human_ratio': skin_ratio,
            'vit_score': high_acc_score
        })

        return result

    def _detect_breast(self, image, skin_mask):
        b, g, r = cv2.split(image)
        r_minus_g = cv2.subtract(r, g)
        r_minus_b = cv2.subtract(r, b)
        combined = cv2.addWeighted(r_minus_g, 0.5, r_minus_b, 0.5, 0)
        _, breast_mask = cv2.threshold(combined, 20, 255, cv2.THRESH_BINARY)
        breast_mask = cv2.bitwise_and(breast_mask, breast_mask, mask=skin_mask)

        kernel = np.ones((3, 3), np.uint8)
        breast_mask = cv2.morphologyEx(breast_mask, cv2.MORPH_OPEN, kernel, iterations=2)
        breast_mask = cv2.morphologyEx(breast_mask, cv2.MORPH_CLOSE, kernel, iterations=2)

        num_labels, _, stats, _ = cv2.connectedComponentsWithStats(breast_mask, connectivity=8)
        valid = sum(1 for i in range(1, num_labels) if 100 < stats[i, cv2.CC_STAT_AREA] < 5000)

        breast_pixels = np.sum(breast_mask > 0)
        skin_pixels = np.sum(skin_mask > 0)
        breast_ratio = breast_pixels / max(skin_pixels, 1)
        has_breast = breast_ratio > 0.02 and valid >= 1

        return {'has_breast': has_breast, 'breast_ratio': breast_ratio}

    def _extract_features(self, image, skin_mask):
        features = []
        total_pixels = image.shape[0] * image.shape[1]
        skin_pixels = np.sum(skin_mask > 0)

        if skin_pixels == 0:
            return [0.0] * 26

        features.append(skin_pixels / total_pixels)

        num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(skin_mask, connectivity=8)
        if num_labels > 1:
            areas = stats[1:, cv2.CC_STAT_AREA]
            features.append(np.max(areas) / total_pixels)
            features.append(np.max(areas) / skin_pixels)
            features.append(min(num_labels - 1, 50) / 50.0)
        else:
            features.extend([0.0, 0.0, 0.0])

        moments = cv2.moments(skin_mask)
        hu_moments = cv2.HuMoments(moments)
        hu_moments = -np.sign(hu_moments) * np.log10(np.abs(hu_moments) + 1e-10)
        features.extend(hu_moments.flatten().tolist())

        b, g, r = cv2.split(image)
        for channel in [r[skin_mask > 0], g[skin_mask > 0], b[skin_mask > 0]]:
            if len(channel) > 0:
                features.extend([np.mean(channel) / 255.0, np.var(channel) / (255.0 ** 2), np.std(channel) / 255.0])
            else:
                features.extend([0.0, 0.0, 0.0])

        return features

    def _classify_features(self, features):
        if hasattr(self, 'svm_classifier') and self.svm_classifier is not None:
            try:
                import numpy as np
                features_array = np.array(features).reshape(1, -1)
                return self.svm_classifier.predict_proba(features_array)[0][1]
            except Exception:
                return self._rule_based_score(features)
        return self._rule_based_score(features)

    def _rule_based_score(self, features):
        if len(features) == 0:
            return 0.0

        skin_ratio = features[0]
        score = 0.0

        if skin_ratio > 0.5:
            score += 0.45
            if skin_ratio > 0.6:
                score += 0.25
            if skin_ratio > 0.7:
                score += 0.2
        elif skin_ratio > 0.35:
            score += 0.3
        elif skin_ratio > 0.25:
            score += 0.15
        elif skin_ratio > 0.15:
            score += 0.08
        elif skin_ratio > 0.08:
            score += 0.05

        if len(features) >= 26:
            has_breast = bool(features[-3])
            breast_ratio = features[-2]
            if has_breast:
                score += 0.2
                if breast_ratio > 0.02:
                    score += 0.1

        return min(score, 1.0)

    def _calculate_blood_score(self, blood_result):
        if not blood_result.get('is_blood', False):
            return 0.0

        blood_ratio = blood_result.get('blood_ratio', 0.0)
        fractal_dim = blood_result.get('fractal_dimension', 0.0)

        base_score = min(blood_ratio * 400, 60)
        if fractal_dim > 1.4:
            base_score *= 1.6

        return min(base_score, 80)

    def _determine_class(self, score):
        if score > Config.THRESHOLD_VIOLATION:
            return DetectionResult.VIOLATION.value
        elif score > Config.THRESHOLD_SUSPICIOUS:
            return DetectionResult.SUSPICIOUS.value
        return DetectionResult.NORMAL.value

    def analyze_shot(self, frames, fps=30):
        if not frames or len(frames) < 3:
            return {'risk_score': 0, 'class': 'normal', 'reasoning': ['帧数量不足']}

        frame_results = [self.analyze_frame(frame) for frame in frames]
        sensitive_count = sum(1 for r in frame_results if r['class'] != 'normal')

        avg_score = np.mean([r['risk_score'] for r in frame_results])
        max_score = np.max([r['risk_score'] for r in frame_results])
        sensitive_ratio = sensitive_count / len(frames)

        final_score = avg_score * 0.5 + max_score * 0.4

        if sensitive_ratio > 0.15:
            final_score += min((sensitive_ratio - 0.15) * 80, 35)

        final_score = min(final_score, 100)

        result_class = 'normal'
        if final_score > 70:
            result_class = 'violation'
        elif final_score > 40:
            result_class = 'suspicious'

        return {
            'risk_score': final_score,
            'class': result_class,
            'reasoning': [
                f'分析帧数: {len(frames)}',
                f'平均评分: {avg_score:.1f}',
                f'敏感帧比例: {sensitive_ratio:.1%}'
            ],
            'periodicity': 0,
            'sensitive_ratio': sensitive_ratio
        }

    def classify_images(self, image_paths):
        results = []
        for path in image_paths:
            try:
                image_data = np.fromfile(path, dtype=np.uint8)
                image = cv2.imdecode(image_data, cv2.IMREAD_COLOR)
                if image is None:
                    result = {'risk_score': 0, 'class': 'normal', 'reasoning': ['无法读取图像']}
                else:
                    result = self.analyze_frame(image)
                result['imagePath'] = path
                results.append(result)
            except Exception as e:
                logger.error(f'分析失败 {path}: {str(e)}')
                results.append({'risk_score': 0, 'class': 'normal', 'reasoning': [f'分析失败: {str(e)}'], 'imagePath': path})
        return results
