import logging
import threading
import requests
from typing import List, Dict

import ollama
import config

class AIProcessor:
    """
    Gerencia a interação com o Large Language Model (LLM) via Ollama.

    Esta classe encapsula o histórico da conversa e a lógica para obter
    respostas do modelo de IA, tratando os erros de comunicação.
    """

    def __init__(self):
        self._model = config.AI_MODEL
        self._max_history_turns = config.MAX_HISTORY_TURNS
        self._history: List[Dict[str, str]] = [{'role': 'system', 'content': config.SYSTEM_PROMPT}]
        logging.info(f"Módulo de IA inicializado com o modelo: {self._model}")
        self._verify_ollama_connection()

    def _verify_ollama_connection(self):
        """Verifica se o serviço Ollama está ativo e se o modelo está baixado."""
        try:
            logging.info("Verificando conexão com o Ollama e disponibilidade do modelo...")
            models_response = ollama.list()
            
            # Garante compatibilidade com diferentes versões da biblioteca python-ollama
            models_list = []
            if hasattr(models_response, 'models'):
                models_list = [m.model for m in models_response.models]
            elif isinstance(models_response, dict) and 'models' in models_response:
                models_list = [m.get('name', m.get('model', '')) for m in models_response['models']]
            
            # Valida se o modelo configurado existe
            model_installed = False
            for m in models_list:
                if m == self._model or m.startswith(f"{self._model}:"):
                    model_installed = True
                    break
            
            if not model_installed:
                logging.warning(
                    f"AVISO: O modelo '{self._model}' não foi encontrado no Ollama. "
                    f"Modelos instalados: {models_list}. "
                    f"Certifique-se de executar 'ollama run {self._model}' para evitar erros de execução."
                )
            else:
                logging.info(f"Conexão com Ollama estabelecida. Modelo '{self._model}' está disponível.")
        except Exception as e:
            logging.warning(
                f"AVISO: Não foi possível conectar ao Ollama durante a inicialização: {e}. "
                f"Verifique se o Ollama está rodando localmente (porta 11434)."
            )

    def _trim_history(self):
        """Limita o histórico de conversa mantendo o prompt do sistema e as últimas N interações."""
        max_messages = 2 * self._max_history_turns
        if len(self._history) > 1 + max_messages:
            trimmed = self._history[-max_messages:]
            # Garante que o histórico fatiado comece com uma mensagem do usuário
            if trimmed and trimmed[0]['role'] == 'assistant':
                trimmed = trimmed[1:]
            self._history = [self._history[0]] + trimmed
            logging.info(f"Histórico de conversas reduzido. Turnos mantidos: {len(trimmed) // 2}")

    def get_response(self, user_text: str) -> str:
        """
        Envia o texto do usuário para o LLM e retorna a resposta.

        Args:
            user_text: O texto transcrito da fala do usuário.

        Returns:
            A resposta gerada pelo LLM ou uma mensagem de erro padrão.
        """
        logging.info("Consultando o LLM...")
        
        # Reduz o histórico se ultrapassar o limite configurado
        self._trim_history()
        
        # 1. Obter o profile_summary e elder_name atual do backend ou usar o local
        profile_summary = ""
        elder_name = "Senhor"
        try:
            resp = requests.get(
                f"{config.API_URL}/settings", 
                headers={"X-Device-Token": config.DEVICE_TOKEN}, 
                timeout=2.0
            )
            if resp.status_code == 200:
                data = resp.json()
                profile_summary = data.get("profile_summary", "")
                elder_name = data.get("elder_name", "Senhor")
            else:
                profile_summary = config.PROFILE_SUMMARY
        except Exception as e:
            logging.warning(f"Erro ao buscar profile_summary no backend: {e}. Usando valor local.")
            profile_summary = config.PROFILE_SUMMARY

        # 2. Atualizar dinamicamente a mensagem de sistema inicial com o perfil
        system_prompt = (
            "Você é a Lyra, uma amiga e cuidadora virtual extremamente calorosa, empática e atenciosa. "
            f"Sua missão é conversar com o idoso de forma natural. O nome dele é {elder_name}, portanto, "
            f"trate-o pelo nome {elder_name} (ou Seu/Dona {elder_name}) de forma acolhedora. "
            "Use sempre frases curtas, fáceis de entender. Responda em português do Brasil. "
        )
        if profile_summary:
            system_prompt += f"Aqui estão os fatos que você lembra sobre a vida e os gostos dele:\n{profile_summary}"

        
        # Garante que temos pelo menos a mensagem de sistema no início
        if self._history and self._history[0]['role'] == 'system':
            self._history[0]['content'] = system_prompt
        else:
            self._history.insert(0, {'role': 'system', 'content': system_prompt})
        
        self._history.append({'role': 'user', 'content': user_text})

        try:
            response = ollama.chat(model=self._model, messages=self._history)
            ai_response = response['message']['content']
            self._history.append({'role': 'assistant', 'content': ai_response})
            logging.info("Resposta do LLM recebida com sucesso.")
            
            # Ao final do processamento com sucesso, disparar a extração em segundo plano (daemon thread)
            # Passamos as últimas mensagens de conversa (user e assistant) para a thread
            recent_history_slice = list(self._history[-2:])
            threading.Thread(
                target=self._extract_and_update_memory,
                args=(recent_history_slice,),
                daemon=True
            ).start()
            
            return ai_response
        except ollama.ResponseError as e:
            logging.error(f"Erro de resposta do Ollama: {e.error}")
            logging.error(
                f"Verifique se o servidor do Ollama está em execução e o modelo '{config.AI_MODEL}' foi baixado."
            )
            return "Desculpe, estou com um problema na minha conexão interna. Tente novamente mais tarde."
        except Exception as e:
            logging.critical(f"Erro inesperado ao contatar o Ollama: {e}", exc_info=True)
            return "Ocorreu um erro grave no meu sistema. Por favor, reinicie a aplicação."

    def _merge_profile_summaries(self, old_summary: str, new_summary: str) -> str:
        """Mescla dois resumos de perfil removendo tópicos duplicados de forma case-insensitive."""
        def clean_lines(text):
            lines = []
            for line in text.splitlines():
                cleaned = line.strip().lstrip('*-').strip()
                if cleaned:
                    lines.append(cleaned)
            return lines

        old_lines = clean_lines(old_summary)
        new_lines = clean_lines(new_summary)

        merged_lines = []
        seen = set()
        for line in old_lines + new_lines:
            line_lower = line.lower()
            if line_lower not in seen:
                seen.add(line_lower)
                merged_lines.append(line)

        return "\n".join(f"* {line}" for line in merged_lines)

    def _extract_and_update_memory(self, recent_history_slice: List[Dict[str, str]]):
        """
        Executa a chamada ao Ollama para extrair memórias e atualiza o backend.
        Roda em segundo plano para evitar travar a interação de voz.
        """
        logging.info("[Memória] Iniciando extração de memória em segundo plano...")
        dialogue_text = ""
        for msg in recent_history_slice:
            role_name = "Idoso" if msg['role'] == 'user' else "Lyra"
            dialogue_text += f"{role_name}: {msg['content']}\n"

        extraction_prompt = (
            "Você é um assistente de extração de informações sobre idosos.\n"
            "Analise o diálogo abaixo entre um idoso e a assistente virtual Lyra e extraia novos fatos sobre o idoso "
            "(como gostos, preferências, fatos da vida, rotina, nomes de parentes ou animais de estimação, etc.).\n"
            "Gere a saída EXCLUSIVAMENTE como uma lista de tópicos curtos (um por linha), iniciando com '* ' (formato Markdown).\n"
            "Se nenhum fato novo relevante for extraído do diálogo, responda APENAS com a palavra: VAZIO\n"
            "Não adicione nenhuma explicação, introdução ou comentário. Seja conciso e direto.\n\n"
            "Diálogo:\n"
            f"{dialogue_text}"
        )

        try:
            response = ollama.chat(
                model=self._model,
                messages=[{'role': 'user', 'content': extraction_prompt}]
            )
            result = response['message']['content'].strip()
            logging.info(f"[Memória] Resultado da extração do Ollama: {result}")
            
            # Verifica se extraiu algo válido e não "VAZIO" (ignorando case e ponto final)
            clean_result = result.upper().replace('.', '').strip()
            if clean_result and clean_result != "VAZIO":
                # 1. GET settings atuais
                resp = requests.get(
                    f"{config.API_URL}/settings", 
                    headers={"X-Device-Token": config.DEVICE_TOKEN}, 
                    timeout=2.0
                )
                if resp.status_code == 200:
                    current_settings = resp.json()
                else:
                    logging.error(f"[Memória] Erro ao buscar configurações atuais no backend: HTTP {resp.status_code}")
                    return

                
                # 2. Mesclar e atualizar o profile_summary
                old_summary = current_settings.get("profile_summary", "")
                merged_summary = self._merge_profile_summaries(old_summary, result)
                
                current_settings["profile_summary"] = merged_summary
                current_settings.pop("id", None)
                
                # 3. PUT settings
                put_resp = requests.put(
                    f"{config.API_URL}/settings", 
                    headers={"X-Device-Token": config.DEVICE_TOKEN}, 
                    json=current_settings, 
                    timeout=2.0
                )
                if put_resp.status_code == 200:
                    logging.info(f"[Memória] Profile summary atualizado com sucesso no backend. Novo perfil:\n{merged_summary}")
                    config.PROFILE_SUMMARY = merged_summary
                else:
                    logging.error(f"[Memória] Erro ao enviar atualização de configurações: HTTP {put_resp.status_code}")

            else:
                logging.info("[Memória] Nenhum fato novo extraído da conversa.")
        except Exception as e:
            logging.error(f"[Memória] Erro ao extrair e atualizar memória em segundo plano: {e}", exc_info=True)
