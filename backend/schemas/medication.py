from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class MedicationBase(BaseModel):
    name: str = Field(..., min_length=1)
    dosage: str = Field(..., min_length=1)
    time: str = Field(..., min_length=1)
    active: bool = True
    status: str = "ativo"

class MedicationCreate(MedicationBase):
    pass

class MedicationUpdate(MedicationBase):
    pass

class MedicationRead(MedicationBase):
    id: int
    confirmed_at: Optional[datetime] = None

    class Config:
        from_attributes = True
