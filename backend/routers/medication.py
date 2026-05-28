from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from typing import List
from backend.database import get_db
from backend.models.medication import Medication
from backend.schemas.medication import MedicationRead, MedicationCreate, MedicationUpdate

router = APIRouter(prefix="/medications", tags=["medications"])

@router.get("", response_model=List[MedicationRead])
def list_medications(db: Session = Depends(get_db)):
    return db.query(Medication).all()

@router.post("", response_model=MedicationRead, status_code=status.HTTP_201_CREATED)
def create_medication(payload: MedicationCreate, db: Session = Depends(get_db)):
    med = Medication(
        name=payload.name,
        dosage=payload.dosage,
        time=payload.time,
        active=payload.active
    )
    db.add(med)
    db.commit()
    db.refresh(med)
    return med

@router.put("/{medication_id}", response_model=MedicationRead)
def update_medication(medication_id: int, payload: MedicationUpdate, db: Session = Depends(get_db)):
    med = db.query(Medication).filter(Medication.id == medication_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medicamento não encontrado")
    
    med.name = payload.name
    med.dosage = payload.dosage
    med.time = payload.time
    med.active = payload.active
    
    db.commit()
    db.refresh(med)
    return med

@router.delete("/{medication_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_medication(medication_id: int, db: Session = Depends(get_db)):
    med = db.query(Medication).filter(Medication.id == medication_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medicamento não encontrado")
    
    db.delete(med)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.put("/{medication_id}/confirm", response_model=MedicationRead)
async def confirm_medication(medication_id: int, db: Session = Depends(get_db)):
    from backend.websockets.manager import manager
    from datetime import datetime

    med = db.query(Medication).filter(Medication.id == medication_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medicamento não encontrado")
    
    med.status = "tomado"
    med.confirmed_at = datetime.utcnow()
    db.commit()
    db.refresh(med)
    
    # Broadcast em tempo real para os WebSockets do tipo "mobile"
    event = {
        "event": "MEDICATION_CONFIRMED",
        "data": {
            "medication_id": med.id,
            "name": med.name,
            "confirmed_at": med.confirmed_at.isoformat(),
            "status": med.status
        }
    }
    await manager.broadcast_to_type("mobile", event)
    
    return med
