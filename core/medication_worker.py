import logging
import threading
import time
import requests
import queue
import config

class MedicationWorker(threading.Thread):
    """
    Trabalhador em segundo plano que monitora a agenda de medicamentos ativos.
    
    Busca os dados via API REST e agenda lembretes de voz de forma não concorrente,
    enfileirando os eventos de áudio na fila da thread principal.
    """

    def __init__(self, reminder_queue: queue.Queue):
        super().__init__(name="MedicationWorker", daemon=True)
        self.reminder_queue = reminder_queue
        self.is_running = False
        
        # Estruturas de controle de tentativas e estados
        self.confirmed_today = set()  # Armazena tuplas: (medication_id, date_str)
        self.last_attempt_times = {}  # Mapeia: medication_id -> timestamp (float)
        self.attempt_counts = {}      # Mapeia: medication_id -> count (int)
        
        logging.info("MedicationWorker configurado com sucesso.")

    def start(self):
        self.is_running = True
        super().start()
        logging.info("MedicationWorker iniciado em segundo plano.")

    def stop(self):
        self.is_running = False
        logging.info("MedicationWorker finalizando...")

    def mark_confirmed_today(self, medication_id: int):
        """Marca o medicamento como ingerido hoje, cancelando novos lembretes."""
        today_str = time.strftime("%Y-%m-%d")
        self.confirmed_today.add((medication_id, today_str))
        # Reseta contador de tentativas
        self.attempt_counts[medication_id] = 0
        logging.info(f"[MedicationWorker] Medicamento {medication_id} marcado como tomado hoje ({today_str}).")

    def run(self):
        while self.is_running:
            try:
                self._check_schedule()
            except Exception as e:
                logging.error(f"[MedicationWorker] Erro inesperado no ciclo de checagem: {e}")
            
            # Aguarda 30 segundos antes do próximo ciclo de checagem
            time.sleep(30)

    def _check_schedule(self):
        """Busca a agenda do backend e agenda os lembretes do horário."""
        today_str = time.strftime("%Y-%m-%d")
        current_time = time.strftime("%H:%M")  # ex: "08:00"
        
        # 1. Busca medicamentos ativos do backend
        meds = self._fetch_medications()
        if not meds:
            return
            
        for med in meds:
            # Pula se o medicamento não estiver marcado como ativo
            if not med.get("active", True):
                continue
                
            med_id = med["id"]
            med_name = med["name"]
            med_time = med["time"]  # ex: "08:00"
            
            # Pula se já tiver sido confirmado hoje
            if (med_id, today_str) in self.confirmed_today:
                continue
                
            # Verifica se bate com a hora atual do sistema
            if med_time == current_time:
                last_attempt = self.last_attempt_times.get(med_id, 0)
                now = time.time()
                
                # Se ainda não tentou hoje ou se já se passaram 5 minutos (300 segundos) desde a última tentativa
                if now - last_attempt > 300:
                    attempts = self.attempt_counts.get(med_id, 0)
                    
                    if attempts >= 3:
                        # Excedeu o limite de tentativas sem resposta / confirmada como NAO
                        logging.warning(f"[MedicationWorker] Limite de tentativas excedido para {med_name}. Disparando alerta de falta.")
                        self._trigger_missed_medication_alert(med)
                        # Marca como finalizado hoje para evitar loops infinitos de alertas
                        self.confirmed_today.add((med_id, today_str))
                    else:
                        # Incrementa tentativas e enfileira para a thread principal interagir por voz
                        self.attempt_counts[med_id] = attempts + 1
                        self.last_attempt_times[med_id] = now
                        logging.info(f"[MedicationWorker] Enfileirando lembrete de remédio: {med_name} (Tentativa #{self.attempt_counts[med_id]})")
                        self.reminder_queue.put({
                            "type": "medication_reminder",
                            "medication": med
                        })

    def _fetch_medications(self):
        """Busca a lista de medicamentos via GET http://localhost:8000/medications."""
        url = f"{config.API_URL}/medications"
        try:
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                return response.json()
            else:
                logging.error(f"[MedicationWorker] Erro ao buscar medicamentos: Código HTTP {response.status_code}")
                return None
        except requests.exceptions.RequestException as e:
            logging.error(f"[MedicationWorker] Backend FastAPI fora do ar ao buscar medicamentos: {e}")
            return None

    def _trigger_missed_medication_alert(self, med: dict):
        """Dispara um alerta moderado no backend para avisar o familiar."""
        url = f"{config.API_URL}/alerts"
        payload = {
            "type": f"MEDICATION_MISSED: {med['name']} ({med['dosage']})",
            "resolved": False
        }
        try:
            response = requests.post(url, json=payload, timeout=5)
            if response.status_code in [200, 201]:
                logging.info(f"[MedicationWorker] Alerta de medicação não tomada enviado com sucesso.")
            else:
                logging.error(f"[MedicationWorker] Erro ao enviar alerta: Código HTTP {response.status_code}")
        except requests.exceptions.RequestException as e:
            logging.error(f"[MedicationWorker] Backend FastAPI fora do ar ao enviar alerta: {e}")
