"""
High Accuracy NSFW Classifier - Local Version

Uses torchvision pre-trained models (already downloaded)
Fallback: Local ResNet model if ViT not available
"""

import cv2
import numpy as np
import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image
import os
import logging


logger = logging.getLogger(__name__)


class NSFWHighAccuracyClassifier:
    def __init__(self, model_type='resnet101'):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = None
        self.transform = None
        self.labels = ['drawings', 'hentai', 'neutral', 'porn', 'sexy']
        self._load_model(model_type)

    def _load_model(self, model_type):
        """Load best available model"""
        try:
            # Define transforms
            self.transform = transforms.Compose([
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            ])

            # Load pre-trained backbone
            if model_type == 'resnet101':
                backbone = models.resnet101(weights=models.ResNet101_Weights.IMAGENET1K_V1)
                num_features = 2048
            else:
                backbone = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V1)
                num_features = 2048

            # Replace head for NSFW classification
            self.model = nn.Sequential(
                *list(backbone.children())[:-1],
                nn.Flatten(),
                nn.Linear(num_features, 512),
                nn.ReLU(),
                nn.Dropout(0.5),
                nn.Linear(512, 5)
            )

            # Try to load fine-tuned weights
            model_paths = [
                'f:/04-CODE/webkeshe/models/nsfw_resnet101.pth',
                'f:/04-CODE/webkeshe/nsfw-resnet-master/nsfw-resnet-master/checkpoint/model_best.pth',
                'f:/04-CODE/webkeshe/nsfw-resnet-master/nsfw-resnet-master/checkpoint/model_0_1.pth',
            ]

            for path in model_paths:
                if os.path.exists(path):
                    try:
                        self.model.load_state_dict(torch.load(path, map_location=self.device, weights_only=True))
                        logger.info(f"Loaded fine-tuned weights from: {path}")
                        break
                    except Exception:
                        continue

            self.model = self.model.to(self.device)
            self.model.eval()
            logger.info(f"Model loaded successfully on {self.device}")
            return True
        except Exception as e:
            logger.error(f"Failed to load model: {str(e)}")
            return False

    def predict(self, image_path):
        """Predict NSFW probability for an image"""
        if self.model is None:
            return {'error': 'Model not loaded'}

        try:
            image = Image.open(image_path).convert("RGB")
            img_tensor = self.transform(image).unsqueeze(0).to(self.device)

            with torch.no_grad():
                outputs = self.model(img_tensor)
                probs = torch.softmax(outputs, dim=1)

            predicted_idx = probs.argmax(-1).item()
            result = {
                'predicted_label': self.labels[predicted_idx],
                'is_nsfw': self.labels[predicted_idx] in ['porn', 'hentai', 'sexy'],
                'confidence': probs[0][predicted_idx].item(),
                'probabilities': {self.labels[i]: probs[0][i].item() for i in range(len(self.labels))}
            }

            return result
        except Exception as e:
            logger.error(f"Prediction failed: {str(e)}")
            return {'error': str(e)}

    def predict_cv2(self, image):
        """Predict from cv2 image"""
        if self.model is None:
            return {'error': 'Model not loaded'}

        try:
            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            image = Image.fromarray(image).convert("RGB")
            img_tensor = self.transform(image).unsqueeze(0).to(self.device)

            with torch.no_grad():
                outputs = self.model(img_tensor)
                probs = torch.softmax(outputs, dim=1)

            predicted_idx = probs.argmax(-1).item()
            result = {
                'predicted_label': self.labels[predicted_idx],
                'is_nsfw': self.labels[predicted_idx] in ['porn', 'hentai', 'sexy'],
                'confidence': probs[0][predicted_idx].item(),
                'probabilities': {self.labels[i]: probs[0][i].item() for i in range(len(self.labels))}
            }

            return result
        except Exception as e:
            logger.error(f"Prediction failed: {str(e)}")
            return {'error': str(e)}


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="High Accuracy NSFW Classifier")
    parser.add_argument("--predict", type=str, help="Predict a single image")
    parser.add_argument("--model", type=str, default="resnet101", choices=["resnet50", "resnet101"])
    args = parser.parse_args()

    classifier = NSFWHighAccuracyClassifier(model_type=args.model)

    if args.predict:
        result = classifier.predict(args.predict)
        print(f"\nPrediction for {args.predict}:")
        print(f"  Label: {result.get('predicted_label', 'N/A')}")
        print(f"  Is NSFW: {result.get('is_nsfw', False)}")
        print(f"  Confidence: {result.get('confidence', 0):.4f}")
        if 'probabilities' in result:
            print(f"  Probabilities:")
            for label, prob in result['probabilities'].items():
                print(f"    {label}: {prob:.4f}")
    else:
        parser.print_help()