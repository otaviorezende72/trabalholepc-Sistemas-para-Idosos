# -*- coding: utf-8 -*-

"""
================================================================================
=== Aurora - Assistente de Voz Preventivo para Idosos (MVP) ===================
================================================================================

Arquitetura e Stack:
- Linguagem: Python 3.10+
- Cérebro (LLM): Ollama (llama3)
- Ouvir (STT): SpeechRecognition + PyAudio
- Falar (TTS): pyttsx3

Este script implementa um assistente de voz completo que opera localmente,
garantindo privacidade e baixa latência. Ele foi projetado para ser robusto,
modular e fácil de manter.

================================================================================
=== GUIA DE INSTALAÇÃO E EXECUÇÃO ==============================================
================================================================================

1. Instalação do Ollama:
   - Acesse: https://ollama.com/
   - Baixe e instale o Ollama para o seu sistema operacional.
   - Abra o terminal e execute o seguinte comando para baixar e carregar o modelo Llama 3:
     ollama run llama3

2. Instalação das dependências Python:
   - Certifique-se de ter o Python 3.10 ou superior instalado.
   - Abra o terminal e execute o comando abaixo para instalar todas as bibliotecas necessárias:
     pip install ollama speechrecognition pyttsx3 pyaudio

3. Execução do Script:
   - Mantenha o terminal com o Ollama (passo 1) em execução.
   - Em um novo terminal, navegue até o diretório onde este arquivo foi salvo e execute:
     python aurora_assistant.py

"""

import logging
import sys
from typing import List, Dict, Optional

import ollama
import pyttsx3
import speech_recognition as sr

# --- Configuração de Logging ---
# Configura um logger para exibir informações claras sobre o estado da aplicação.
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(levelname)s] - %(message)s',
    stream=sys.stdout,
)


# --- Constantes de Negócio ---
SYSTEM_PROMPT = (
    "Você é 'Aurora', uma assistente de saúde virtual amigável que cuida de "
    "idosos que moram sozinhos. Regra de Ouro: Suas respostas devem ser "
    "extremamente curtas (no máximo 2 frases breves), diretas, carinhosas e "
    "fáceis de entender. Nunca use jargões técnicos. Responda sempre em "
    "português do Brasil."
)
# Tempo em segundos que o sistema aguarda por uma fala antes de desistir.
LISTEN_TIMEOUT_SECONDS = 10
# Número de tentativas de escuta sem sucesso antes de acionar o alerta.
MAX_CONSECUTIVE_FAILURES = 3


class AIProcessor:
    """
    Módulo de Inteligência Artificial.
    Gerencia a comunicação com o LLM (Ollama) e o histórico da conversa.
    """

    def __init__(self, model: str = 'llama3'):
        self._model = model
        self._history: List[Dict[str, str]] = [{'role': 'system', 'content': SYSTEM_PROMPT}]
        logging.info("Módulo de IA inicializado com o modelo: %s", self._model)

    def get_response(self, user_text: str) -> str:
        """
        Envia o texto do usuário para o LLM e obtém uma resposta.

        Args:
            user_text: O texto transcrito da fala do usuário.

        Returns:
            A resposta gerada pelo LLM.
        """
        logging.info("Consultando o Llama 3...")
        self._history.append({'role': 'user', 'content': user_text})

        try:
            response = ollama.chat(model=self._model, messages=self._history)
            ai_response = response['message']['content']
            self._history.append({'role': 'assistant', 'content': ai_response})
            logging.info("Resposta da IA recebida.")
            return ai_response

        except ollama.ResponseError as e:
            logging.error("Erro de resposta do Ollama: %s", e.error)
            logging.error(
                "Verifique se o servidor do Ollama está em execução e o modelo '%s' foi baixado.",
                self._model
            )
            return "Desculpe, estou com um problema na minha conexão interna. Tente novamente mais tarde."
        except Exception as e:
            logging.critical("Erro inesperado ao contatar o Ollama: %s", e)
            return "Ocorreu um erro grave no meu sistema. Por favor, reinicie a aplicação."


class AudioHandler:
    """
    Módulo de Áudio.
    Gerencia a captura de áudio (STT) e a síntese de voz (TTS).
    """

    def __init__(self):
        logging.info("Inicializando módulo de áudio...")
        # TTS Engine
        self._tts_engine = pyttsx3.init()

        # STT Engine
        self._recognizer = sr.Recognizer()
        self._microphone = sr.Microphone()
        self._adjust_for_ambient_noise()
        logging.info("Módulo de áudio pronto.")

    def _adjust_for_ambient_noise(self):
        """Ajusta o reconhecedor de voz para o ruído ambiente."""
        try:
            with self._microphone as source:
                logging.info("Ajustando para o ruído ambiente, por favor, aguarde...")
                self._recognizer.adjust_for_ambient_noise(source, duration=2)
                logging.info("Ajuste de ruído concluído.")
        except Exception as e:
            logging.error("Microfone não encontrado ou erro ao ajustar ruído: %s", e)
            raise

    def speak(self, text: str):
        """
        Converte texto em fala e o reproduz.

        Args:
            text: O texto a ser falado.
        """
        logging.info("Sintetizando voz para: '%s'", text)
        try:
            self._tts_engine.say(text)
            self._tts_engine.runAndWait()
            logging.info("Fala concluída.")
        except Exception as e:
            logging.error("Erro durante a síntese de voz: %s", e)

    def listen(self) -> Optional[str]:
        """
        Escuta o áudio do microfone e o converte em texto.

        Returns:
            O texto transcrito ou None se a escuta falhar.
        """
        logging.info("Aguardando áudio...")
        with self._microphone as source:
            try:
                audio = self._recognizer.listen(source, timeout=LISTEN_TIMEOUT_SECONDS, phrase_time_limit=5)
                logging.info("Áudio capturado, processando...")
                text = self._recognizer.recognize_google(audio, language='pt-BR')
                logging.info("Texto reconhecido: '%s'", text)
                return text.lower()

            except sr.WaitTimeoutError:
                logging.warning("Nenhum áudio detectado (timeout).")
                return None
            except sr.UnknownValueError:
                logging.warning("Não foi possível entender o áudio.")
                return None
            except sr.RequestError as e:
                logging.error("Erro na API de reconhecimento de fala: %s", e)
                return None
            except Exception as e:
                logging.critical("Erro inesperado durante a escuta: %s", e)
                return None


def trigger_emergency_alert():
    """
    Função de gatilho de emergência.
    Interrompe o sistema e loga um alerta crítico.
    """
    critical_message = "[ALERTA VERMELHO] Ausência de resposta detectada. Acionando familiares..."
    logging.critical(critical_message)
    # Em um sistema real, aqui entraria a lógica para enviar SMS, ligar para contatos, etc.
    print(critical_message, file=sys.stderr)


def main():
    """
    Loop principal da aplicação.
    Orquestra a inicialização, escuta, processamento e resposta.
    """
    try:
        ai_processor = AIProcessor()
        audio_handler = AudioHandler()
    except Exception as e:
        logging.critical("Falha na inicialização de um módulo principal: %s. Encerrando.", e)
        sys.exit(1)

    consecutive_failures = 0

    # Saudação inicial
    initial_greeting = "Olá! Eu sou Aurora, sua assistente. Como você está se sentindo hoje?"
    audio_handler.speak(initial_greeting)

    while True:
        user_input = audio_handler.listen()

        if user_input:
            consecutive_failures = 0  # Reseta o contador em caso de sucesso
            if "desligar" in user_input or "parar" in user_input:
                audio_handler.speak("Entendido. Desligando. Até logo!")
                break

            ai_response = ai_processor.get_response(user_input)
            audio_handler.speak(ai_response)
        else:
            consecutive_failures += 1
            logging.warning("Falha de escuta #%d de %d.", consecutive_failures, MAX_CONSECUTIVE_FAILURES)

            if consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
                trigger_emergency_alert()
                break  # Interrompe o loop principal


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logging.info("Aplicação interrompida pelo usuário. Desligando...")
    except Exception as e:
        logging.critical("Uma exceção não tratada ocorreu no loop principal: %s", e)
    finally:
        logging.info("Sistema Aurora finalizado.")
        sys.exit(0)
