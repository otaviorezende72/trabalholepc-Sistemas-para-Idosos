import random
import string
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.user import User
from backend.models.elder_settings import ElderSettings
from backend.schemas.user import UserRegister, UserLogin, ElderLogin
from backend.utils.auth import hash_password, verify_password, encode_jwt

router = APIRouter(prefix="/api/auth", tags=["auth"])

def generate_access_code(db: Session) -> str:
    while True:
        code = "".join(random.choices(string.digits, k=6))
        # Garante unicidade
        existing = db.query(ElderSettings).filter(ElderSettings.access_code == code).first()
        if not existing:
            return code

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    # Verifica se usuário já existe
    existing_user = db.query(User).filter(User.username == payload.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nome de usuário já está em uso"
        )
        
    # 1. Cria as configurações do idoso com código de acesso único
    access_code = generate_access_code(db)
    elder = ElderSettings(access_code=access_code)
    db.add(elder)
    db.commit()
    db.refresh(elder)
    
    # 2. Cria o usuário do cuidador associado ao idoso
    pwd_hash = hash_password(payload.password)
    user = User(
        username=payload.username,
        password_hash=pwd_hash,
        elder_id=elder.id
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # 3. Gera token JWT
    token = encode_jwt({"sub": user.username})
    
    return {
        "token": token,
        "username": user.username,
        "access_code": access_code
    }

@router.post("/login")
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha incorretos"
        )
        
    elder = db.query(ElderSettings).filter(ElderSettings.id == user.elder_id).first()
    access_code = elder.access_code if elder else None
    
    token = encode_jwt({"sub": user.username})
    
    return {
        "token": token,
        "username": user.username,
        "access_code": access_code
    }

@router.post("/login-elder")
def login_elder(payload: ElderLogin, db: Session = Depends(get_db)):
    elder = db.query(ElderSettings).filter(ElderSettings.access_code == payload.code).first()
    if not elder:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Código de acesso inválido ou expirado"
        )
        
    # Encontra o cuidador vinculado ao idoso para repassar o contexto
    user = db.query(User).filter(User.elder_id == elder.id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nenhum cuidador vinculado a este idoso"
        )
        
    token = encode_jwt({"sub": user.username})
    
    return {
        "token": token,
        "elder_name": elder.elder_name,
        "elder_id": elder.id
    }
