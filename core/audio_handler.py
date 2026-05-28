import logging
from typing import Optional
from dataclasses import dataclass

import pyttsx3
import speech_recognition as sr
from config import LISTEN_TIMEOUT_SECONDS, LISTEN_PHRASE_TIME_LIMIT, TTS_RATE, TTS_VOLUME

class AudioResult:
    SUCCESS = "success"
    TIMEOUT = "timeout"
    UNINTELLIGIBLE = "unintelligible"
    NETWORK_ERROR = "network_error"
    HARDWARE_ERROR = "hardware_error"

@dataclass
class AudioInputResult:
    text: Optional[str]
    status: str
    error_message: Optional[str] = None

class AudioHandler:
    """
    Gerencia a captura de áudio (Speech-to-Text) e a síntese de voz (Text-to-Speech).

    Esta classe encapsula as bibliotecas SpeechRecognition e pyttsx3, fornecendo
    métodos limpos para falar e ouvir.
    """

    def __init__(self):
        logging.info("Inicializando módulo de áudio...")
        
        # Text-to-Speech Engine
        try:
            self._tts_engine = pyttsx3.init()
            # Ajuste de velocidade e volume configurados para idosos
            self._tts_engine.setProperty('rate', TTS_RATE)
            self._tts_engine.setProperty('volume', TTS_VOLUME)
            logging.info(f"Motor de síntese de voz (TTS) inicializado (Velocidade: {TTS_RATE}, Volume: {TTS_VOLUME}).")
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
        """Calibra o reconhecedor de voz baseando-se no ruído ambiente atual."""
        try:
            with self._microphone as source:
                logging.info("Calibrando microfone para o ruído ambiente. Aguarde 1 segundo...")
                self._recognizer.adjust_for_ambient_noise(source, duration=1)
                logging.info("Calibração concluída.")
        except Exception as e:
            logging.error(f"Erro durante a calibração do ruído ambiente: {e}")
            raise

    def speak(self, text: str):
        """
        Converte texto em fala e reproduz no dispositivo de saída padrão.

        Args:
            text: A string a ser sintetizada.
        """
        if not text:
            return
            
        logging.info(f"Sintetizando voz: '{text}'")
        try:
            self._tts_engine.say(text)
            self._tts_engine.runAndWait()
            logging.info("Reprodução de áudio concluída.")
        except Exception as e:
            logging.error(f"Erro durante a síntese/reprodução de voz: {e}", exc_info=True)

    def listen(self) -> AudioInputResult:
        """
        Ativa o microfone, captura o áudio e converte para texto.

        Returns:
            Um objeto AudioInputResult contendo o status e o texto transcrito em caso de sucesso.
        """
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
                return AudioInputResult(text=text.lower(), status=AudioResult.SUCCESS)

            except sr.WaitTimeoutError:
                logging.warning("Timeout: Nenhum som captado dentro do limite de tempo.")
                return AudioInputResult(text=None, status=AudioResult.TIMEOUT)
            except sr.UnknownValueError:
                logging.warning("Áudio ininteligível: A fala não pôde ser transcrita.")
                return AudioInputResult(text=None, status=AudioResult.UNINTELLIGIBLE)
            except sr.RequestError as e:
                logging.error(f"Erro no serviço de reconhecimento de fala (falha de rede?): {e}")
                return AudioInputResult(text=None, status=AudioResult.NETWORK_ERROR, error_message=str(e))
            except Exception as e:
                logging.critical(f"Erro crítico e inesperado durante a escuta: {e}", exc_info=True)
                return AudioInputResult(text=None, status=AudioResult.HARDWARE_ERROR, error_message=str(e))

    def contains_sos_keywords(self, text: str) -> bool:
        """
        Verifica se o texto contém palavras-chave críticas de emergência (Spotter de Voz).
        """
        if not text:
            return False
        sos_keywords = ["socorro", "ajuda", "me ajuda", "eu caí", "passando mal", "emergência", "socorram"]
        return any(keyword in text.lower() for keyword in sos_keywords)
