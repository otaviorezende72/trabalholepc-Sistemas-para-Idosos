from pydantic import BaseModel, Field

class ElderSettingsBase(BaseModel):
    checkin_interval_hours: int = Field(default=12, ge=1, le=168)
    emergency_contact_name: str = Field(default="Contato de Emergência", min_length=1)
    emergency_contact_phone: str = Field(default="+55 11 99999-9999", min_length=1)
    profile_summary: str = Field(default="")

class ElderSettingsUpdate(ElderSettingsBase):
    pass

class ElderSettingsRead(ElderSettingsBase):
    id: int

    class Config:
        from_attributes = True
