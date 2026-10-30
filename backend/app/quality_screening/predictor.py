"""Inference adapter for SolarVision Model 2: full-cell grayscale EL only.

Checkpoint is shipped from trusted Colab training outputs. No retraining here.
"""
import json
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError
import torch
from torch import nn
from torchvision import models, transforms

MODEL_DIR = Path(__file__).resolve().parents[2] / 'models' / 'model2_elpv_v1'
MAX_IMAGE_PIXELS = 12_000_000

class InvalidCellImage(ValueError):
    pass

class Model2ScreeningPredictor:
    def __init__(self, model_dir=MODEL_DIR, device='cpu'):
        self.model_dir = Path(model_dir)
        self.device = torch.device(device)
        meta = json.loads((self.model_dir / 'model2_preprocessing.json').read_text())
        self.model_id = meta['model_id']
        self.threshold = float(meta['threshold_defective'])
        size = tuple(meta['input_size'])
        self.preprocess = transforms.Compose([
            transforms.Resize(size),
            transforms.Grayscale(num_output_channels=3),
            transforms.ToTensor(),
            transforms.Normalize(mean=meta['normalization']['mean'],
                                 std=meta['normalization']['std']),
        ])
        network = models.efficientnet_b0(weights=None)
        network.classifier[-1] = nn.Linear(network.classifier[-1].in_features, 2)
        checkpoint = torch.load(self.model_dir / 'model2_efficientnet_b0.pt',
                                map_location='cpu', weights_only=True)
        network.load_state_dict(checkpoint['model_state_dict'], strict=True)
        self.network = network.to(self.device).eval()

    @torch.inference_mode()
    def predict_bytes(self, image_data: bytes):
        try:
            with Image.open(BytesIO(image_data)) as image:
                if image.width * image.height > MAX_IMAGE_PIXELS:
                    raise InvalidCellImage('Image dimensions exceed safety limit')
                if image.width < 48 or image.height < 48:
                    raise InvalidCellImage('Image too small for screening')
                # The classifier requires an entire single-cell EL crop, not a defect bbox.
                image = ImageOps.exif_transpose(image).convert('L')
                x = self.preprocess(image).unsqueeze(0).to(self.device)
        except (UnidentifiedImageError, OSError, ValueError) as exc:
            if isinstance(exc, InvalidCellImage):
                raise
            raise InvalidCellImage('Invalid or unreadable image') from exc

        score = float(torch.softmax(self.network(x), dim=1)[0,1].item())
        label = 'defective' if score >= self.threshold else 'healthy'
        return {
            'model_id': self.model_id,
            'predicted_class': label,
            'defective_probability': round(score, 6),
            'threshold': round(self.threshold, 6),
            'requires_manual_review': True,
            'decision': 'screening_only',
            'review_status': 'pending',
            'input_scope': 'complete_single_cell_EL_image',
            'warning': ('Research screening only. Not a certified accept/reject decision, '
                        'physical severity score, or root-cause diagnosis.'),
        }
