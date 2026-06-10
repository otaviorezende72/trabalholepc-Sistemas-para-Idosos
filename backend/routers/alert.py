from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from backend.database import get_db
from backend.models.alert import Alert
from backend.models.user import User
from backend.schemas.alert import AlertRead, AlertCreate
from backend.utils.auth import get_current_user
from backend.websockets.manager import manager

router = APIRouter(prefix="/alerts", tags=["alerts"])

@router.get("", response_model=List[AlertRead])
@router.get("/api/alerts", response_model=List[AlertRead])
def list_alerts(skip: int = 0, limit: int = 50, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Alert).filter(Alert.elder_id == current_user.elder_id).order_by(Alert.timestamp.desc()).offset(skip).limit(limit).all()

@router.post("", response_model=AlertRead, status_code=status.HTTP_201_CREATED)
@router.post("/api/alerts", response_model=AlertRead, status_code=status.HTTP_201_CREATED)
async def create_alert(payload: AlertCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    alert = Alert(type=payload.type, resolved=False, elder_id=current_user.elder_id)
    db.add(alert)
    db.commit()
    db.refresh(alert)
    
    # Broadcast alert event to all mobile websockets
    event = {
        "event": "SOS_TRIGGERED" if payload.type == "SOS" else "ALERT_TRIGGERED",
        "data": {
            "alert_id": alert.id,
            "type": alert.type,
            "timestamp": alert.timestamp.isoformat()
        }
    }
    await manager.broadcast_to_elder(current_user.elder_id, event, client_type="mobile")
    
    return alert

@router.put("/{alert_id}/resolve", response_model=AlertRead)
@router.put("/api/alerts/{alert_id}/resolve", response_model=AlertRead)
def resolve_alert(alert_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    alert = db.query(Alert).filter(Alert.id == alert_id, Alert.elder_id == current_user.elder_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alerta não encontrado")
    
    alert.resolved = True
    alert.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(alert)
    return alert
