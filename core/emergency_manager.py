import logging
import sys
from datetime import datetime
import config

class EmergencyManager:
    """
    Gerencia as lógicas de crise e alertas do sistema.
    
    Isola a responsabilidade do que acontece quando o usuário deixa de
    responder ou precisa de ajuda.
    """
    
    def __init__(self, ws_client=None):
        self._ws_client = ws_client
        logging.info("Módulo de Gerenciamento de Emergências inicializado.")

    def trigger_alert(self, reason: str = "ausencia_resposta"):
        """
        Desperta o protocolo de emergência.
        
        Envia um sinal de SOS via WebSocket ao backend e exibe informações nos logs e console.
        """
        # Carrega dinamicamente a partir do módulo config (para suportar atualizações em runtime)
        contact_name = config.EMERGENCY_CONTACT_NAME
        contact_phone = config.EMERGENCY_CONTACT_PHONE
        
        logging.critical("===" * 20)
        logging.critical(config.EMERGENCY_MESSAGE)
        logging.critical(f"Acionando contato: {contact_name} no telefone: {contact_phone}")
        logging.critical("===" * 20)
        
        # Garantir que a mensagem saia no console imediatamente para fins de MVP
        print(f"\n{config.EMERGENCY_MESSAGE}", file=sys.stderr)
        print(f"Acionando contato: {contact_name} no telefone: {contact_phone}\n", file=sys.stderr)
        
        # Envio do alerta de SOS em tempo real via WebSocket para o backend
        if self._ws_client:
            event_data = {
                "reason": reason,
                "timestamp": datetime.utcnow().isoformat(),
                "contact_name": contact_name,
                "contact_phone": contact_phone
            }
            logging.info("[EmergencyManager] Disparando evento SOS_TRIGGERED para o backend via WebSocket...")
            self._ws_client.send_event("SOS_TRIGGERED", event_data)
        else:
            logging.warning("[EmergencyManager] WebSocket indisponível. Alerta de SOS não transmitido online.")
            
        # Futura implementação:
        # self._send_sms_alert()
        # self._call_emergency_contacts()
        
    def _send_sms_alert(self):
        """Stub para envio de SMS via Twilio ou similar."""
        pass
        
    def _call_emergency_contacts(self):
        """Stub para ligação telefônica."""
        pass
