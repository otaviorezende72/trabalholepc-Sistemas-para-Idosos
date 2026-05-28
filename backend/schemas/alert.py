from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class AlertBase(BaseModel):
    type: str = "SOS_TRIGGERED"
    resolved: bool = False

class AlertCreate(AlertBase):
    pass

class AlertRead(AlertBase):
    id: int
    timestamp: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True
