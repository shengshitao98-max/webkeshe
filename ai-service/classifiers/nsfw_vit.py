"""
High Accuracy NSFW Classifier using ViT-Base (98% accuracy)

Models available:
- ViT-Base: 98.0% accuracy, 344MB
- ViT-Large: 99.1% accuracy, 1.2GB
- MobileNetV2Mid: 95% accuracy, 92MB

Usage:
    python nsfw_vit.py --predict image.jpg
"""

import os
import torch
from PIL import Image
from transformers import AutoModelForImageClassification, ViTImageProcessor
import logging


logger = logging.getLogger(__name__)


class NSFWViTClassifier:
    """High accuracy NSFW classifier using Vision Transformer"""

    # Available models on HuggingFace
    MODEL_OPTIONS = {
        'vit_base': 'Falconsai/nsfw_image_detection',      # 98% accuracy, 344MB
        'vit_large': 'AdamCodd/vit-base-nsfw-detector',    # High accuracy
        'mobilevit': 'Falconsai/nsfw_image_detection',     # Lightweight
    }

    def __init__(self, model_type='vit_base'):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = None
        self.processor = None
        self.model_dir = "f:/04-CODE/webkeshe/models/nsfw_vit_large"
        self._load_model()

    def _load_model(self):
        """Load model from local directory"""
        try:
            logger.info(f"Loading model from: {self.model_dir}")

            self.processor = ViTImageProcessor.from_pretrained(self.model_dir)
            self.model = AutoModelForImageClassification.from_pretrained(self.model_dir)

            self.model = self.model.to(self.device)
            self.model.eval()

            logger.info(f"Model loaded successfully on {self.device}")
            return True
        except Exception as e:
            logger.error(f"Failed to load model: {str(e)}")
            return False

    def predict(self, image_path):
        """Predict NSFW probability for an image"""
        if self.model is None or self.processor is None:
            return {'error': 'Model not loaded'}

        try:
            # Load and preprocess image
            image = Image.open(image_path).convert("RGB")
            inputs = self.processor(images=image, return_tensors="pt")
            inputs = {k: v.to(self.device) for k, v in inputs.items()}

            # Inference
            with torch.no_grad():
                outputs = self.model(**inputs)
                logits = outputs.logits
                probs = torch.softmax(logits, dim=1)

            # Get predictions
            predicted_class = logits.argmax(-1).item()
            labels = self.model.config.id2label

            result = {
                'predicted_label': labels.get(predicted_class, str(predicted_class)),
                'is_nsfw': predicted_class != 0,  # Usually 0 is normal/safe
                'confidence': probs[0][predicted_class].item(),
                'probabilities': {labels.get(i, str(i)): probs[0][i].item() for i in range(len(labels))}
            }

            return result
        except Exception as e:
            logger.error(f"Prediction failed: {str(e)}")
            return {'error': str(e)}

    def predict_cv2(self, image):
        """Predict NSFW probability from cv2 image (BGR format)"""
        if self.model is None or self.processor is None:
            return {'error': 'Model not loaded'}

        try:
            import cv2
            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            image = Image.fromarray(image).convert("RGB")
            inputs = self.processor(images=image, return_tensors="pt")
            inputs = {k: v.to(self.device) for k, v in inputs.items()}

            with torch.no_grad():
                outputs = self.model(**inputs)
                logits = outputs.logits
                probs = torch.softmax(logits, dim=1)

            predicted_class = logits.argmax(-1).item()
            labels = self.model.config.id2label

            is_nsfw = predicted_class != 0
            result = {
                'predicted_label': labels.get(predicted_class, str(predicted_class)),
                'is_nsfw': is_nsfw,
                'confidence': probs[0][predicted_class].item(),
                'probabilities': {labels.get(i, str(i)): probs[0][i].item() for i in range(len(labels))}
            }

            return result
        except Exception as e:
            logger.error(f"Prediction failed: {str(e)}")
            return {'error': str(e)}

    def batch_predict(self, image_paths, batch_size=32):
        """Batch prediction for multiple images"""
        if self.model is None or self.processor is None:
            return [{'error': 'Model not loaded'} for _ in image_paths]

        results = []

        for i in range(0, len(image_paths), batch_size):
            batch_paths = image_paths[i:i+batch_size]
            batch_images = []

            for path in batch_paths:
                try:
                    img = Image.open(path).convert("RGB")
                    batch_images.append(img)
                except Exception:
                    batch_images.append(None)

            # Filter valid images
            valid_indices = [j for j, img in enumerate(batch_images) if img is not None]
            valid_images = [batch_images[j] for j in valid_indices]

            if not valid_images:
                results.extend([{'error': 'Invalid image'} for _ in batch_paths])
                continue

            # Process batch
            inputs = self.processor(images=valid_images, return_tensors="pt")
            inputs = {k: v.to(self.device) for k, v in inputs.items()}

            with torch.no_grad():
                outputs = self.model(**inputs)
                logits = outputs.logits
                probs = torch.softmax(logits, dim=1)

            predicted_classes = logits.argmax(-1).tolist()
            labels = self.model.config.id2label

            # Build results
            batch_results = []
            for j, (pred_class, prob_row) in enumerate(zip(predicted_classes, probs)):
                batch_results.append({
                    'predicted_label': labels.get(pred_class, str(pred_class)),
                    'is_nsfw': pred_class != 0,
                    'confidence': prob_row[pred_class].item(),
                    'probabilities': {labels.get(k, str(k)): prob_row[k].item() for k in range(len(labels))}
                })

            # Fill in results
            result_idx = 0
            for j in range(len(batch_paths)):
                if j in valid_indices:
                    results.append(batch_results[result_idx])
                    result_idx += 1
                else:
                    results.append({'error': 'Invalid image'})

        return results


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="High Accuracy NSFW Classifier (ViT)")
    parser.add_argument("--predict", type=str, help="Predict a single image")
    parser.add_argument("--batch", type=str, nargs="+", help="Batch predict images")
    parser.add_argument("--model", type=str, default="vit_base", choices=["vit_base", "vit_large", "mobilevit"])
    args = parser.parse_args()

    classifier = NSFWViTClassifier(model_type=args.model)

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

    elif args.batch:
        results = classifier.batch_predict(args.batch)
        for path, result in zip(args.batch, results):
            print(f"\n{path}:")
            print(f"  Label: {result.get('predicted_label', 'N/A')}")
            print(f"  Is NSFW: {result.get('is_nsfw', False)}")

    else:
        parser.print_help()