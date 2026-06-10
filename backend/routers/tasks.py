from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from typing import List
from backend.database import get_db
from backend.models.task import Task
from backend.models.user import User
from backend.schemas.task import TaskCreate, TaskResponse
from backend.utils.auth import get_current_user
from backend.websockets.manager import manager

router = APIRouter(tags=["tasks"])

@router.get("/tasks", response_model=List[TaskResponse])
@router.get("/api/tasks", response_model=List[TaskResponse])
def list_tasks(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Task).filter(Task.elder_id == current_user.elder_id).all()

@router.post("/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
@router.post("/api/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(payload: TaskCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = Task(
        title=payload.descricao,
        description=payload.descricao,
        completed=payload.completed or False,
        horarios_str=payload.horarios or "",
        dias_str=payload.dias or "",
        elder_id=current_user.elder_id
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    # Dispara evento WebSocket para que os celulares (idoso e cuidador) atualizem as listas
    event = {
        "event": "TASKS_UPDATED",
        "data": {
            "action": "create",
            "task_id": task.id
        }
    }
    await manager.broadcast_to_elder(current_user.elder_id, event, client_type="mobile")

    return task

@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
@router.delete("/api/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id, Task.elder_id == current_user.elder_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")

    db.delete(task)
    db.commit()

    # Dispara evento WebSocket informando a exclusão
    event = {
        "event": "TASKS_UPDATED",
        "data": {
            "action": "delete",
            "task_id": task_id
        }
    }
    await manager.broadcast_to_elder(current_user.elder_id, event, client_type="mobile")

    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.patch("/tasks/{task_id}/toggle", response_model=TaskResponse)
@router.patch("/api/tasks/{task_id}/toggle", response_model=TaskResponse)
async def toggle_task(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id, Task.elder_id == current_user.elder_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")

    task.completed = not task.completed
    db.commit()
    db.refresh(task)

    # Dispara evento WebSocket informando a alteração
    event = {
        "event": "TASKS_UPDATED",
        "data": {
            "action": "toggle",
            "task_id": task_id,
            "completed": task.completed
        }
    }
    await manager.broadcast_to_elder(current_user.elder_id, event, client_type="mobile")

    return task
