from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from backend.database import get_db
from backend.models.alert import Alert
from backend.schemas.alert import AlertRead, AlertCreate
from backend.websockets.manager import manager

router = APIRouter(prefix="/alerts", tags=["alerts"])

@router.get("", response_model=List[AlertRead])
def get_alerts(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    # Retorna os alertas mais recentes primeiro
    return db.query(Alert).order_by(Alert.timestamp.desc()).offset(skip).limit(limit).all()

@router.post("", response_model=AlertRead, status_code=status.HTTP_201_CREATED)
async def create_alert(payload: AlertCreate, db: Session = Depends(get_db)):
    alert = Alert(type=payload.type, resolved=payload.resolved)
    db.add(alert)
    db.commit()
    db.refresh(alert)
    
    # Broadcast em tempo real para os WebSockets do tipo "mobile"
    event = {
        "event": "SOS_TRIGGERED",
        "data": {
            "alert_id": alert.id,
            "timestamp": alert.timestamp.isoformat(),
            "type": alert.type
        }
    }
    await manager.broadcast_to_type("mobile", event)
    
    return alert

@router.put("/{alert_id}/resolve", response_model=AlertRead)
def resolve_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alerta não encontrado")
    
    alert.resolved = True
    alert.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(alert)
    return alert
