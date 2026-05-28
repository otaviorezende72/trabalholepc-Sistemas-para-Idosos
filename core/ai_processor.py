import logging
from typing import List, Dict

import ollama
from config import AI_MODEL, SYSTEM_PROMPT

class AIProcessor:
    \"\"\"
    Gerencia a interação com o Large Language Model (LLM) via Ollama.

    Esta classe encapsula o histórico da conversa e a lógica para obter
    respostas do modelo de IA, tratando os erros de comunicação.
    \"\"\"

    def __init__(self):
        self._model = AI_MODEL
        self._history: List[Dict[str, str]] = [{'role': 'system', 'content': SYSTEM_PROMPT}]
        logging.info(f"Módulo de IA inicializado com o modelo: {self._model}")

    def get_response(self, user_text: str) -> str:
        \"\"\"
        Envia o texto do usuário para o LLM e retorna a resposta.

        Args:
            user_text: O texto transcrito da fala do usuário.

        Returns:
            A resposta gerada pelo LLM ou uma mensagem de erro padrão.
        \"\"\"
        logging.info("Consultando o LLM...")
        self._history.append({'role': 'user', 'content': user_text})

        try:
            response = ollama.chat(model=self._model, messages=self._history)
            ai_response = response['message']['content']
            self._history.append({'role': 'assistant', 'content': ai_response})
            logging.info("Resposta do LLM recebida com sucesso.")
            return ai_response
        except ollama.ResponseError as e:
            logging.error(f"Erro de resposta do Ollama: {e.error}")
            logging.error(
                f"Verifique se o servidor do Ollama está em execução e o modelo '{self._model}' foi baixado."
            )
            return "Desculpe, estou com um problema na minha conexão interna. Tente novamente mais tarde."
        except Exception as e:
            logging.critical(f"Erro inesperado ao contatar o Ollama: {e}", exc_info=True)
            return "Ocorreu um erro grave no meu sistema. Por favor, reinicie a aplicação."
