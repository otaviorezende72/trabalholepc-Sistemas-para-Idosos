import base64
import hmac
import hashlib
import json
import time
import os
from fastapi import Header, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.user import User
from backend.models.elder_settings import ElderSettings

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "lyra-super-secret-key-for-jwt-2026")
ALGORITHM = "HS256"
TOKEN_EXPIRE_SECONDS = 30 * 24 * 3600  # 30 dias

def base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('utf-8')

def base64url_decode(data: str) -> bytes:
    padding = '=' * (4 - (len(data) % 4))
    return base64.urlsafe_b64decode(data + padding)

def hash_password(password: str) -> str:
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
    return f"{salt.hex()}:{key.hex()}"

def verify_password(password: str, hashed: str) -> bool:
    try:
        salt_hex, key_hex = hashed.split(':')
        salt = bytes.fromhex(salt_hex)
        key = bytes.fromhex(key_hex)
        new_key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
        return hmac.compare_digest(key, new_key)
    except Exception:
        return False

def encode_jwt(payload: dict) -> str:
    header = {"alg": ALGORITHM, "typ": "JWT"}
    header_json = json.dumps(header, separators=(',', ':')).encode('utf-8')
    
    # Adiciona expiração se não fornecida
    if "exp" not in payload:
        payload["exp"] = int(time.time()) + TOKEN_EXPIRE_SECONDS
        
    payload_json = json.dumps(payload, separators=(',', ':')).encode('utf-8')
    
    header_b64 = base64url_encode(header_json)
    payload_b64 = base64url_encode(payload_json)
    
    signing_input = f"{header_b64}.{payload_b64}".encode('utf-8')
    signature = hmac.new(SECRET_KEY.encode('utf-8'), signing_input, hashlib.sha256).digest()
    signature_b64 = base64url_encode(signature)
    
    return f"{header_b64}.{payload_b64}.{signature_b64}"

def decode_jwt(token: str) -> dict:
    try:
        parts = token.split('.')
        if len(parts) != 3:
            raise ValueError("Token malformado")
        
        header_b64, payload_b64, signature_b64 = parts
        signing_input = f"{header_b64}.{payload_b64}".encode('utf-8')
        expected_signature = hmac.new(SECRET_KEY.encode('utf-8'), signing_input, hashlib.sha256).digest()
        expected_signature_b64 = base64url_encode(expected_signature)
        
        if not hmac.compare_digest(signature_b64, expected_signature_b64):
            raise ValueError("Assinatura do token inválida")
            
        payload_json = base64url_decode(payload_b64)
        payload = json.loads(payload_json)
        
        if "exp" in payload and payload["exp"] < time.time():
            raise ValueError("Token expirou")
            
        return payload
    except Exception as e:
        raise ValueError(f"Decodificação falhou: {str(e)}")

def get_current_user(
    authorization: str = Header(None),
    x_device_token: str = Header(None),
    db: Session = Depends(get_db)
) -> User:
    # 1. Fallback exclusivo para testes automatizados
    if os.getenv("TEST_MODE") == "True" and not authorization and not x_device_token:
        user = db.query(User).first()
        if not user:
            elder = db.query(ElderSettings).first()
            if not elder:
                elder = ElderSettings(access_code="123456")
                db.add(elder)
                db.commit()
                db.refresh(elder)
            user = User(
                username="default_caregiver",
                password_hash="pbkdf2_hash_placeholder",
                elder_id=elder.id
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        return user

    # 2. Autenticação via X-Device-Token (Motor Doméstico)
    if x_device_token:
        elder = db.query(ElderSettings).filter(ElderSettings.access_code == x_device_token).first()
        if not elder:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token de dispositivo inválido"
            )
        
        # Procura cuidador cadastrado associado a esse idoso
        user = db.query(User).filter(User.elder_id == elder.id).first()
        if not user:
            # Cria um usuário virtual do sistema para o motor caso não haja nenhum cadastrado
            user = db.query(User).filter(User.username == f"motor_system_{elder.id}").first()
            if not user:
                user = User(
                    username=f"motor_system_{elder.id}",
                    password_hash="system_managed_no_login",
                    elder_id=elder.id
                )
                db.add(user)
                db.commit()
                db.refresh(user)
        return user

    # 3. Autenticação via JWT (Familiar / Celular Idoso)
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação necessária (Authorization Bearer ou X-Device-Token)"
        )
        
    try:
        if "Bearer " in authorization:
            token = authorization.split("Bearer ")[1].strip()
        else:
            token = authorization.strip()
            
        payload = decode_jwt(token)
        username = payload.get("sub")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token não contém dados de identificação do usuário"
            )
            
        user = db.query(User).filter(User.username == username).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Usuário associado ao token não existe no sistema"
            )
        return user
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Credenciais inválidas: {str(e)}"
        )
