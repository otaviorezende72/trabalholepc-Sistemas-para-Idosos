import logging
import queue
import requests
import config
from core.ai_processor import AIProcessor
from core.audio_handler import AudioHandler, AudioResult, AudioInputResult
from core.emergency_manager import EmergencyManager
from core.ws_client import LyraWebSocketClient
from core.medication_worker import MedicationWorker

class Application:
    """
    Classe principal que orquestra a aplicação do assistente de voz.
    
    Ela inicializa e coordena os módulos de IA, áudio, emergência e o cliente
    de WebSocket, gerenciando o loop principal de áudio e verificações de medicamentos
    em paralelo via threads secundárias dedicadas.
    """

    def __init__(self):
        logging.info("Iniciando a aplicação Lyra...")
        try:
            # Inicializa a conexão de segundo plano via WebSocket
            self.ws_client = LyraWebSocketClient()
            self.ws_client.start()

            # Inicializa a fila e a thread de monitoramento de medicamentos
            self.reminder_queue = queue.Queue()
            self.medication_worker = MedicationWorker(reminder_queue=self.reminder_queue)
            self.medication_worker.start()

            self.ai_processor = AIProcessor()
            self.audio_handler = AudioHandler()
            self.emergency_manager = EmergencyManager(ws_client=self.ws_client)
            self.consecutive_failures = 0
            self.is_running = False
        except Exception as e:
            logging.critical(f"Falha crítica durante a inicialização dos módulos: {e}", exc_info=True)
            # Finalização defensiva dos recursos iniciados
            if hasattr(self, 'ws_client') and self.ws_client:
                self.ws_client.stop()
            if hasattr(self, 'medication_worker') and self.medication_worker:
                self.medication_worker.stop()
            raise  # Propaga a exceção para interromper a execução se um módulo falhar

    def run(self):
        """Inicia o loop principal de interação do assistente."""
        self.is_running = True
        self._greet()

        try:
            while self.is_running:
                # 1. Checa a fila de lembretes proativos de medicamentos antes de escutar
                self._check_medication_queue()
                if not self.is_running:
                    break

                # 2. Executa a escuta convencional
                audio_result = self.audio_handler.listen()

                # Verifica palavra-chave crítica de SOS no áudio capturado (Spotter)
                if audio_result.status == AudioResult.SUCCESS and audio_result.text:
                    if self.audio_handler.contains_sos_keywords(audio_result.text):
                        logging.critical(f"Palavra-chave crítica de SOS detectada: '{audio_result.text}'")
                        self.audio_handler.speak("Entendido. Acionando emergência imediatamente.")
                        self.emergency_manager.trigger_alert(reason="comando_voz")
                        self.is_running = False
                        break

                # 3. Processa a lógica de respostas
                if audio_result.status == AudioResult.SUCCESS:
                    self.consecutive_failures = 0  # Reseta em caso de sucesso
                    self._process_user_command(audio_result.text)
                else:
                    self._handle_audio_failure(audio_result)
        finally:
            logging.info("Encerrando serviços secundários da aplicação...")
            self.ws_client.stop()
            self.medication_worker.stop()
            logging.info("Loop principal da aplicação encerrado.")

    def _greet(self):
        """Envia uma saudação inicial ao usuário."""
        initial_greeting = "Olá! Eu sou Lyra, sua assistente. Como você está se sentindo hoje?"
        self.audio_handler.speak(initial_greeting)

    def _process_user_command(self, command: str):
        """Processa um comando válido do usuário."""
        if any(keyword in command for keyword in ["desligar", "parar", "encerrar"]):
            self.audio_handler.speak("Entendido. Desligando. Até logo!")
            self.is_running = False
        else:
            ai_response = self.ai_processor.get_response(command)
            self.audio_handler.speak(ai_response)

    def _handle_audio_failure(self, result: AudioInputResult):
        """
        Gerencia de forma robusta e inteligente as falhas de escuta.
        
        Diferencia falhas de hardware, rede, fala incompreendida e silêncio total.
        """
        status = result.status
        max_failures = config.MAX_CONSECUTIVE_FAILURES

        if status == AudioResult.TIMEOUT:
            # Silêncio absoluto do idoso: possível emergência
            self.consecutive_failures += 1
            logging.warning(f"Silêncio detectado (Timeout #{self.consecutive_failures} de {max_failures}).")

            if self.consecutive_failures == max_failures - 2:
                warning_msg = "Olá? Você ainda está por aí?"
                logging.info(f"Emitindo primeiro aviso de inatividade: '{warning_msg}'")
                self.audio_handler.speak(warning_msg)
            elif self.consecutive_failures == max_failures - 1:
                warning_msg = "Por favor, diga alguma coisa se puder me ouvir. Caso contrário, precisarei chamar ajuda."
                logging.info(f"Emitindo aviso crítico de inatividade: '{warning_msg}'")
                self.audio_handler.speak(warning_msg)
            elif self.consecutive_failures >= max_failures:
                self.emergency_manager.trigger_alert()
                self.is_running = False  # Interrompe a aplicação após o alerta

        elif status == AudioResult.UNINTELLIGIBLE:
            # Ruído ou fala inaudível detectada: significa que o idoso está ativo.
            self.consecutive_failures = 0
            feedback_msg = "Desculpe, não consegui te ouvir bem. Você pode repetir?"
            logging.info("Som detectado mas não transcrito. Resetando contador de emergência e pedindo repetição.")
            self.audio_handler.speak(feedback_msg)

        elif status == AudioResult.NETWORK_ERROR:
            # Queda de conexão de rede com a API do Google
            logging.error(f"Erro de rede no STT: {result.error_message}. Emergência suspensa.")
            network_msg = "Estou com dificuldades para me conectar à internet. Por favor, verifique minha conexão."
            self.audio_handler.speak(network_msg)

        elif status == AudioResult.HARDWARE_ERROR:
            # Microfone desconectado ou falha de driver
            logging.critical(f"Falha de hardware de áudio: {result.error_message}. Emergência suspensa.")
            hardware_msg = "Acho que meu microfone foi desconectado. Por favor, verifique meus cabos."
            self.audio_handler.speak(hardware_msg)

    def _check_medication_queue(self):
        """Verifica a fila de medicamentos de forma não-bloqueante."""
        try:
            event = self.reminder_queue.get_nowait()
            if event and event.get("type") == "medication_reminder":
                self._process_medication_reminder(event["medication"])
        except queue.Empty:
            pass

    def _process_medication_reminder(self, med: dict):
        """Orquestra o diálogo interativo de remédio por voz e confirma com IA."""
        med_id = med["id"]
        med_name = med["name"]
        med_dosage = med["dosage"]
        
        prompt = f"Olá! Está na hora de tomar o {med_name} de {med_dosage}. Você já tomou?"
        logging.info(f"Iniciando prompt de lembrete de remédio por voz: '{med_name}'")
        self.audio_handler.speak(prompt)
        
        # Abre o microfone para escuta da resposta do idoso
        audio_result = self.audio_handler.listen()
        
        if audio_result and audio_result.status == AudioResult.SUCCESS and audio_result.text:
            # Intercepta palavras de SOS no spotter durante lembrete
            if self.audio_handler.contains_sos_keywords(audio_result.text):
                logging.critical(f"Palavra-chave crítica de SOS detectada durante lembrete de medicação: '{audio_result.text}'")
                self.audio_handler.speak("Entendido. Acionando emergência imediatamente.")
                self.emergency_manager.trigger_alert(reason="comando_voz")
                self.is_running = False
                return
                
            # Classifica a resposta usando Ollama
            ingress_status = self._classify_medication_response(audio_result.text)
            
            if ingress_status == "SIM":
                logging.info(f"Confirmado: idoso ingeriu o medicamento {med_name}.")
                self._confirm_medication_ingestion(med_id)
                self.audio_handler.speak("Ótimo, registrado!")
            elif ingress_status == "NAO":
                logging.info(f"Rejeitado: idoso não ingeriu o medicamento {med_name}. Reagendando em 5 minutos.")
                self.audio_handler.speak("Tudo bem. Lembre-se de tomar. Te perguntarei novamente daqui a pouco.")
            else:
                logging.info(f"Resposta inconclusiva ('{audio_result.text}') para o medicamento {med_name}. Reagendando em 5 minutos.")
                self.audio_handler.speak("Não entendi muito bem. Lembre-se de tomar seu remédio. Vou te perguntar de novo mais tarde.")
        else:
            logging.warning(f"Sem resposta audível (Timeout/Erro) para o medicamento {med_name}. Reagendando em 5 minutos.")

    def _classify_medication_response(self, user_text: str) -> str:
        """Consulta o LLM Ollama para analisar a resposta e classificar o status de ingestão."""
        logging.info("Consultando o LLM para classificação do remédio...")
        system_prompt = (
            "Você é um validador lógico de texto em português. Analise a resposta do idoso "
            "sobre ter tomado o remédio e responda APENAS com uma das seguintes palavras: "
            "'SIM', 'NAO' ou 'DESCONHECIDO'. Não adicione pontuação, saudações ou explicações. "
            "Responda apenas a palavra pura."
        )
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_text}
        ]
        try:
            import ollama
            response = ollama.chat(model=self.ai_processor._model, messages=messages)
            result = response['message']['content'].strip().upper()
            # Limpeza de caracteres especiais
            result = "".join(c for c in result if c.isalnum())
            
            logging.info(f"Classificação obtida via IA: '{result}'")
            if "SIM" in result:
                return "SIM"
            elif "NAO" in result or "NÃO" in result:
                return "NAO"
            else:
                return "DESCONHECIDO"
        except Exception as e:
            logging.error(f"Erro na API do Ollama ao classificar medicação: {e}. Executando fallback local.")
            # Heurística local de fallback sênior
            text = user_text.lower()
            if any(w in text for w in ["sim", "tomei", "já", "ja", "com certeza", "ok", "tá"]):
                return "SIM"
            elif any(w in text for w in ["não", "nao", "ainda não", "depois", "recuso"]):
                return "NAO"
            return "DESCONHECIDO"

    def _confirm_medication_ingestion(self, medication_id: int):
        """Notifica o backend via PUT de que o medicamento foi ingerido com sucesso."""
        url = f"{config.API_URL}/medications/{medication_id}/confirm"
        try:
            response = requests.put(url, timeout=5)
            if response.status_code == 200:
                logging.info(f"Confirmação registrada no backend para medicamento ID {medication_id}.")
            else:
                logging.error(f"Erro ao confirmar no backend: Código HTTP {response.status_code}")
        except Exception as e:
            logging.error(f"Backend offline ao confirmar ingestão do medicamento {medication_id}: {e}")
            
        # Mesmo sob erro de rede, marcamos localmente como concluído hoje para evitar perturbação
        self.medication_worker.mark_confirmed_today(medication_id)
