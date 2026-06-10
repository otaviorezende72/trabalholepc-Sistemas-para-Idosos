from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from backend.database import get_db
from backend.models.elder_settings import ElderSettings
from backend.models.user import User
from backend.utils.auth import get_current_user
from backend.websockets.manager import manager
from backend.schemas.elder_settings import ElderSettingsRead

router = APIRouter(prefix="/api/status", tags=["status"])

@router.post("/away", response_model=ElderSettingsRead)
async def set_away(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    settings = db.query(ElderSettings).filter(ElderSettings.id == current_user.elder_id).first()
    if not settings:
        settings = ElderSettings(id=current_user.elder_id)
        db.add(settings)
    
    settings.is_away = True
    settings.away_start_time = datetime.now()
    settings.away_end_time = None
    db.commit()
    db.refresh(settings)

    event = {
        "event": "STATUS_CHANGED",
        "data": {
            "is_away": True,
            "away_start_time": settings.away_start_time.isoformat() if settings.away_start_time else None,
            "away_end_time": None
        }
    }
    await manager.broadcast_to_elder(current_user.elder_id, event)
    
    return settings

@router.post("/home", response_model=ElderSettingsRead)
async def set_home(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    settings = db.query(ElderSettings).filter(ElderSettings.id == current_user.elder_id).first()
    if not settings:
        settings = ElderSettings(id=current_user.elder_id)
        db.add(settings)
    
    was_away = settings.is_away
    
    if was_away:
        settings.is_away = False
        settings.away_end_time = datetime.now()
        db.commit()
        db.refresh(settings)
        
        event = {
            "event": "STATUS_CHANGED",
            "data": {
                "is_away": False,
                "away_start_time": settings.away_start_time.isoformat() if settings.away_start_time else None,
                "away_end_time": settings.away_end_time.isoformat() if settings.away_end_time else None,
                "trigger_reconciliation": True
            }
        }
        await manager.broadcast_to_elder(current_user.elder_id, event)
    else:
        settings.is_away = False
        db.commit()
        db.refresh(settings)

    return settings
