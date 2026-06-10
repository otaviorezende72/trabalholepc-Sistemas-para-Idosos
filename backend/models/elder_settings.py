from sqlalchemy import Column, Integer, String, Boolean, DateTime
from backend.database import Base

class ElderSettings(Base):
    __tablename__ = "elder_settings"

    id = Column(Integer, primary_key=True, index=True)
    checkin_interval_hours = Column(Integer, default=12, nullable=False)
    emergency_contact_name = Column(String, default="Contato de Emergência", nullable=False)
    emergency_contact_phone = Column(String, default="+55 11 99999-9999", nullable=False)
    profile_summary = Column(String, default="", nullable=False)
    sleep_start_night = Column(String, default="22:00", nullable=False)
    sleep_end_night = Column(String, default="07:00", nullable=False)
    sleep_start_afternoon = Column(String, default="13:30", nullable=False)
    sleep_end_afternoon = Column(String, default="15:30", nullable=False)
    is_away = Column(Boolean, default=False, nullable=False)
    away_start_time = Column(DateTime, nullable=True)
    away_end_time = Column(DateTime, nullable=True)
    elder_name = Column(String, default="Senhor", nullable=False)
    access_code = Column(String, unique=True, index=True, nullable=True)

