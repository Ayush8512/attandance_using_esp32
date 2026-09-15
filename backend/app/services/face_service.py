"""
Face encoding and matching service.
Uses face_recognition (dlib) when available, falls back to PIL-based mock for testing.
"""
import numpy as np
from PIL import Image
import io
import hashlib
from typing import List, Tuple

# Try importing face_recognition (requires dlib, which is hard to install on Windows)
try:
    import face_recognition
    USE_REAL_FR = True
    print("[OK] face_recognition loaded - using real face matching")
except ImportError:
    USE_REAL_FR = False
    print("[WARN] face_recognition not available - using MOCK face matching (for testing only)")


async def get_face_encoding(file_bytes: bytes) -> List[float]:
    """Extract 128-d face encoding from image bytes.
    
    Real mode: Uses dlib via face_recognition library.
    Mock mode: Generates a deterministic encoding from image hash (for testing).
    """
    if USE_REAL_FR:
        image = face_recognition.load_image_file(io.BytesIO(file_bytes))
        encodings = face_recognition.face_encodings(image)
        if not encodings:
            raise ValueError("No face detected in the uploaded image. Please try again with a clearer photo.")
        return encodings[0].tolist()
    else:
        # Mock mode: verify it's a valid image, then generate deterministic encoding
        try:
            img = Image.open(io.BytesIO(file_bytes))
            img.verify()  # Verify it's actually an image
        except Exception:
            raise ValueError("Invalid image file uploaded.")
        
        # Generate a deterministic 128-d encoding from image content hash
        # Same image → same encoding (useful for testing register + verify flow)
        img_hash = hashlib.sha256(file_bytes).digest()
        rng = np.random.RandomState(int.from_bytes(img_hash[:4], 'big'))
        encoding = rng.randn(128).tolist()
        return encoding


def compare_faces(known_encoding: List[float], unknown_encoding: List[float], threshold: float = 0.6) -> Tuple[bool, float]:
    """Compare two face encodings. Returns (is_match, confidence_score).
    
    Uses Euclidean distance between 128-d vectors.
    Distance <= threshold means match.
    Confidence is normalized to 0-1 range.
    """
    known = np.array(known_encoding)
    unknown = np.array(unknown_encoding)
    distance = float(np.linalg.norm(known - unknown))
    confidence = max(0.0, min(1.0, 1.0 - (distance / 1.5)))  # Normalize to 0-1
    is_match = distance <= threshold
    return is_match, round(confidence, 4)
