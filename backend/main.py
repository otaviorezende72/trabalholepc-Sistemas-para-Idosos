import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend.database import Base, engine, get_db
from backend.routers import elder_settings, alert, medication, status as status_router, tasks, auth, utility
from backend.websockets.manager import manager
from backend.models.elder_settings import ElderSettings



# Configura o sistema de logs para o backend
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [%(module)s] - %(message)s"
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Cria as tabelas do SQLite no boot se não existirem (Auto-healing)
    logging.info("[lifespan] Inicializando banco de dados SQLite...")
    Base.metadata.create_all(bind=engine)
    yield
    logging.info("[lifespan] Encerrando backend...")

app = FastAPI(
    title="Lyra API",
    description="Backend de Comunicação e Histórico do Assistente Lyra",
    version="1.0.0",
    lifespan=lifespan
)

# Configuração de CORS - Essencial para que o React Native acesse em desenvolvimento
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registro das rotas RESTful
app.include_router(auth.router)
app.include_router(elder_settings.router)
app.include_router(alert.router)

app.include_router(medication.router)
app.include_router(status_router.router)
app.include_router(tasks.router)
app.include_router(utility.router)

@app.get("/")
def read_root():
    return {"status": "ok", "app": "Lyra Backend API"}


@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    client_type: str = Query(..., description="Tipo de cliente conectando: 'motor' ou 'mobile'"),
    token: str = Query(None, description="JWT Token ou access_code do dispositivo")
):
    import os
    from backend.utils.auth import decode_jwt
    from backend.models.user import User
    from backend.models.elder_settings import ElderSettings

    # Validação rigorosa do tipo de cliente
    if client_type not in ["motor", "mobile"]:
        logging.warning(f"[WebSocket] Conexão rejeitada. client_type '{client_type}' inválido.")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    db = next(get_db())
    elder_id = None

    # Fallback para o ambiente de testes automatizados
    if os.getenv("TEST_MODE") == "True" and not token:
        elder = db.query(ElderSettings).first()
        if not elder:
            elder = ElderSettings(access_code="123456")
            db.add(elder)
            db.commit()
            db.refresh(elder)
        elder_id = elder.id
    elif token:
        # Se for o motor conectando, permitimos usar o access_code (6 dígitos) como token
        if client_type == "motor" and len(token) == 6 and token.isdigit():
            elder = db.query(ElderSettings).filter(ElderSettings.access_code == token).first()
            if elder:
                elder_id = elder.id
        else:
            # Caso contrário, decodifica o JWT
            try:
                payload = decode_jwt(token)
                username = payload.get("sub")
                if username:
                    user = db.query(User).filter(User.username == username).first()
                    if user:
                        elder_id = user.elder_id
            except Exception:
                pass

    if not elder_id:
        logging.warning(f"[WebSocket] Autenticação falhou para '{client_type}'. Conexão recusada.")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # Aceita e registra o cliente no ConnectionManager com elder_id
    await manager.connect(websocket, elder_id, client_type)
    
    try:
        while True:
            # Aguarda a chegada de mensagens JSON
            data = await websocket.receive_json()
            logging.info(f"[WebSocket] Mensagem recebida de '{client_type}' (Idoso {elder_id}): {data}")
            
            event_type = data.get("event")
            
            # Repasse inteligente de mensagens por idoso
            if event_type == "SOS_TRIGGERED":
                logging.info(f"[WebSocket] SOS recebido de '{client_type}'. Repassando a todos do idoso {elder_id}.")
                await manager.broadcast_to_elder(elder_id, data)
                
            elif event_type == "SOS_LOG_UPDATE":
                logging.info(f"[WebSocket] SOS log update recebido de '{client_type}'. Repassando a celulares do idoso {elder_id}.")
                await manager.broadcast_to_elder(elder_id, data, "mobile")
                
            elif event_type == "CONFIG_UPDATED" and client_type == "mobile":
                logging.info(f"[WebSocket] Atualização de regras recebida do mobile. Repassando ao motor do idoso {elder_id}.")
                await manager.broadcast_to_elder(elder_id, data, "motor")
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, elder_id, client_type)
    except Exception as e:
        logging.error(f"[WebSocket] Erro crítico na conexão com '{client_type}' (Idoso {elder_id}): {e}", exc_info=True)
        manager.disconnect(websocket, elder_id, client_type)

