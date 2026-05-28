import logging
from typing import Optional

import pyttsx3
import speech_recognition as sr
from config import LISTEN_TIMEOUT_SECONDS, LISTEN_PHRASE_TIME_LIMIT

class AudioHandler:
    \"\"\"
    Gerencia a captura de áudio (Speech-to-Text) e a síntese de voz (Text-to-Speech).

    Esta classe encapsula as bibliotecas SpeechRecognition e pyttsx3, fornecendo
    métodos limpos para falar e ouvir.
    \"\"\"

    def __init__(self):
        logging.info("Inicializando módulo de áudio...")
        
        # Text-to-Speech Engine
        try:
            self._tts_engine = pyttsx3.init()
            # Ajuste opcional de velocidade e volume pode ser feito aqui
            # self._tts_engine.setProperty('rate', 150) 
            logging.info("Motor de síntese de voz (TTS) inicializado.")
        except Exception as e:
            logging.critical(f"Falha ao inicializar motor TTS: {e}", exc_info=True)
            raise

        # Speech-to-Text Engine
        try:
            self._recognizer = sr.Recognizer()
            self._microphone = sr.Microphone()
            self._adjust_for_ambient_noise()
            logging.info("Motor de reconhecimento de fala (STT) inicializado.")
        except AttributeError as e:
             logging.critical(f"PyAudio não instalado ou configurado incorretamente: {e}", exc_info=True)
             raise
        except Exception as e:
             logging.critical(f"Falha ao inicializar microfone/STT: {e}", exc_info=True)
             raise

        logging.info("Módulo de áudio pronto.")

    def _adjust_for_ambient_noise(self):
        \"\"\"Calibra o reconhecedor de voz baseando-se no ruído ambiente atual.\"\"\"
        try:
            with self._microphone as source:
                logging.info("Calibrando microfone para o ruído ambiente. Aguarde 2 segundos...")
                self._recognizer.adjust_for_ambient_noise(source, duration=2)
                logging.info("Calibração concluída.")
        except Exception as e:
            logging.error(f"Erro durante a calibração do ruído ambiente: {e}")
            raise

    def speak(self, text: str):
        \"\"\"
        Converte texto em fala e reproduz no dispositivo de saída padrão.

        Args:
            text: A string a ser sintetizada.
        \"\"\"
        if not text:
            return
            
        logging.info(f"Sintetizando voz: '{text}'")
        try:
            self._tts_engine.say(text)
            self._tts_engine.runAndWait()
            logging.info("Reprodução de áudio concluída.")
        except Exception as e:
            logging.error(f"Erro durante a síntese/reprodução de voz: {e}", exc_info=True)

    def listen(self) -> Optional[str]:
        \"\"\"
        Ativa o microfone, captura o áudio e converte para texto.

        Returns:
            O texto transcrito em minúsculas, ou None se falhar/não houver fala.
        \"\"\"
        logging.info("Microfone aberto. Aguardando fala...")
        with self._microphone as source:
            try:
                # Ouve o áudio com limites de tempo para evitar travamentos
                audio = self._recognizer.listen(
                    source, 
                    timeout=LISTEN_TIMEOUT_SECONDS, 
                    phrase_time_limit=LISTEN_PHRASE_TIME_LIMIT
                )
                logging.info("Áudio capturado. Processando transcrição...")
                
                # Utiliza a API do Google (embutida na biblioteca) para pt-BR
                text = self._recognizer.recognize_google(audio, language='pt-BR')
                logging.info(f"Transcrição bem-sucedida: '{text}'")
                return text.lower()

            except sr.WaitTimeoutError:
                logging.warning("Timeout: Nenhum som captado dentro do limite de tempo.")
                return None
            except sr.UnknownValueError:
                logging.warning("Áudio ininteligível: A fala não pôde ser transcrita.")
                return None
            except sr.RequestError as e:
                logging.error(f"Erro no serviço de reconhecimento de fala (falha de rede?): {e}")
                return None
            except Exception as e:
                logging.critical(f"Erro crítico e inesperado durante a escuta: {e}", exc_info=True)
                return None
