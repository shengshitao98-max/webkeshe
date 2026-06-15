import cv2
import numpy as np
from pathlib import Path
import logging
import base64
import requests
import json
import os

logger = logging.getLogger(__name__)

try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

class ImageClassifier:
    """Image classification for content moderation with detailed reasoning"""
    
    def __init__(self):
        self.classes = ['normal', 'pornographic', 'violent', 'suggestive']
        
        self.skin_ranges = [
            (np.array([0, 20, 70], dtype=np.uint8), np.array([20, 255, 255], dtype=np.uint8)),
            (np.array([170, 20, 70], dtype=np.uint8), np.array([180, 255, 255], dtype=np.uint8)),
        ]
        
        self.blood_ranges = [
            (np.array([0, 50, 50], dtype=np.uint8), np.array([10, 255, 255], dtype=np.uint8)),
            (np.array([170, 50, 50], dtype=np.uint8), np.array([180, 255, 255], dtype=np.uint8)),
            (np.array([0, 30, 30], dtype=np.uint8), np.array([15, 200, 200], dtype=np.uint8)),
            (np.array([165, 30, 30], dtype=np.uint8), np.array([180, 200, 200], dtype=np.uint8)),
        ]
        
        self.kimi_api_key = os.getenv('MOONSHOT_API_KEY', 'sk-nljtNtZFb2fLV6owohfycEFu8dF1034vxav4UKtDZCmISxvo')
        
        if OPENAI_AVAILABLE:
            self.kimi_client = openai.Client(
                base_url="https://api.moonshot.cn/v1",
                api_key=self.kimi_api_key,
            )
            logger.info('Kimi API configured with OpenAI SDK')
        else:
            self.kimi_client = None
            logger.warning('OpenAI SDK not available, falling back to requests')
        
        logger.info('ImageClassifier initialized with enhanced detection and Kimi multimodal support')
    
    def _read_image_with_chinese_path(self, image_path):
        """Read image file with support for Chinese characters in path"""
        try:
            import numpy as np
            image_data = np.fromfile(image_path, dtype=np.uint8)
            image = cv2.imdecode(image_data, cv2.IMREAD_COLOR)
            return image
        except Exception as e:
            logger.error(f'Failed to read image with Chinese path: {str(e)}')
            return None
    
    def classify_images(self, image_paths, use_kimi=True):
        results = []
        
        for image_path in image_paths:
            try:
                image = self._read_image_with_chinese_path(image_path)
                if image is None:
                    logger.warning(f'Failed to read image: {image_path}')
                    continue
                
                if use_kimi:
                    classification = self._classify_with_kimi(image_path)
                else:
                    classification = self._classify_image(image, image_path)
                
                results.append(classification)
            except Exception as e:
                logger.error(f'Error classifying image {image_path}: {str(e)}')
                try:
                    image = self._read_image_with_chinese_path(image_path)
                    if image is not None:
                        classification = self._classify_image(image, image_path)
                        classification['reasoning'].append("Kimi API调用失败，使用本地算法")
                        results.append(classification)
                except Exception as fallback_e:
                    logger.error(f'Fallback classification also failed: {str(fallback_e)}')
        
        return results
    
    def _classify_with_kimi(self, image_path):
        try:
            with open(image_path, 'rb') as f:
                image_base64 = base64.b64encode(f.read()).decode('utf-8')
            
            if self.kimi_client:
                response = self.kimi_client.chat.completions.create(
                    model="kimi-k2.6",
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "text",
                                    "text": "请分析这张图片，判断是否包含以下敏感内容，并给出风险评分（0-100）：\n\n需要检测的内容类型：\n1. 暴力血腥：是否有血迹、伤口、武器、打斗等暴力元素\n2. 色情低俗：是否有裸露身体、性暗示等内容\n3. 正常内容：无敏感内容\n\n请按照以下JSON格式输出结果：\n{\n  \"class\": \"normal\" | \"pornographic\" | \"violent\" | \"suggestive\",\n  \"riskScore\": 0-100,\n  \"confidence\": 0-1,\n  \"reasoning\": [\"原因1\", \"原因2\", ...]\n}\n\n请详细分析图片内容并给出具体的判断依据。"
                                },
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:image/jpeg;base64,{image_base64}"
                                    }
                                }
                            ]
                        }
                    ],
                    stream=False,
                )
                content = response.choices[0].message.content.strip()
            else:
                headers = {
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {self.kimi_api_key}'
                }
                
                payload = {
                    "model": "kimi-k2.6",
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "text",
                                    "text": "请分析这张图片，判断是否包含以下敏感内容，并给出风险评分（0-100）：\n\n需要检测的内容类型：\n1. 暴力血腥：是否有血迹、伤口、武器、打斗等暴力元素\n2. 色情低俗：是否有裸露身体、性暗示等内容\n3. 正常内容：无敏感内容\n\n请按照以下JSON格式输出结果：\n{\n  \"class\": \"normal\" | \"pornographic\" | \"violent\" | \"suggestive\",\n  \"riskScore\": 0-100,\n  \"confidence\": 0-1,\n  \"reasoning\": [\"原因1\", \"原因2\", ...]\n}\n\n请详细分析图片内容并给出具体的判断依据。"
                                },
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:image/jpeg;base64,{image_base64}"
                                    }
                                }
                            ]
                        }
                    ]
                }
                
                response = requests.post("https://api.moonshot.cn/v1/chat/completions", headers=headers, json=payload, timeout=30)
                response.raise_for_status()
                
                data = response.json()
                content = data['choices'][0]['message']['content'].strip()
            
            try:
                cleaned_content = content.strip()
                if cleaned_content.startswith('```json'):
                    cleaned_content = cleaned_content[7:]
                if cleaned_content.endswith('```'):
                    cleaned_content = cleaned_content[:-3]
                cleaned_content = cleaned_content.strip()
                
                result = json.loads(cleaned_content)
                logger.info(f"Kimi API classification result: {result}")
                return result
            except json.JSONDecodeError:
                logger.warning(f"Kimi API returned non-JSON response: {content[:200]}")
                return self._fallback_classification(content)
        
        except Exception as e:
            logger.error(f"Error calling Kimi API: {str(e)}")
            image = self._read_image_with_chinese_path(image_path)
            if image is not None:
                return self._classify_image(image, image_path)
            return {
                'class': 'normal',
                'riskScore': 0.0,
                'confidence': 0.5,
                'reasoning': ['Kimi API调用失败'],
                'metrics': {}
            }
    
    def _fallback_classification(self, text):
        risk_score = 0
        class_label = 'normal'
        reasoning = []
        
        if '暴力' in text or '血腥' in text or '打斗' in text or '武器' in text:
            risk_score += 40
            class_label = 'violent'
            reasoning.append("Kimi检测到暴力血腥内容")
        
        if '色情' in text or '裸露' in text or '低俗' in text:
            risk_score += 40
            class_label = 'pornographic'
            reasoning.append("Kimi检测到色情低俗内容")
        
        if '性暗示' in text:
            risk_score += 20
            if class_label == 'normal':
                class_label = 'suggestive'
            reasoning.append("Kimi检测到性暗示内容")
        
        if '正常' in text and risk_score == 0:
            reasoning.append("Kimi判定为正常内容")
        
        return {
            'class': class_label,
            'riskScore': float(min(100, risk_score)),
            'confidence': 0.7,
            'reasoning': reasoning,
            'metrics': {}
        }
    
    def _classify_image(self, image, image_path):
        height, width = image.shape[:2]
        total_pixels = height * width
        
        reasoning = []
        risk_score = 0
        class_label = 'normal'
        
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        skin_pixels = 0
        for lower, upper in self.skin_ranges:
            mask = cv2.inRange(hsv, lower, upper)
            skin_pixels += cv2.countNonZero(mask)
        
        blood_pixels = 0
        for lower, upper in self.blood_ranges:
            mask = cv2.inRange(hsv, lower, upper)
            blood_pixels += cv2.countNonZero(mask)
        
        skin_percentage = (skin_pixels / total_pixels) * 100
        blood_percentage = (blood_pixels / total_pixels) * 100
        
        face_detected, face_count = self.detect_faces(image_path)
        
        edge_density = self._calculate_edge_density(image)
        chaos_score = self._calculate_chaos(gray)
        
        violence_detected = False
        
        if blood_percentage > 15:
            risk_score += 5
            reasoning.append(f"检测到红色区域: {blood_percentage:.1f}% (可能为血液)")
            violence_detected = False
            
            if blood_percentage > 25:
                risk_score += 8
                reasoning.append(f"红色区域占比较高: {blood_percentage:.1f}% (高度怀疑血腥内容)")
                violence_detected = True
                
                if blood_percentage > 35:
                    risk_score += 8
                    reasoning.append(f"红色区域占比极高: {blood_percentage:.1f}% (强烈怀疑血腥暴力内容)")
        
        if edge_density > 0.3:
            risk_score += 3
            reasoning.append(f"边缘密度较高: {edge_density:.3f} (可能存在激烈动作)")
            violence_detected = False
            
            if edge_density > 0.42:
                risk_score += 3
                reasoning.append(f"边缘密度极高: {edge_density:.3f} (强烈怀疑暴力冲突)")
                violence_detected = True
        
        if chaos_score > 0.82:
            risk_score += 2
            reasoning.append(f"画面混乱度较高: {chaos_score:.2f} (可能存在暴力冲突)")
            violence_detected = False
            
            if chaos_score > 0.92:
                risk_score += 2
                reasoning.append(f"画面混乱度极高: {chaos_score:.2f} (强烈怀疑暴力冲突)")
                violence_detected = True
        
        dark_percentage = self._calculate_dark_percentage(image)
        if dark_percentage > 93:
            risk_score += 2
            reasoning.append(f"画面暗区占比过高: {dark_percentage:.1f}% (可能为夜间暴力场景)")
            violence_detected = False
        
        color_contrast = self._calculate_color_contrast(image)
        if color_contrast > 95:
            risk_score += 2
            reasoning.append(f"色彩对比度极高: {color_contrast:.1f} (可能存在强烈视觉冲击)")
        
        if violence_detected:
            class_label = 'violent'
            reasoning.append("综合判定：存在暴力内容特征")
        
        if not violence_detected:
            if skin_percentage > 55:
                risk_score += 25
                reasoning.append(f"皮肤占比过高: {skin_percentage:.1f}% (超过55%)")
                class_label = 'pornographic'
                
                if face_count == 0:
                    risk_score += 10
                    reasoning.append("未检测到人脸，可能存在不当构图")
            
            elif skin_percentage > 40:
                risk_score += 12
                reasoning.append(f"皮肤占比较高: {skin_percentage:.1f}% (40%-55%)")
                
                if face_count >= 2:
                    risk_score += 6
                    reasoning.append(f"检测到{face_count}张人脸，可能存在多人场景")
                elif face_count == 0:
                    risk_score += 3
                    reasoning.append("未检测到人脸")
                
                if skin_percentage > 45:
                    class_label = 'suggestive'
                    risk_score += 6
                    reasoning.append("皮肤占比接近高风险阈值")
            
            elif skin_percentage > 20:
                risk_score += 3
                reasoning.append(f"皮肤占比正常偏高: {skin_percentage:.1f}%")
                
                if face_count == 1:
                    reasoning.append("检测到1张人脸，构图正常")
            
            else:
                reasoning.append(f"皮肤占比正常: {skin_percentage:.1f}%")
                if face_count > 0:
                    reasoning.append(f"检测到{face_count}张人脸")
        
        blur_score = self._calculate_blur(image)
        if blur_score > 70:
            risk_score += 5
            reasoning.append(f"图像模糊度较高: {blur_score:.1f}% (可能为故意模糊)")
        
        color_saturation = self._calculate_saturation(hsv)
        if color_saturation > 92:
            risk_score += 3
            reasoning.append(f"色彩饱和度较高: {color_saturation:.1f}%")
        elif color_saturation < 12:
            risk_score += 3
            reasoning.append(f"色彩饱和度较低: {color_saturation:.1f}% (可能为低质量内容)")
        
        if risk_score == 0:
            reasoning.append("图像分析正常，未检测到敏感内容")
        
        risk_score = min(100, max(0, risk_score))
        
        return {
            'class': class_label,
            'riskScore': float(risk_score),
            'confidence': float(min(0.95, 0.5 + (risk_score / 200))),
            'reasoning': reasoning,
            'metrics': {
                'skinPercentage': round(skin_percentage, 1),
                'bloodPercentage': round(blood_percentage, 1),
                'faceCount': face_count,
                'blurScore': round(blur_score, 1),
                'colorSaturation': round(color_saturation, 1),
                'edgeDensity': round(edge_density, 3),
                'chaosScore': round(chaos_score, 2),
            }
        }
    
    def _calculate_blur(self, image):
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        variance = float(laplacian.var())
        
        if variance > 100:
            return 10.0
        elif variance > 50:
            return 25.0
        elif variance > 20:
            return 40.0
        else:
            return float(60 + (20 - variance) / 20 * 40)
    
    def _calculate_saturation(self, hsv):
        saturation_channel = hsv[:, :, 1]
        avg_saturation = float(np.mean(saturation_channel) / 2.55)
        return avg_saturation
    
    def _calculate_edge_density(self, image):
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 50, 150)
        edge_pixels = cv2.countNonZero(edges)
        total_pixels = edges.size
        return edge_pixels / total_pixels
    
    def _calculate_chaos(self, gray):
        hist = cv2.calcHist([gray], [0], None, [256], [0, 256])
        hist_norm = hist / hist.sum()
        entropy = float(-np.sum(hist_norm * np.log2(hist_norm + 1e-10)) / 8)
        return entropy
    
    def _calculate_dark_percentage(self, image):
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        dark_pixels = cv2.countNonZero(cv2.inRange(gray, 0, 50))
        total_pixels = gray.size
        return (dark_pixels / total_pixels) * 100
    
    def _calculate_color_contrast(self, image):
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        l_channel = lab[:, :, 0]
        contrast = float((np.max(l_channel) - np.min(l_channel)) / 2.55)
        return contrast
    
    def detect_faces(self, image_path):
        face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
        
        image = cv2.imread(image_path)
        if image is None:
            return False, 0
        
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, 1.3, 5)
        
        return len(faces) > 0, len(faces)