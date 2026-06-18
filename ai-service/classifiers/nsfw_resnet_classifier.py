import cv2
import numpy as np
import os
import logging

logger = logging.getLogger(__name__)

try:
    import torch
    import torch.nn as nn
    from torchvision import models, transforms
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

class NSFWResNetClassifier:
    """NSFW检测ResNet分类器（兼容nsfw-resnet仓库）"""
    
    def __init__(self):
        self.model = None
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        self.transform = transforms.Compose([
            transforms.ToPILImage(),
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])
        
    def load_model(self, model_path='nsfw_resnet101.pth', model_type='resnet101'):
        """加载预训练的ResNet模型（支持resnet50/resnet101）"""
        if not TORCH_AVAILABLE:
            logger.warning('PyTorch不可用，无法加载ResNet模型')
            return False
            
        try:
            if model_type.lower() == 'resnet101':
                self.model = models.resnet101(pretrained=False)
                logger.info('使用ResNet101架构')
            else:
                self.model = models.resnet50(pretrained=False)
                logger.info('使用ResNet50架构')
                
            num_ftrs = self.model.fc.in_features
            self.model.fc = nn.Linear(num_ftrs, 5)
            
            if os.path.exists(model_path):
                self.model.load_state_dict(torch.load(model_path, map_location=self.device))
            else:
                logger.warning(f'模型文件不存在: {model_path}')
                return False
                
            self.model = self.model.to(self.device)
            self.model.eval()
            logger.info(f'ResNet模型加载成功，使用设备: {self.device}')
            return True
        except Exception as e:
            logger.error(f'加载ResNet模型失败: {str(e)}')
            return False
    
    def classify(self, image):
        """分类图像"""
        if not TORCH_AVAILABLE or self.model is None:
            return {'class': 'normal', 'confidence': 0.0, 'scores': {}}
        
        try:
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            input_tensor = self.transform(image_rgb).unsqueeze(0).to(self.device)
            
            with torch.no_grad():
                outputs = self.model(input_tensor)
                probabilities = torch.nn.functional.softmax(outputs, dim=1).cpu().numpy()[0]
            
            class_names = ['drawings', 'hentai', 'neutral', 'porn', 'sexy']
            scores = dict(zip(class_names, probabilities))
            
            max_idx = np.argmax(probabilities)
            result_class = class_names[max_idx]
            confidence = float(probabilities[max_idx])
            
            return {
                'class': result_class,
                'confidence': confidence,
                'scores': scores,
                'is_nsfw': result_class in ['hentai', 'porn', 'sexy']
            }
        except Exception as e:
            logger.error(f'ResNet分类失败: {str(e)}')
            return {'class': 'normal', 'confidence': 0.0, 'scores': {}}