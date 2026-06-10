import logging
import json
import threading
import time
import websocket
import config

class LyraWebSocketClient:
    """
    Cliente WebSocket para comunicação concorrente e resiliente com o Backend FastAPI.
    
    Roda em uma thread de segundo plano (daemon) para evitar bloqueios de I/O na thread principal.
    Implementa reconexão automática com exponential backoff.
    """
    
    def __init__(self, ws_url: str = None):
        self.ws_url = ws_url or config.WS_URL
        self.ws = None
        self.thread = None
        self.is_running = False
        self.reconnect_delay = 2
        self.max_reconnect_delay = 60
        self.lock = threading.Lock()
        logging.info(f"Cliente WebSocket inicializado para: {self.ws_url}")

    def start(self):
        """Inicia a conexão com o servidor em uma thread de segundo plano."""
        with self.lock:
            if self.is_running:
                logging.warning("WebSocket já está em execução.")
                return
            self.is_running = True
            
        logging.info("Iniciando conexão de segundo plano com o WebSocket...")
        self.thread = threading.Thread(target=self._run_loop, daemon=True)
        self.thread.start()

    def _run_loop(self):
        """Loop de execução e reconexão resiliente."""
        while self.is_running:
            try:
                logging.info(f"[WebSocket] Tentando conectar a {self.ws_url}...")
                
                # Desativa logs verbosos internos da biblioteca websocket-client
                websocket.enableTrace(False)
                
                self.ws = websocket.WebSocketApp(
                    self.ws_url,
                    on_open=self._on_open,
                    on_message=self._on_message,
                    on_error=self._on_error,
                    on_close=self._on_close
                )
                
                # Executa bloqueando a thread de background até desconectar
                self.ws.run_forever()
                
            except Exception as e:
                logging.error(f"[WebSocket] Erro crítico no loop de conexão: {e}")
            
            # Se ainda estiver ativo, aguarda e tenta reconectar com Exponential Backoff
            if self.is_running:
                logging.info(f"[WebSocket] Reconectando em {self.reconnect_delay} segundos...")
                time.sleep(self.reconnect_delay)
                self.reconnect_delay = min(self.reconnect_delay * 2, self.max_reconnect_delay)

    def stop(self):
        """Finaliza a conexão graciosa com o servidor."""
        logging.info("Encerrando conexão com o WebSocket...")
        with self.lock:
            self.is_running = False
        if self.ws:
            try:
                self.ws.close()
            except Exception as e:
                logging.error(f"[WebSocket] Erro ao fechar conexão: {e}")
        logging.info("WebSocket finalizado com sucesso.")

    def _on_open(self, ws):
        logging.info("[WebSocket] Conexão estabelecida com sucesso com o servidor.")
        # Reseta o backoff de reconexão
        self.reconnect_delay = 2

    def _on_message(self, ws, message_str):
        logging.info(f"[WebSocket] Mensagem crua recebida: {message_str}")
        try:
            message = json.loads(message_str)
            event_type = message.get("event")
            data = message.get("data") or message.get("payload") # suporta payload ou data
            
            if event_type == "CONFIG_UPDATED" and data:
                logging.info(f"[WebSocket] Recebida atualização de configuração: {data}")
                self._apply_runtime_configs(data)
                
        except json.JSONDecodeError:
            logging.error(f"[WebSocket] Falha ao decodificar JSON da mensagem: {message_str}")
        except Exception as e:
            logging.error(f"[WebSocket] Erro ao processar mensagem do WebSocket: {e}", exc_info=True)

    def _apply_runtime_configs(self, data: dict):
        """Aplica as configurações recebidas em tempo real nas variáveis do config.py."""
        try:
            if "checkin_interval_hours" in data:
                config.CHECKIN_INTERVAL_HOURS = int(data["checkin_interval_hours"])
                logging.info(f"[WebSocket] config.CHECKIN_INTERVAL_HOURS atualizado para: {config.CHECKIN_INTERVAL_HOURS}")
                
            if "emergency_contact_name" in data:
                config.EMERGENCY_CONTACT_NAME = str(data["emergency_contact_name"])
                logging.info(f"[WebSocket] config.EMERGENCY_CONTACT_NAME atualizado para: {config.EMERGENCY_CONTACT_NAME}")
                
            if "emergency_contact_phone" in data:
                config.EMERGENCY_CONTACT_PHONE = str(data["emergency_contact_phone"])
                logging.info(f"[WebSocket] config.EMERGENCY_CONTACT_PHONE atualizado para: {config.EMERGENCY_CONTACT_PHONE}")
                
            if "profile_summary" in data:
                config.PROFILE_SUMMARY = str(data["profile_summary"])
                logging.info(f"[WebSocket] config.PROFILE_SUMMARY atualizado para: {config.PROFILE_SUMMARY}")
                
            logging.info("[WebSocket] Atualização de configurações aplicada em runtime com sucesso.")
        except Exception as e:
            logging.error(f"[WebSocket] Falha ao aplicar configurações em runtime: {e}")

    def _on_error(self, ws, error):
        logging.error(f"[WebSocket] Erro na conexão do cliente: {error}")

    def _on_close(self, ws, close_status_code, close_msg):
        logging.info(f"[WebSocket] Conexão encerrada. Código: {close_status_code}, Mensagem: {close_msg}")

    def send_event(self, event_type: str, data: dict):
        """Envia um evento JSON estruturado para o backend de forma thread-safe."""
        if not self.is_running:
            logging.warning("[WebSocket] Tentativa de envio de mensagem com cliente desligado.")
            return False
            
        payload = {
            "event": event_type,
            "data": data
        }
        
        # Envia de forma thread-safe verificando se o socket está aberto
        try:
            if self.ws and self.ws.sock and self.ws.sock.connected:
                message_str = json.dumps(payload)
                logging.info(f"[WebSocket] Enviando evento '{event_type}': {message_str}")
                self.ws.send(message_str)
                return True
            else:
                logging.warning(f"[WebSocket] Impossível enviar evento '{event_type}'. Socket desconectado.")
                return False
        except Exception as e:
            logging.error(f"[WebSocket] Erro ao enviar mensagem por WebSocket: {e}")
            return False
