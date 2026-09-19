// Fallback/demo data — shown when the backend is unreachable, so the UI
// never looks broken during a local run or a live demo without the API up.
// Replace or remove once your real /api endpoints are live (see DEPLOY_AND_USAGE.md).

// Keys match what the backend's /api/predict actually returns (see
// backend/disease_info.py "slug" field), which in turn is derived from the
// trained model's class_names.json: ["Fungal", "Healthy", "Non_Fungal"].
export const DEMO_CLASSES = ['healthy', 'non_fungal', 'fungal']

export const DISEASE_INFO = {
  healthy: {
    category: 'Healthy',
    disease: 'No disease detected',
    status: 'good',
    description: 'No signs of infection. Leaf tissue is uniformly green with no lesions or discoloration.',
    symptoms: ['Uniform green pigment', 'No lesions or spotting', 'Firm, unblemished tissue'],
    remedy: ['No treatment required', 'Continue routine monitoring'],
  },
  non_fungal: {
    category: 'Non-fungal',
    disease: 'Non-fungal leaf abnormality',
    status: 'warning',
    description:
      "The leaf doesn't match a healthy or fungal pattern — usually bacterial infection, pest damage, or a nutrient deficiency. A closer manual check is recommended.",
    symptoms: [
      'Water-soaked or discolored spotting not matching a fungal ring pattern',
      'Possible curling, yellowing, or stippling',
      'May be localized to newer or older growth',
    ],
    remedy: [
      'Inspect the plant closely to narrow down the cause',
      'If bacterial spotting is suspected, apply copper-based bactericide',
      'Isolate severely affected plants from the rest of the row',
    ],
  },
  fungal: {
    category: 'Fungal',
    disease: 'Fungal infection (early blight pattern)',
    status: 'critical',
    description:
      'Consistent with a fungal pathogen such as Alternaria or Phytophthora — irregular brown lesions with concentric rings, spreading fastest in humid conditions.',
    symptoms: [
      'Brown concentric ring lesions (target-like spots)',
      'Yellowing around lesions',
      'Lower, older leaves affected first',
    ],
    remedy: [
      'Apply fungicide within 24 hours',
      'Improve air circulation around plants',
      'Remove infected foliage from the field',
    ],
  },
}

export function getDemoPrediction() {
  const cls = DEMO_CLASSES[Math.floor(Math.random() * DEMO_CLASSES.length)]
  const severity = cls === 'healthy' ? 'none' : Math.random() > 0.5 ? 'medium' : 'low'
  const info = DISEASE_INFO[cls]
  return {
    class: cls,
    confidence: 0.86 + Math.random() * 0.12,
    severity,
    description: info.description,
    category: info.category,
    disease: info.disease,
    status: info.status,
    symptoms: info.symptoms,
    remedy: info.remedy,
    demo: true,
  }
}

export const DEMO_STATUS = {
  esp32_online: true,
  pump_online: true,
  last_dispensed: '2 hours ago',
  pump1_last_dispensed: '2 hours ago',
  pump2_last_dispensed: '1 day ago',
  detections_today: 14,
  demo: true,
}

export const DEMO_HISTORY = [
  { timestamp: '2026-09-16 08:12', class: 'fungal', confidence: 0.93, severity: 'medium', dispensed: true },
  { timestamp: '2026-09-16 06:40', class: 'healthy', confidence: 0.98, severity: 'none', dispensed: false },
  { timestamp: '2026-09-15 19:05', class: 'non_fungal', confidence: 0.88, severity: 'low', dispensed: true },
  { timestamp: '2026-09-15 14:22', class: 'healthy', confidence: 0.97, severity: 'none', dispensed: false },
  { timestamp: '2026-09-15 09:51', class: 'fungal', confidence: 0.91, severity: 'high', dispensed: true },
]
