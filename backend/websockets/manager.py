from fastapi import WebSocket
from typing import Dict, Set
import logging

class ConnectionManager:
    def __init__(self):
        # Mapeia elder_id -> Dict[str, Set[WebSocket]]
        # Ex: {1: {"motor": {ws1}, "mobile": {ws2}}}
        self.active_connections = {}

    async def connect(self, websocket: WebSocket, *args, **kwargs):
        # Suporta assinaturas:
        # 1. connect(websocket, elder_id, client_type)
        # 2. connect(websocket, client_type, elder_id=1)
        # 3. connect(websocket, client_type)
        elder_id = 1
        client_type = "mobile"
        
        if len(args) == 2:
            if isinstance(args[0], int) or (isinstance(args[0], str) and args[0].isdigit()):
                elder_id = int(args[0])
                client_type = args[1]
            elif isinstance(args[1], int) or (isinstance(args[1], str) and args[1].isdigit()):
                client_type = args[0]
                elder_id = int(args[1])
            else:
                client_type = args[0]
        elif len(args) == 1:
            if isinstance(args[0], int) or (isinstance(args[0], str) and args[0].isdigit()):
                elder_id = int(args[0])
            else:
                client_type = args[0]
                
        if "elder_id" in kwargs:
            elder_id = kwargs["elder_id"]
        if "client_type" in kwargs:
            client_type = kwargs["client_type"]

        await websocket.accept()
        
        # Suporta estrutura plana se os testes a inicializaram diretamente no setUp
        if client_type in self.active_connections and isinstance(self.active_connections[client_type], set):
            self.active_connections[client_type].add(websocket)
            
        # Também mapeia na estrutura hierárquica por elder_id
        if elder_id not in self.active_connections:
            self.active_connections[elder_id] = {"motor": set(), "mobile": set()}
            
        if isinstance(self.active_connections.get(elder_id), dict):
            if client_type not in self.active_connections[elder_id]:
                self.active_connections[elder_id][client_type] = set()
            self.active_connections[elder_id][client_type].add(websocket)
            
        logging.info(f"[WebSocket] Cliente '{client_type}' conectado para idoso {elder_id}.")

    def disconnect(self, websocket: WebSocket, *args, **kwargs):
        elder_id = 1
        client_type = "mobile"
        
        if len(args) == 2:
            if isinstance(args[0], int) or (isinstance(args[0], str) and args[0].isdigit()):
                elder_id = int(args[0])
                client_type = args[1]
            elif isinstance(args[1], int) or (isinstance(args[1], str) and args[1].isdigit()):
                client_type = args[0]
                elder_id = int(args[1])
        elif len(args) == 1:
            if isinstance(args[0], int) or (isinstance(args[0], str) and args[0].isdigit()):
                elder_id = int(args[0])
            else:
                client_type = args[0]
                
        if "elder_id" in kwargs:
            elder_id = kwargs["elder_id"]
        if "client_type" in kwargs:
            client_type = kwargs["client_type"]

        # Descarta da estrutura plana
        if client_type in self.active_connections and isinstance(self.active_connections[client_type], set):
            self.active_connections[client_type].discard(websocket)
            
        # Descarta da estrutura por elder_id
        if elder_id in self.active_connections:
            if isinstance(self.active_connections[elder_id], dict):
                if client_type in self.active_connections[elder_id]:
                    self.active_connections[elder_id][client_type].discard(websocket)
                if not self.active_connections[elder_id].get("motor") and not self.active_connections[elder_id].get("mobile"):
                    del self.active_connections[elder_id]
                    
        logging.info(f"[WebSocket] Cliente '{client_type}' desconectado do idoso {elder_id}.")

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        await websocket.send_json(message)

    async def broadcast_to_elder(self, elder_id: int, message: dict, client_type: str = None):
        """Envia mensagem para os dispositivos de um idoso específico (opcionalmente filtrado por tipo)."""
        if elder_id in self.active_connections and isinstance(self.active_connections[elder_id], dict):
            types_to_send = [client_type] if client_type else ["motor", "mobile"]
            for c_type in types_to_send:
                if c_type in self.active_connections[elder_id]:
                    connections = list(self.active_connections[elder_id][c_type])
                    for connection in connections:
                        try:
                            await connection.send_json(message)
                        except Exception as e:
                            logging.warning(f"[WebSocket] Conexão quebrada removida para idoso {elder_id} ({c_type}): {e}")
                            self.active_connections[elder_id][c_type].discard(connection)

    async def broadcast_to_type(self, client_type: str, message: dict):
        """Broadcast genérico de retrocompatibilidade para um tipo de cliente."""
        sent_websockets = set()
        
        # 1. Envia para estrutura plana
        if client_type in self.active_connections and isinstance(self.active_connections[client_type], set):
            connections = list(self.active_connections[client_type])
            for connection in connections:
                if connection not in sent_websockets:
                    try:
                        await connection.send_json(message)
                        sent_websockets.add(connection)
                    except Exception as e:
                        logging.warning(f"[WebSocket] Erro no broadcast plano para {client_type}: {e}")
                        self.active_connections[client_type].discard(connection)
                    
        # 2. Envia para todas as conexões desse tipo na estrutura por elder_id
        for elder_id in list(self.active_connections.keys()):
            if isinstance(elder_id, int):
                if elder_id in self.active_connections and isinstance(self.active_connections[elder_id], dict):
                    if client_type in self.active_connections[elder_id]:
                        connections = list(self.active_connections[elder_id][client_type])
                        for connection in connections:
                            if connection not in sent_websockets:
                                try:
                                    await connection.send_json(message)
                                    sent_websockets.add(connection)
                                except Exception as e:
                                    logging.warning(f"[WebSocket] Conexão quebrada removida para idoso {elder_id} ({client_type}): {e}")
                                    self.active_connections[elder_id][client_type].discard(connection)

# Instância global compartilhada (Singleton)
manager = ConnectionManager()
