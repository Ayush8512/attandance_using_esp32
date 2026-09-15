from fastapi import APIRouter, Query, HTTPException
from typing import Optional, List
from app.database import get_attendance_collection, get_students_collection
from datetime import datetime, timezone
from bson import ObjectId

router = APIRouter()

def convert_objectid(doc):
    if "_id" in doc:
        doc["id"] = str(doc.pop("_id"))
    return doc

@router.get("/attendance/{student_id}")
async def get_attendance(student_id: str, date: Optional[str] = Query(None, description="YYYY-MM-DD")):
    attendance_col = get_attendance_collection()
    query = {"student_id": student_id}
    if date:
        try:
            start_date = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            end_date = start_date.replace(hour=23, minute=59, second=59)
            query["timestamp"] = {"$gte": start_date, "$lte": end_date}
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    cursor = attendance_col.find(query)
    records = await cursor.to_list(length=100)
    return [convert_objectid(r) for r in records]

@router.get("/classroom/{classroom_id}/status")
async def get_classroom_status(classroom_id: str):
    attendance_col = get_attendance_collection()
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    query = {
        "classroom_id": classroom_id,
        "timestamp": {"$gte": today_start}
    }
    cursor = attendance_col.find(query)
    records = await cursor.to_list(length=100)
    return [convert_objectid(r) for r in records]

@router.get("/students")
async def list_students():
    students_col = get_students_collection()
    cursor = students_col.find({}, {"face_encoding": 0})
    students = await cursor.to_list(length=100)
    return [convert_objectid(s) for s in students]

@router.get("/health")
async def health_check():
    return {"status": "healthy"}
