from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional
import re

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

    @field_validator('sleep_start_night', 'sleep_end_night', 'sleep_start_afternoon', 'sleep_end_afternoon')
    @classmethod
    def validate_time_format(cls, v: str) -> str:
        if not re.match(r'^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$', v):
            raise ValueError('O formato do horário de sono deve ser HH:MM (24 horas).')
        return v

class ElderSettingsUpdate(ElderSettingsBase):
    pass

class ElderSettingsRead(ElderSettingsBase):
    id: int

    class Config:
        from_attributes = True

