from sqlalchemy import Column, Integer, String, Boolean, DateTime
from backend.database import Base

class Medication(Base):
    __tablename__ = "medications"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    dosage = Column(String, nullable=False)
    time = Column(String, nullable=False)  # ex: "08:00" ou "12/12h"
    active = Column(Boolean, default=True, nullable=False)
    status = Column(String, default="ativo", nullable=False)  # "ativo" ou "tomado"
    confirmed_at = Column(DateTime, nullable=True)
