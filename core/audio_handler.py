import logging
import os
import asyncio
from typing import Optional
from dataclasses import dataclass

# Desativa o banner de boas-vindas do pygame no stdout
os.environ['PYGAME_HIDE_SUPPORT_PROMPT'] = '1'
import pygame
import speech_recognition as sr
import edge_tts

from config import LISTEN_TIMEOUT_SECONDS, LISTEN_PHRASE_TIME_LIMIT

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
    Utiliza edge-tts para síntese neural realista e pygame.mixer para reprodução thread-safe.
    """

    def __init__(self):
        logging.info("Inicializando módulo de áudio...")
        
        # Inicializa o mixer do pygame para reprodução de áudio
        try:
            if not pygame.mixer.get_init():
                pygame.mixer.init()
            logging.info("Motor de síntese de voz (Pygame Mixer) inicializado com sucesso.")
        except Exception as e:
            logging.critical(f"Falha ao inicializar Pygame Mixer: {e}", exc_info=True)
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

    def _play_audio_file(self, file_path: str):
        """Reproduz um arquivo de áudio usando pygame de forma thread-safe."""
        import time
        try:
            pygame.mixer.music.load(file_path)
            pygame.mixer.music.play()
            while pygame.mixer.music.get_busy():
                time.sleep(0.05)
            pygame.mixer.music.unload()
        except Exception as e:
            logging.error(f"Erro na reprodução do arquivo de áudio {file_path}: {e}")
            raise

    def speak(self, text: str):
        """
        Converte texto em fala usando edge-tts e reproduz no dispositivo de saída padrão.
        Utiliza a voz pt-BR-FranciscaNeural para uma experiência de fala neural e realista.

        Args:
            text: A string a ser sintetizada.
        """
        if not text:
            return
            
        logging.info(f"Sintetizando voz: '{text}'")
        
        import tempfile
        
        # Cria arquivo temporário de forma segura
        temp_fd, temp_path = tempfile.mkstemp(suffix=".mp3")
        os.close(temp_fd)
        
        try:
            async def _generate_audio():
                communicate = edge_tts.Communicate(text, "pt-BR-FranciscaNeural")
                await communicate.save(temp_path)
                
            asyncio.run(_generate_audio())
            self._play_audio_file(temp_path)
            logging.info("Reprodução de áudio neural concluída com sucesso.")
        except Exception as e:
            logging.error(f"Erro durante a geração/reprodução de voz neural (edge-tts): {e}", exc_info=True)
            # Fallback de Imersão (Zero Robôs)
            logging.info("Iniciando reprodução de fallback (sem internet)...")
            fallback_file = "assets/sem_internet.mp3"
            if os.path.exists(fallback_file):
                try:
                    self._play_audio_file(fallback_file)
                except Exception as fb_err:
                    logging.error(f"Erro ao reproduzir áudio de fallback '{fallback_file}': {fb_err}", exc_info=True)
            else:
                logging.warning(f"Arquivo de fallback '{fallback_file}' não encontrado.")
        finally:
            # Limpeza do arquivo temporário
            try:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
            except Exception as rm_err:
                logging.error(f"Erro ao remover arquivo temporário '{temp_path}': {rm_err}")

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
