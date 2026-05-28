from sqlalchemy import Column, Integer, String
from backend.database import Base

class ElderSettings(Base):
    __tablename__ = "elder_settings"

    id = Column(Integer, primary_key=True, index=True)
    checkin_interval_hours = Column(Integer, default=12, nullable=False)
    emergency_contact_name = Column(String, default="Contato de Emergência", nullable=False)
    emergency_contact_phone = Column(String, default="+55 11 99999-9999", nullable=False)
    profile_summary = Column(String, default="", nullable=False)
