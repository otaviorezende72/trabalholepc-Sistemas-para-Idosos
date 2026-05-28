import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, status
from fastapi.middleware.cors import CORSMiddleware

from backend.database import Base, engine
from backend.routers import elder_settings, alert, medication
from backend.websockets.manager import manager

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
app.include_router(elder_settings.router)
app.include_router(alert.router)
app.include_router(medication.router)

@app.get("/")
def read_root():
    return {"status": "ok", "app": "Lyra Backend API"}

@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    client_type: str = Query(..., description="Tipo de cliente conectando: 'motor' ou 'mobile'")
):
    # Validação rigorosa do tipo de cliente
    if client_type not in ["motor", "mobile"]:
        logging.warning(f"[WebSocket] Conexão rejeitada. client_type '{client_type}' inválido.")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # Aceita e registra o cliente no ConnectionManager
    await manager.connect(websocket, client_type)
    
    try:
        while True:
            # Aguarda a chegada de mensagens JSON
            data = await websocket.receive_json()
            logging.info(f"[WebSocket] Mensagem recebida de '{client_type}': {data}")
            
            event_type = data.get("event")
            
            # Repasse inteligente de mensagens
            if event_type == "SOS_TRIGGERED" and client_type == "motor":
                logging.info("[WebSocket] SOS recebido do motor. Enviando broadcast para os celulares.")
                await manager.broadcast_to_type("mobile", data)
                
            elif event_type == "CONFIG_UPDATED" and client_type == "mobile":
                logging.info("[WebSocket] Atualização de regras recebida do mobile. Repassando ao motor.")
                await manager.broadcast_to_type("motor", data)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, client_type)
    except Exception as e:
        logging.error(f"[WebSocket] Erro crítico na conexão com '{client_type}': {e}", exc_info=True)
        manager.disconnect(websocket, client_type)
