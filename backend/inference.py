"""
Loads the TFLite model once at process start and exposes a single
predict(image_bytes) -> (class_name, confidence) function.

Uses ai-edge-litert instead of full TensorFlow: the model is ~1MB and the
interpreter package is ~50-60MB installed, vs. several hundred MB for
tensorflow. That matters on Render's free tier, which caps a web service
at 512MB RAM.
"""
import io
import json
import os

import numpy as np
from PIL import Image
from ai_edge_litert.interpreter import Interpreter

MODEL_DIR = os.path.join(os.path.dirname(__file__), "model")
MODEL_PATH = os.path.join(MODEL_DIR, "tomato_mobilenetv3.tflite")
CLASS_NAMES_PATH = os.path.join(MODEL_DIR, "class_names.json")

with open(CLASS_NAMES_PATH) as f:
    CLASS_NAMES = json.load(f)  # ["Fungal", "Healthy", "Non_Fungal"]

_interpreter = Interpreter(model_path=MODEL_PATH)
_interpreter.allocate_tensors()
_input_details = _interpreter.get_input_details()[0]
_output_details = _interpreter.get_output_details()[0]
_INPUT_SIZE = _input_details["shape"][1]  # 160


def preprocess(image_bytes: bytes) -> np.ndarray:
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize((_INPUT_SIZE, _INPUT_SIZE), Image.BILINEAR)
    arr = np.asarray(img, dtype=np.float32)  # kept as raw 0-255 pixels —
    # the model has its own built-in Rescaling layer (MobileNetV3's
    # include_preprocessing=True), so do NOT divide by 255 here.
    return np.expand_dims(arr, axis=0)


def predict(image_bytes: bytes):
    """Returns (class_name, confidence) for the given image bytes."""
    x = preprocess(image_bytes)
    _interpreter.set_tensor(_input_details["index"], x)
    _interpreter.invoke()
    probs = _interpreter.get_tensor(_output_details["index"])[0]
    idx = int(np.argmax(probs))
    return CLASS_NAMES[idx], float(probs[idx])
