from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.database import get_students_collection
from app.services.face_service import get_face_encoding
from datetime import datetime, timezone

router = APIRouter()

@router.post("/register")
async def register_student(
    name: str = Form(...),
    roll_no: str = Form(...),
    ble_uuid: str = Form(...),
    photo: UploadFile = File(...)
):
    students_col = get_students_collection()
    existing = await students_col.find_one({"roll_no": roll_no})
    if existing:
        raise HTTPException(status_code=400, detail="Student with this roll number already exists.")

    photo_bytes = await photo.read()
    try:
        encoding = await get_face_encoding(photo_bytes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    student_doc = {
        "name": name,
        "roll_no": roll_no,
        "ble_uuid": ble_uuid,
        "face_encoding": encoding,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    result = await students_col.insert_one(student_doc)
    return {"student_id": str(result.inserted_id)}
