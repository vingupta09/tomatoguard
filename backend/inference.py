"""
Loads the ONNX model once at process start and exposes a single
predict(image_bytes) -> (class_name, confidence) function.

The model is a Vision Transformer (from Hugging Face) that was converted to ONNX and
shrunk with int8 quantization (~90 MB), so it runs with the small `onnxruntime`
package instead of torch / transformers. That keeps it inside Render's free-tier
512 MB RAM limit.

The ViT predicts 10 detailed classes. This file groups them into the 3 classes the
rest of the app already uses (see disease_info.py): "Fungal", "Healthy", "Non_Fungal".
predict() still returns exactly the same thing as before: (class_name, confidence).
"""
import io
import json
import os

import numpy as np
from PIL import Image
import onnxruntime as ort

MODEL_DIR = os.path.join(os.path.dirname(__file__), "model")
MODEL_PATH = os.path.join(MODEL_DIR, "model_int8.onnx")
CONFIG_PATH = os.path.join(MODEL_DIR, "config.json")                  # has the 10 class names
PREPROCESS_PATH = os.path.join(MODEL_DIR, "preprocessor_config.json")  # image size, mean, std

# The 3 classes the app uses, in a fixed order.
CATEGORIES = ["Fungal", "Healthy", "Non_Fungal"]

# Words in the model's class names that mean "this is a fungal disease".
# Anything else that is not healthy (bacteria, viruses, spider mites) is Non_Fungal.
FUNGAL_WORDS = ("leaf mold", "target spot", "late blight", "early blight", "septoria")


def _category_for(label: str) -> str:
    text = label.lower()
    if "healthy" in text:
        return "Healthy"
    if any(word in text for word in FUNGAL_WORDS):
        return "Fungal"
    return "Non_Fungal"


with open(CONFIG_PATH, encoding="utf-8") as f:
    _id2label = json.load(f)["id2label"]  # {"0": "A healthy tomato leaf", "1": "...", ...}

# category of each of the model's outputs, in output order
_OUTPUT_CATEGORY = [_category_for(_id2label[str(i)]) for i in range(len(_id2label))]
if "Healthy" not in _OUTPUT_CATEGORY:
    raise RuntimeError("No 'healthy' class found in config.json, so the class names do not look right")

with open(PREPROCESS_PATH, encoding="utf-8") as f:
    _pre = json.load(f)
_HEIGHT = int(_pre["size"]["height"])  # 224
_WIDTH = int(_pre["size"]["width"])
_MEAN = np.array(_pre["image_mean"], dtype=np.float32).reshape(1, 1, 3)  # 0.5
_STD = np.array(_pre["image_std"], dtype=np.float32).reshape(1, 1, 3)    # 0.5

_opts = ort.SessionOptions()
_opts.intra_op_num_threads = 1  # small instance: keep memory and CPU use low
_session = ort.InferenceSession(MODEL_PATH, sess_options=_opts, providers=["CPUExecutionProvider"])
_input_name = _session.get_inputs()[0].name

if _session.get_outputs()[0].shape[-1] != len(_OUTPUT_CATEGORY):
    raise RuntimeError("The model output size does not match the class names in config.json")


def preprocess(image_bytes: bytes) -> np.ndarray:
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize((_WIDTH, _HEIGHT), Image.BILINEAR)
    arr = np.asarray(img, dtype=np.float32) / 255.0   # this model wants 0-1 ...
    arr = (arr - _MEAN) / _STD                         # ... then (x - 0.5) / 0.5
    arr = np.transpose(arr, (2, 0, 1))                 # HWC -> CHW
    return np.expand_dims(arr, axis=0).astype(np.float32)


def predict(image_bytes: bytes):
    """Returns (class_name, confidence) for the given image bytes.
    class_name is one of "Fungal", "Healthy", "Non_Fungal".
    confidence is the total probability of that group (e.g. early blight + late blight
    + leaf mold ... all add up into "Fungal")."""
    x = preprocess(image_bytes)
    logits = _session.run(None, {_input_name: x})[0][0]
    exp = np.exp(logits - logits.max())
    probs = exp / exp.sum()

    totals = {c: 0.0 for c in CATEGORIES}
    for p, cat in zip(probs, _OUTPUT_CATEGORY):
        totals[cat] += float(p)

    best = max(totals, key=totals.get)
    return best, totals[best]