"""
Diagnosis copy for each class the model actually outputs.

class_names.json (shipped with the model) is the source of truth for label
order: ["Fungal", "Healthy", "Non_Fungal"]. Everything below is keyed by
that exact string so a re-trained model with the same file just drops in.
"""

DISEASE_INFO = {
    "Healthy": {
        "slug": "healthy",
        "category": "Healthy",
        "disease": "No disease detected",
        "status": "good",
        "description": (
            "No signs of infection. Leaf tissue is uniformly green with no lesions, "
            "spotting, or discoloration."
        ),
        "symptoms": [
            "Uniform green pigment",
            "No lesions or spotting",
            "Firm, unblemished tissue",
        ],
        "remedy": [
            "No treatment required",
            "Continue routine monitoring",
        ],
    },
    "Fungal": {
        "slug": "fungal",
        "category": "Fungal",
        "disease": "Fungal infection (early blight pattern)",
        "status": "critical",
        "description": (
            "Consistent with a fungal pathogen such as Alternaria (early blight) or "
            "Phytophthora — irregular brown lesions, often with concentric rings, "
            "spreading fastest in humid conditions."
        ),
        "symptoms": [
            "Brown concentric ring lesions (target-like spots)",
            "Yellowing around lesions",
            "Lower, older leaves affected first",
        ],
        "remedy": [
            "Apply fungicide within 24 hours",
            "Improve air circulation around plants",
            "Remove infected foliage from the field",
        ],
    },
    "Non_Fungal": {
        "slug": "non_fungal",
        "category": "Non-fungal",
        "disease": "Non-fungal leaf abnormality",
        "status": "warning",
        "description": (
            "The leaf doesn't match a healthy or fungal pattern — this usually points to "
            "bacterial infection, pest damage, or a nutrient deficiency rather than fungus. "
            "A closer manual check is recommended before treating."
        ),
        "symptoms": [
            "Water-soaked or discolored spotting not matching a fungal ring pattern",
            "Possible curling, yellowing, or stippling",
            "May be localized to newer or older growth",
        ],
        "remedy": [
            "Inspect the plant closely to narrow down the cause",
            "If bacterial spotting is suspected, apply copper-based bactericide and avoid overhead watering",
            "Isolate severely affected plants from the rest of the row",
        ],
    },
}

# Confidence -> severity, per non-healthy class. Healthy is always "none".
def severity_for(class_name: str, confidence: float) -> str:
    if class_name == "Healthy":
        return "none"
    if confidence >= 0.92:
        return "high"
    if confidence >= 0.8:
        return "medium"
    return "low"


def build_result(class_name: str, confidence: float, demo: bool = False) -> dict:
    info = DISEASE_INFO[class_name]
    return {
        "class": info["slug"],
        "category": info["category"],
        "disease": info["disease"],
        "status": info["status"],
        "description": info["description"],
        "symptoms": info["symptoms"],
        "remedy": info["remedy"],
        "confidence": round(confidence, 4),
        "severity": severity_for(class_name, confidence),
        "demo": demo,
    }
