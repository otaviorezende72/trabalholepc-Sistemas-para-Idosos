from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.elder_settings import ElderSettings
from backend.models.user import User
from backend.schemas.elder_settings import ElderSettingsRead, ElderSettingsUpdate
from backend.utils.auth import get_current_user
from backend.websockets.manager import manager

router = APIRouter(prefix="/settings", tags=["settings"])

@router.get("", response_model=ElderSettingsRead)
def get_settings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    settings = db.query(ElderSettings).filter(ElderSettings.id == current_user.elder_id).first()
    if not settings:
        settings = ElderSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
        current_user.elder_id = settings.id
        db.commit()
    return settings

@router.put("", response_model=ElderSettingsRead)
async def update_settings(payload: ElderSettingsUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    settings = db.query(ElderSettings).filter(ElderSettings.id == current_user.elder_id).first()
    if not settings:
        settings = ElderSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
        current_user.elder_id = settings.id
        db.commit()

    
    settings.checkin_interval_hours = payload.checkin_interval_hours
    settings.emergency_contact_name = payload.emergency_contact_name
    settings.emergency_contact_phone = payload.emergency_contact_phone
    settings.profile_summary = payload.profile_summary
    settings.sleep_start_night = payload.sleep_start_night
    settings.sleep_end_night = payload.sleep_end_night
    settings.sleep_start_afternoon = payload.sleep_start_afternoon
    settings.sleep_end_afternoon = payload.sleep_end_afternoon
    settings.is_away = payload.is_away
    settings.away_start_time = payload.away_start_time
    settings.away_end_time = payload.away_end_time
    settings.elder_name = payload.elder_name
    
    db.commit()
    db.refresh(settings)
    
    # Broadcast em tempo real para os WebSockets do tipo "motor"
    event = {
        "event": "CONFIG_UPDATED",
        "data": {
            "checkin_interval_hours": settings.checkin_interval_hours,
            "emergency_contact_name": settings.emergency_contact_name,
            "emergency_contact_phone": settings.emergency_contact_phone,
            "profile_summary": settings.profile_summary,
            "sleep_start_night": settings.sleep_start_night,
            "sleep_end_night": settings.sleep_end_night,
            "sleep_start_afternoon": settings.sleep_start_afternoon,
            "sleep_end_afternoon": settings.sleep_end_afternoon,
            "is_away": settings.is_away,
            "away_start_time": settings.away_start_time.isoformat() if settings.away_start_time else None,
            "away_end_time": settings.away_end_time.isoformat() if settings.away_end_time else None,
            "elder_name": settings.elder_name
        }
    }
    await manager.broadcast_to_elder(current_user.elder_id, event, client_type="motor")
    
    return settings
