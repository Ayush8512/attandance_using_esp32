from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.models.attendance import BLEEventCreate
from app.database import get_ble_events_collection
from app.services.face_service import get_face_encoding
from app.services.attendance_service import verify_and_mark_attendance

router = APIRouter()

@router.post("/verify-location")
async def verify_location(event: BLEEventCreate):
    ble_events_col = get_ble_events_collection()
    event_dict = event.model_dump()
    await ble_events_col.insert_one(event_dict)
    return {"status": "success", "message": "BLE event recorded"}

@router.post("/verify-face")
async def verify_face(
    student_id: str = Form(...),
    classroom_id: str = Form(...),
    photo: UploadFile = File(...)
):
    photo_bytes = await photo.read()
    try:
        encoding = await get_face_encoding(photo_bytes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    success, message, confidence = await verify_and_mark_attendance(student_id, classroom_id, encoding)
    if not success:
        raise HTTPException(status_code=400, detail={"message": message, "confidence": confidence})
    
    return {"status": "success", "message": message, "confidence": confidence}
