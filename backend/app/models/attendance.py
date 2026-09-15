from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone

class BLEEventCreate(BaseModel):
    ble_uuid: str
    classroom_id: str
    rssi: int
    timestamp: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc))

class AttendanceRecord(BaseModel):
    student_id: str
    student_name: str
    classroom_id: str
    status: str
    method: str
    ble_verified: bool
    face_verified: bool
    face_confidence: float
    timestamp: datetime

class AttendanceResponse(AttendanceRecord):
    id: str
