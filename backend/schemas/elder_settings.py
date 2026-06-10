from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class ElderSettingsBase(BaseModel):
    checkin_interval_hours: int = Field(default=12, ge=1, le=168)
    emergency_contact_name: str = Field(default="Contato de Emergência", min_length=1)
    emergency_contact_phone: str = Field(default="+55 11 99999-9999", min_length=1)
    profile_summary: str = Field(default="")
    sleep_start_night: str = Field(default="22:00")
    sleep_end_night: str = Field(default="07:00")
    sleep_start_afternoon: str = Field(default="13:30")
    sleep_end_afternoon: str = Field(default="15:30")
    is_away: bool = Field(default=False)
    away_start_time: Optional[datetime] = None
    away_end_time: Optional[datetime] = None
    elder_name: str = Field(default="Senhor")

class ElderSettingsUpdate(ElderSettingsBase):
    pass

class ElderSettingsRead(ElderSettingsBase):
    id: int

    class Config:
        from_attributes = True
