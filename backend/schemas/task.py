from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

class TaskCreate(BaseModel):
    descricao: str
    horarios: Optional[str] = ""
    dias: Optional[str] = ""
    completed: Optional[bool] = False

class TaskResponse(BaseModel):
    id: int
    descricao: str
    title: str
    description: str
    completed: bool
    concluido: bool
    created_at: datetime
    elder_id: Optional[int] = None
    horarios: List[str] = []
    dias: List[str] = []

    class Config:
        from_attributes = True
        orm_mode = True  # Compatibilidade para Pydantic v1
