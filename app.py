import logging
from config import MAX_CONSECUTIVE_FAILURES
from core.ai_processor import AIProcessor
from core.audio_handler import AudioHandler
from core.emergency_manager import EmergencyManager

class Application:
    \"\"\"
    Classe principal que orquestra a aplicação do assistente de voz.
    
    Ela inicializa e coordena os módulos de IA, áudio e emergência,
    e contém o loop principal de interação com o usuário.
    \"\"\"

    def __init__(self):
        logging.info("Iniciando a aplicação Aurora...")
        try:
            self.ai_processor = AIProcessor()
            self.audio_handler = AudioHandler()
            self.emergency_manager = EmergencyManager()
            self.consecutive_failures = 0
            self.is_running = False
        except Exception as e:
            logging.critical(f"Falha crítica durante a inicialização dos módulos: {e}", exc_info=True)
            raise  # Propaga a exceção para interromper a execução se um módulo falhar

    def run(self):
        \"\"\"Inicia o loop principal de interação do assistente.\"\"\"
        self.is_running = True
        self._greet()

        while self.is_running:
            user_input = self.audio_handler.listen()

            if user_input:
                self.consecutive_failures = 0  # Reseta em caso de sucesso
                self._process_user_command(user_input)
            else:
                self._handle_listen_failure()
        
        logging.info("Loop principal da aplicação encerrado.")

    def _greet(self):
        \"\"\"Envia uma saudação inicial ao usuário.\"\"\"
        initial_greeting = "Olá! Eu sou Aurora, sua assistente. Como você está se sentindo hoje?"
        self.audio_handler.speak(initial_greeting)

    def _process_user_command(self, command: str):
        \"\"\"Processa um comando válido do usuário.\"\"\"
        if any(keyword in command for keyword in ["desligar", "parar", "encerrar"]):
            self.audio_handler.speak("Entendido. Desligando. Até logo!")
            self.is_running = False
        else:
            ai_response = self.ai_processor.get_response(command)
            self.audio_handler.speak(ai_response)

    def _handle_listen_failure(self):
        \"\"\"Gerencia o contador de falhas de escuta e aciona o alerta se necessário.\"\"\"
        self.consecutive_failures += 1
        logging.warning(f"Falha de escuta #{self.consecutive_failures} de {MAX_CONSECUTIVE_FAILURES}.")

        if self.consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
            self.emergency_manager.trigger_alert()
            self.is_running = False # Interrompe a aplicação após o alerta
