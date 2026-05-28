from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.elder_settings import ElderSettings
from backend.schemas.elder_settings import ElderSettingsRead, ElderSettingsUpdate
from backend.websockets.manager import manager

router = APIRouter(prefix="/settings", tags=["settings"])

@router.get("", response_model=ElderSettingsRead)
def get_settings(db: Session = Depends(get_db)):
    settings = db.query(ElderSettings).first()
    if not settings:
        # Inicializa configurações padrão se não existirem no BD (auto-healing)
        settings = ElderSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

@router.put("", response_model=ElderSettingsRead)
async def update_settings(payload: ElderSettingsUpdate, db: Session = Depends(get_db)):
    settings = db.query(ElderSettings).first()
    if not settings:
        settings = ElderSettings()
        db.add(settings)
    
    settings.checkin_interval_hours = payload.checkin_interval_hours
    settings.emergency_contact_name = payload.emergency_contact_name
    settings.emergency_contact_phone = payload.emergency_contact_phone
    settings.profile_summary = payload.profile_summary
    
    db.commit()
    db.refresh(settings)
    
    # Broadcast em tempo real para os WebSockets do tipo "motor"
    event = {
        "event": "CONFIG_UPDATED",
        "data": {
            "checkin_interval_hours": settings.checkin_interval_hours,
            "emergency_contact_name": settings.emergency_contact_name,
            "emergency_contact_phone": settings.emergency_contact_phone,
            "profile_summary": settings.profile_summary
        }
    }
    await manager.broadcast_to_type("motor", event)
    
    return settings
