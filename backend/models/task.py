from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from datetime import datetime
from backend.database import Base

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, default="", nullable=False)
    completed = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Armazena horários e dias no banco de dados como texto separado por vírgula
    horarios_str = Column("horarios", String, default="", nullable=False)
    dias_str = Column("dias", String, default="", nullable=False)
    
    elder_id = Column(Integer, ForeignKey("elder_settings.id"), nullable=True)

    @property
    def descricao(self) -> str:
        return self.title

    @property
    def concluido(self) -> bool:
        return self.completed

    @property
    def horarios(self) -> list:
        if not self.horarios_str:
            return []
        return [h.strip() for h in self.horarios_str.split(",") if h.strip()]

    @property
    def dias(self) -> list:
        if not self.dias_str:
            return []
        return [d.strip() for d in self.dias_str.split(",") if d.strip()]
