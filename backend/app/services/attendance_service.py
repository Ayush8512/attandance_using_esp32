from app.database import get_students_collection, get_attendance_collection, get_ble_events_collection
from app.services.face_service import compare_faces
from app.config import settings
from datetime import datetime, timezone, timedelta
from typing import Tuple, Optional, List
from bson import ObjectId

async def verify_and_mark_attendance(student_id: str, classroom_id: str, face_encoding: List[float]) -> Tuple[bool, str, Optional[float]]:
    """Dual verification + dedup logic"""
    students_col = get_students_collection()
    attendance_col = get_attendance_collection()
    ble_events_col = get_ble_events_collection()

    try:
        student = await students_col.find_one({"_id": ObjectId(student_id)})
    except Exception:
        return False, "Invalid student ID format", None
        
    if not student:
        return False, "Student not found", None

    is_match, confidence = compare_faces(student["face_encoding"], face_encoding, settings.face_match_threshold)
    if not is_match:
        return False, "Face mismatch", confidence

    # Check BLE
    ble_timeout = datetime.now(timezone.utc) - timedelta(minutes=settings.ble_timeout_minutes)
    ble_event = await ble_events_col.find_one({
        "ble_uuid": student["ble_uuid"],
        "classroom_id": classroom_id,
        "timestamp": {"$gte": ble_timeout}
    })

    if not ble_event:
        return False, "No recent BLE event found in this classroom", confidence

    # Check duplicate
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    duplicate = await attendance_col.find_one({
        "student_id": student_id,
        "classroom_id": classroom_id,
        "timestamp": {"$gte": today_start}
    })
    
    if duplicate:
        return False, "Attendance already marked today", confidence

    record = {
        "student_id": student_id,
        "student_name": student["name"],
        "classroom_id": classroom_id,
        "status": "PRESENT",
        "method": "BLE+FACE",
        "ble_verified": True,
        "face_verified": True,
        "face_confidence": confidence,
        "timestamp": datetime.now(timezone.utc)
    }
    await attendance_col.insert_one(record)
    return True, "Attendance marked successfully", confidence
