from pydantic import BaseModel

class StudentCreate(BaseModel):
    name: str
    roll_no: str
    ble_uuid: str

class StudentResponse(BaseModel):
    id: str
    name: str
    roll_no: str
    ble_uuid: str
    created_at: str
