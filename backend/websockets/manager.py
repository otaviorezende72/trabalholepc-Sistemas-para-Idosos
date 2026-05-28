from fastapi import WebSocket
from typing import Dict, Set
import logging

class ConnectionManager:
    def __init__(self):
        # Mapeia o tipo de cliente ("motor" ou "mobile") para os WebSockets ativos
        self.active_connections: Dict[str, Set[WebSocket]] = {
            "motor": set(),
            "mobile": set()
        }

    async def connect(self, websocket: WebSocket, client_type: str):
        await websocket.accept()
        if client_type not in self.active_connections:
            self.active_connections[client_type] = set()
        self.active_connections[client_type].add(websocket)
        logging.info(f"[WebSocket] Cliente '{client_type}' conectado. Total: {len(self.active_connections[client_type])}")

    def disconnect(self, websocket: WebSocket, client_type: str):
        if client_type in self.active_connections:
            self.active_connections[client_type].discard(websocket)
            logging.info(f"[WebSocket] Cliente '{client_type}' desconectado. Restantes: {len(self.active_connections[client_type])}")

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        await websocket.send_json(message)

    async def broadcast_to_type(self, client_type: str, message: dict):
        """Envia mensagem para todos os clientes conectados de um tipo específico."""
        if client_type in self.active_connections:
            connections = list(self.active_connections[client_type])
            if connections:
                logging.info(f"[WebSocket] Enviando broadcast para todos '{client_type}': {message}")
                for connection in connections:
                    try:
                        await connection.send_json(message)
                    except Exception as e:
                        logging.warning(f"[WebSocket] Falha ao enviar broadcast. Removendo conexão quebrada: {e}")
                        self.active_connections[client_type].discard(connection)

    async def broadcast_all(self, message: dict):
        """Envia mensagem para absolutamente todos os clientes conectados."""
        for client_type in self.active_connections.keys():
            await self.broadcast_to_type(client_type, message)

# Instância global compartilhada (Singleton)
manager = ConnectionManager()
