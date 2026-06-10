import logging
import queue
import time
import requests
import config
from datetime import datetime
from core.ai_processor import AIProcessor
from core.audio_handler import AudioHandler, AudioResult, AudioInputResult
from core.emergency_manager import EmergencyManager
from core.ws_client import LyraWebSocketClient
from core.medication_worker import MedicationWorker

class Application:
    """
    Classe principal que orquestra a aplicação do assistente de voz Lyra.
    
    Ela coordena os módulos de IA, áudio, emergência e o cliente de WebSocket,
    gerenciando o loop principal de áudio e verificações de medicamentos,
    janelas de sono e ausência em paralelo.
    """

    def __init__(self):
        logging.info("Iniciando a aplicação Lyra...")
        try:
            # Inicializa a fila e a thread de monitoramento de medicamentos
            self.reminder_queue = queue.Queue()
            self.medication_worker = MedicationWorker(reminder_queue=self.reminder_queue)
            self.medication_worker.start()

            # Inicializa a conexão de segundo plano via WebSocket passando a fila
            self.ws_client = LyraWebSocketClient(reminder_queue=self.reminder_queue)
            self.ws_client.start()

            self.ai_processor = AIProcessor()
            self.audio_handler = AudioHandler()
            self.emergency_manager = EmergencyManager(ws_client=self.ws_client)
            self.consecutive_failures = 0
            self.is_running = False
            
            # Estados locais para controle do período de ausência
            self.away_start_time = None
            self.away_end_time = None
            self.reconciliation_scheduled_time = None
            
        except Exception as e:
            logging.critical(f"Falha crítica durante a inicialização dos módulos: {e}", exc_info=True)
            if hasattr(self, 'ws_client') and self.ws_client:
                self.ws_client.stop()
            if hasattr(self, 'medication_worker') and self.medication_worker:
                self.medication_worker.stop()
            raise

    def run(self):
        """Inicia o loop principal de interação do assistente."""
        self.is_running = True
        self._greet()

        try:
            while self.is_running:
                # 1. Checa a fila de lembretes proativos e status de ausência
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

    def _is_in_sleep_window(self) -> bool:
        """Verifica se o horário atual está dentro de alguma janela de sono configurada."""
        try:
            resp = requests.get(f"{config.API_URL}/settings", timeout=2.0)
            if resp.status_code == 200:
                settings = resp.json()
                sleep_start_night = settings.get("sleep_start_night", "22:00")
                sleep_end_night = settings.get("sleep_end_night", "07:00")
                sleep_start_afternoon = settings.get("sleep_start_afternoon", "13:30")
                sleep_end_afternoon = settings.get("sleep_end_afternoon", "15:30")
            else:
                sleep_start_night = "22:00"
                sleep_end_night = "07:00"
                sleep_start_afternoon = "13:30"
                sleep_end_afternoon = "15:30"
        except Exception:
            sleep_start_night = "22:00"
            sleep_end_night = "07:00"
            sleep_start_afternoon = "13:30"
            sleep_end_afternoon = "15:30"

        now_time = datetime.now().time()
        
        def is_time_between(start_str, end_str, check_time):
            try:
                start = datetime.strptime(start_str.strip(), "%H:%M").time()
                end = datetime.strptime(end_str.strip(), "%H:%M").time()
            except Exception:
                return False
            if start <= end:
                return start <= check_time <= end
            else:
                return check_time >= start or check_time <= end

        in_night = is_time_between(sleep_start_night, sleep_end_night, now_time)
        in_afternoon = is_time_between(sleep_start_afternoon, sleep_end_afternoon, now_time)
        
        return in_night or in_afternoon

    def _handle_audio_failure(self, result: AudioInputResult):
        """Gerencia falhas de escuta chamando o motor lógico de inatividade."""
        self.worker_detecao_inatividade(result)

    def worker_detecao_inatividade(self, result: AudioInputResult):
        """Gerencia falhas de escuta (inatividade), respeitando status de ausência e janelas de sono."""
        if getattr(config, "IS_AWAY", False):
            logging.info("Idoso está ausente (is_away=True). Silenciando verificação de inatividade.")
            return

        if self._is_in_sleep_window():
            logging.info("Idoso está em período de sono configurado. Ignorando contagem de inatividade.")
            return

        status = result.status
        max_failures = config.MAX_CONSECUTIVE_FAILURES

        if status == AudioResult.TIMEOUT:
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
                self.is_running = False

        elif status == AudioResult.UNINTELLIGIBLE:
            self.consecutive_failures = 0
            feedback_msg = "Desculpe, não consegui te ouvir bem. Você pode repetir?"
            logging.info("Som detectado mas não transcrito. Resetando contador de emergência e pedindo repetição.")
            self.audio_handler.speak(feedback_msg)

        elif status == AudioResult.NETWORK_ERROR:
            logging.error(f"Erro de rede no STT: {result.error_message}. Emergência suspensa.")
            network_msg = "Estou com dificuldades para me conectar à internet. Por favor, verifique minha conexão."
            self.audio_handler.speak(network_msg)

        elif status == AudioResult.HARDWARE_ERROR:
            logging.critical(f"Falha de hardware de áudio: {result.error_message}. Emergência suspensa.")
            hardware_msg = "Acho que meu microfone foi desconectado. Por favor, verifique meus cabos."
            self.audio_handler.speak(hardware_msg)

    def _check_medication_queue(self):
        """Verifica a fila de medicamentos e status de forma não-bloqueante."""
        try:
            while not self.reminder_queue.empty():
                event = self.reminder_queue.get_nowait()
                if event and event.get("type") == "medication_reminder":
                    med = event["medication"]
                    if self._is_in_sleep_window() and not med.get("critical", False):
                        logging.info(f"Lembrete de remédio não crítico {med['name']} ignorado na janela de sono.")
                    else:
                        self._process_medication_reminder(med)
                elif event and event.get("type") == "status_change":
                    self._handle_status_change(event["is_away"])
                self.reminder_queue.task_done()
        except queue.Empty:
            pass

        # Executa conciliação se tiver passado o delay e estiver agendada
        if self.reconciliation_scheduled_time and time.time() >= self.reconciliation_scheduled_time:
            self.reconciliation_scheduled_time = None
            self._reconcile_medications()

    def _handle_status_change(self, is_away: bool):
        """Dispara feedback por voz e fluxo de retorno de medicamentos pós-ausência."""
        if is_away:
            self.audio_handler.speak("Modo ausente ativado, monitoramento pausado.")
            self.away_start_time = datetime.now()
            # Cancela conciliação agendada se houver
            self.reconciliation_scheduled_time = None
        else:
            self.audio_handler.speak("Seja bem-vindo de volta! Reativando monitoramento.")
            self.away_end_time = datetime.now()
            
            # Agenda a conciliação de medicamentos de forma não-bloqueante
            delay = getattr(config, "RECONCILIATION_DELAY", 120)
            logging.info(f"Conciliação de medicamentos agendada para daqui a {delay} segundos...")
            self.reconciliation_scheduled_time = time.time() + delay

    def _reconcile_medications(self):
        """Verifica se algum remédio teve o horário vencido durante a ausência e inicia conciliação."""
        if not self.away_start_time or not self.away_end_time:
            return

        logging.info("Iniciando conciliação de medicamentos pós-retorno...")
        try:
            resp = requests.get(f"{config.API_URL}/medications", timeout=5.0)
            if resp.status_code != 200:
                logging.error("Erro ao buscar medicamentos para conciliação.")
                return
            all_meds = resp.json()
        except Exception as e:
            logging.error(f"Erro ao contatar o backend para conciliação: {e}")
            return

        pending_meds = []
        for med in all_meds:
            if med.get("active") and med.get("status") != "tomado":
                med_time_str = med.get("time") # ex: "08:00"
                try:
                    med_hour, med_minute = map(int, med_time_str.strip().split(':'))
                    
                    # Verifica cada dia no intervalo de ausência (geralmente cobrindo travessia de dias)
                    current_date = self.away_start_time.date()
                    end_date = self.away_end_time.date()
                    import datetime as dt_module
                    
                    is_missed = False
                    while current_date <= end_date:
                        med_dt = datetime.combine(current_date, dt_module.time(hour=med_hour, minute=med_minute))
                        if self.away_start_time <= med_dt <= self.away_end_time:
                            is_missed = True
                            break
                        current_date += dt_module.timedelta(days=1)
                    
                    if is_missed:
                        pending_meds.append(med)
                except Exception as e:
                    logging.error(f"Erro ao analisar horário do medicamento {med.get('name')}: {e}")
                    continue

        # Limpa os estados locais de ausência para a próxima transição
        self.away_start_time = None
        self.away_end_time = None

        if not pending_meds:
            logging.info("Nenhum medicamento pendente durante a ausência.")
            return

        if len(pending_meds) == 1:
            msg = (
                "Olá, que bom que o senhor voltou! Vi aqui no meu sistema que passamos do horário de um remédio "
                f"enquanto o senhor estava fora. O senhor conseguiu tomar o {pending_meds[0]['name']} na rua?"
            )
        else:
            names = ", ".join(m['name'] for m in pending_meds[:-1]) + f" e {pending_meds[-1]['name']}"
            msg = (
                "Olá, que bom que o senhor voltou! Vi aqui no meu sistema que passamos do horário de alguns remédios "
                f"enquanto o senhor estava fora. O senhor conseguiu tomar o {names} na rua?"
            )

        self.audio_handler.speak(msg)
        audio_result = self.audio_handler.listen()
        
        if audio_result.status == AudioResult.SUCCESS and audio_result.text:
            classification = self._classify_medication_response(audio_result.text)
            if classification == "SIM":
                self.audio_handler.speak("Ótimo, registrado!")
                for med in pending_meds:
                    self._confirm_medication_ingestion(med["id"])
            elif classification == "NAO":
                self.audio_handler.speak("Tudo bem. Lembre-se de tomar agora, por favor.")
            else:
                self.audio_handler.speak("Não entendi muito bem. Por favor, verifique seus remédios no aplicativo.")

    def _process_medication_reminder(self, med: dict):
        """Orquestra o diálogo interativo de remédio por voz e confirma com IA."""
        med_id = med["id"]
        med_name = med["name"]
        med_dosage = med["dosage"]
        critical = med.get("critical", False)
        
        # Obtém o nome do idoso do backend
        elder_name = "Senhor"
        try:
            resp = requests.get(f"{config.API_URL}/settings", timeout=2.0)
            if resp.status_code == 200:
                elder_name = resp.json().get("elder_name", "Senhor")
        except Exception:
            pass

        # Se for janela de sono e crítico, chama acordando pelo nome
        if self._is_in_sleep_window() and critical:
            prompt = f"Atenção, {elder_name}! Desculpe interromper seu sono, mas está na hora do seu medicamento crítico: {med_name} de {med_dosage}. Você já tomou?"
        else:
            prompt = f"Olá, {elder_name}! Está na hora de tomar o {med_name} de {med_dosage}. Você já tomou?"

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
            import re
            text_clean = re.sub(r'[^\w\s]', ' ', user_text.lower())
            text_clean = " ".join(text_clean.split())
            
            def has(pattern):
                return bool(re.search(rf"\b{re.escape(pattern)}\b", text_clean))
            
            # 1. Confirmações fortes (priorizadas para evitar falsos negativos por fusão de palavras)
            strong_confirmations = [
                "tomei sim", "tomei ja", "tomei já", "tomei tudo",
                "sim tomei", "sim ja tomei", "sim já tomei", "sim eu tomei"
            ]
            if any(has(sc) for sc in strong_confirmations):
                return "SIM"
            
            # 2. Casos diretos de negação com verbo ou contexto temporal
            if has("não tomei") or has("nao tomei") or has("tomei não") or has("tomei nao") or has("ainda não") or has("ainda nao"):
                return "NAO"
            
            # 3. Outras expressões de recusa/esquecimento/atraso
            if has("esqueci") or has("depois") or has("mais tarde") or has("recuso") or has("não quero") or has("nao quero"):
                return "NAO"
            
            # 4. Confirmações gerais
            if has("sim") or has("tomei") or has("tome") or has("já") or has("ja") or has("com certeza") or has("ok") or has("tá") or has("ta"):
                return "SIM"
            
            # 5. Negação simples isolada
            if has("não") or has("nao"):
                return "NAO"
            
            return "DESCONHECIDO"

    def _confirm_medication_ingestion(self, medication_id: int):
        """Notifica o backend via PUT de que o medicamento foi ingerido com sucesso."""
        url = f"{config.API_URL}/medications/{medication_id}/confirm"
        try:
            response = requests.put(url, headers={"X-Device-Token": config.DEVICE_TOKEN}, timeout=5)

            if response.status_code == 200:
                logging.info(f"Confirmação registrada no backend para medicamento ID {medication_id}.")
            else:
                logging.error(f"Erro ao confirmar no backend: Código HTTP {response.status_code}")
        except Exception as e:
            logging.error(f"Backend offline ao confirmar ingestão do medicamento {medication_id}: {e}")
            
        self.medication_worker.mark_confirmed_today(medication_id)
