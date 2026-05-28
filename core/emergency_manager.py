import logging
import sys
from config import EMERGENCY_MESSAGE

class EmergencyManager:
    \"\"\"
    Gerencia as lógicas de crise e alertas do sistema.
    
    Isola a responsabilidade do que acontece quando o usuário deixa de
    responder ou precisa de ajuda.
    \"\"\"
    
    def __init__(self):
        logging.info("Módulo de Gerenciamento de Emergências inicializado.")

    def trigger_alert(self):
        \"\"\"
        Desperta o protocolo de emergência.
        
        Neste MVP, apenas loga a falha criticamente. Em produção, isso
        conectaria com APIs de WhatsApp, SMS, ou chamadas de voz para
        familiares/serviços médicos.
        \"\"\"
        logging.critical("===" * 20)
        logging.critical(EMERGENCY_MESSAGE)
        logging.critical("===" * 20)
        
        # Garantir que a mensagem saia no console imediatamente para fins de MVP
        print(f"\n{EMERGENCY_MESSAGE}\n", file=sys.stderr)
        
        # Futura implementação:
        # self._send_sms_alert()
        # self._call_emergency_contacts()
        
    def _send_sms_alert(self):
        \"\"\"Stub para envio de SMS via Twilio ou similar.\"\"\"
        pass
        
    def _call_emergency_contacts(self):
        \"\"\"Stub para ligação telefônica.\"\"\"
        pass
