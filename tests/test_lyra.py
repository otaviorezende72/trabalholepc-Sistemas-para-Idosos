import unittest
import os
import sys
from unittest.mock import MagicMock, patch

# Adiciona o diretório raiz ao sys.path para conseguir importar os módulos do projeto
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config
from core.ai_processor import AIProcessor
from core.audio_handler import AudioResult, AudioInputResult
from app import Application

class TestLyraConfig(unittest.TestCase):
    def test_dotenv_loaded(self):
        # Verifica se o arquivo .env está sendo carregado corretamente e se as variáveis estão presentes
        self.assertIsNotNone(config.AI_MODEL)
        self.assertIsNotNone(config.SYSTEM_PROMPT)
        self.assertGreater(config.MAX_CONSECUTIVE_FAILURES, 0)
        self.assertEqual(config.MAX_HISTORY_TURNS, 10)  # Padrão do nosso .env

class TestAIProcessorHistory(unittest.TestCase):
    def test_sliding_window_trimming(self):
        # Desliga a verificação de conexão com o Ollama para o teste
        # sobrescrevendo _verify_ollama_connection temporariamente
        original_verify = AIProcessor._verify_ollama_connection
        AIProcessor._verify_ollama_connection = lambda self: None
        
        try:
            processor = AIProcessor()
            processor._max_history_turns = 3  # Força limite pequeno para teste
            
            # Histórico inicial: apenas prompt do sistema
            self.assertEqual(len(processor._history), 1)
            self.assertEqual(processor._history[0]['role'], 'system')
            
            # Vamos adicionar 3 turnos (6 mensagens: 3 user, 3 assistant)
            for i in range(3):
                processor._history.append({'role': 'user', 'content': f'Oi {i}'})
                processor._history.append({'role': 'assistant', 'content': f'Olá {i}'})
                
            # Com o prompt de sistema, temos 7 mensagens. O limite é 1 + 2*3 = 7.
            # Não deve sofrer trim ainda.
            self.assertEqual(len(processor._history), 7)
            
            # Vamos adicionar mais um turno (total de 9 mensagens se não houvesse trim)
            # Ao fazer a chamada de trim_history antes de adicionar um comando:
            processor._history.append({'role': 'user', 'content': 'Oi 3'})
            processor._history.append({'role': 'assistant', 'content': 'Olá 3'})
            
            # Agora temos 9 mensagens. O trim deve atuar e reduzir para 7.
            processor._trim_history()
            
            # O trim deve cortar as mensagens mais antigas (u0, a0)
            # Deve sobrar: system, u1, a1, u2, a2, u3, a3 (total de 7 mensagens)
            self.assertEqual(len(processor._history), 7)
            self.assertEqual(processor._history[0]['role'], 'system')
            self.assertEqual(processor._history[1]['role'], 'user')
            self.assertEqual(processor._history[1]['content'], 'Oi 1')
            self.assertEqual(processor._history[-1]['content'], 'Olá 3')
        finally:
            AIProcessor._verify_ollama_connection = original_verify

class TestApplicationAudioStateMachine(unittest.TestCase):
    def setUp(self):
        # Evita a inicialização real de áudio/IA/WS/Remédios no construtor
        with patch('app.AudioHandler'), patch('app.AIProcessor'), patch('app.EmergencyManager'), patch('app.LyraWebSocketClient'), patch('app.MedicationWorker'):
            self.app = Application()
            # Substitui pelos mocks criados pela injeção
            self.app.audio_handler = MagicMock()
            self.app.ai_processor = MagicMock()
            self.app.emergency_manager = MagicMock()
            self.app.ws_client = MagicMock()
            self.app.medication_worker = MagicMock()
            self.app.audio_handler.contains_sos_keywords.return_value = False

    def test_audio_success(self):
        self.app.consecutive_failures = 3
        # Configura o retorno de listen() para encerrar o loop graciosamente
        self.app.audio_handler.listen.side_effect = [
            AudioInputResult(text="parar", status=AudioResult.SUCCESS)
        ]
        self.app.run()
        
        self.assertEqual(self.app.consecutive_failures, 0)
        self.assertFalse(self.app.is_running)
        self.app.audio_handler.speak.assert_called_with("Entendido. Desligando. Até logo!")

    def test_audio_unintelligible_resets_failures(self):
        self.app.consecutive_failures = 2
        result = AudioInputResult(text=None, status=AudioResult.UNINTELLIGIBLE)
        self.app._handle_audio_failure(result)
        
        # Deve resetar a contagem de falhas pois houve presença de som/vida
        self.assertEqual(self.app.consecutive_failures, 0)
        self.app.audio_handler.speak.assert_called_with("Desculpe, não consegui te ouvir bem. Você pode repetir?")
        self.app.emergency_manager.trigger_alert.assert_not_called()

    def test_audio_network_error_does_not_increment_failures(self):
        self.app.consecutive_failures = 1
        result = AudioInputResult(text=None, status=AudioResult.NETWORK_ERROR, error_message="Google STT connection timed out")
        self.app._handle_audio_failure(result)
        
        # Não deve incrementar
        self.assertEqual(self.app.consecutive_failures, 1)
        self.app.audio_handler.speak.assert_called_with("Estou com dificuldades para me conectar à internet. Por favor, verifique minha conexão.")
        self.app.emergency_manager.trigger_alert.assert_not_called()

    def test_audio_hardware_error_does_not_increment_failures(self):
        self.app.consecutive_failures = 2
        result = AudioInputResult(text=None, status=AudioResult.HARDWARE_ERROR, error_message="No default input device available")
        self.app._handle_audio_failure(result)
        
        # Não deve incrementar
        self.assertEqual(self.app.consecutive_failures, 2)
        self.app.audio_handler.speak.assert_called_with("Acho que meu microfone foi desconectado. Por favor, verifique meus cabos.")
        self.app.emergency_manager.trigger_alert.assert_not_called()

    def test_audio_timeout_escalates_to_emergency(self):
        # Com MAX_CONSECUTIVE_FAILURES = 5 (padrão do .env)
        self.app.consecutive_failures = 0
        
        # Falha 1 (Timeout) -> consecutive_failures = 1. Sem aviso verbal.
        self.app._handle_audio_failure(AudioInputResult(text=None, status=AudioResult.TIMEOUT))
        self.assertEqual(self.app.consecutive_failures, 1)
        self.app.audio_handler.speak.assert_not_called()
        
        # Falha 2 -> consecutive_failures = 2. Sem aviso verbal.
        self.app._handle_audio_failure(AudioInputResult(text=None, status=AudioResult.TIMEOUT))
        self.assertEqual(self.app.consecutive_failures, 2)
        self.app.audio_handler.speak.assert_not_called()
        
        # Falha 3 -> consecutive_failures = 3 (MAX - 2). Primeiro aviso verbal.
        self.app._handle_audio_failure(AudioInputResult(text=None, status=AudioResult.TIMEOUT))
        self.assertEqual(self.app.consecutive_failures, 3)
        self.app.audio_handler.speak.assert_called_with("Olá? Você ainda está por aí?")
        
        # Falha 4 -> consecutive_failures = 4 (MAX - 1). Aviso de urgência.
        self.app._handle_audio_failure(AudioInputResult(text=None, status=AudioResult.TIMEOUT))
        self.assertEqual(self.app.consecutive_failures, 4)
        self.app.audio_handler.speak.assert_called_with("Por favor, diga alguma coisa se puder me ouvir. Caso contrário, precisarei chamar ajuda.")
        
        # Falha 5 -> consecutive_failures = 5 (MAX). Alerta vermelho e desliga.
        self.app.is_running = True
        self.app._handle_audio_failure(AudioInputResult(text=None, status=AudioResult.TIMEOUT))
        self.assertEqual(self.app.consecutive_failures, 5)
        self.app.emergency_manager.trigger_alert.assert_called_once()
        self.assertFalse(self.app.is_running)

    def test_voice_spotter_intercepts_sos(self):
        self.app.audio_handler.listen.return_value = AudioInputResult(text="me ajuda eu caí", status=AudioResult.SUCCESS)
        self.app.audio_handler.contains_sos_keywords.return_value = True
        
        self.app.run()
        
        self.assertFalse(self.app.is_running)
        self.app.audio_handler.speak.assert_any_call("Entendido. Acionando emergência imediatamente.")
        self.app.emergency_manager.trigger_alert.assert_called_once_with(reason="comando_voz")

class TestAIProcessorMemory(unittest.TestCase):
    def setUp(self):
        self.original_verify = AIProcessor._verify_ollama_connection
        AIProcessor._verify_ollama_connection = lambda self: None
        self.original_profile_summary = config.PROFILE_SUMMARY

    def tearDown(self):
        AIProcessor._verify_ollama_connection = self.original_verify
        config.PROFILE_SUMMARY = self.original_profile_summary

    @patch('core.ai_processor.requests.get')
    @patch('core.ai_processor.ollama.chat')
    def test_dynamic_system_prompt_injection(self, mock_ollama_chat, mock_requests_get):
        # Configura o retorno do GET settings simulando profile_summary preenchido
        mock_get_response = MagicMock()
        mock_get_response.status_code = 200
        mock_get_response.json.return_value = {
            "checkin_interval_hours": 12,
            "emergency_contact_name": "Maria",
            "emergency_contact_phone": "+55 11 99999-9999",
            "profile_summary": "- Gosta de café\n- Tem um gato chamado Mimi"
        }
        mock_requests_get.return_value = mock_get_response

        # Configura o retorno do Ollama
        mock_ollama_chat.return_value = {
            'message': {'content': 'Olá, como posso ajudar?'}
        }

        processor = AIProcessor()
        
        # Chama get_response
        response = processor.get_response("Oi Lyra")

        # Verifica se o GET foi chamado no endpoint correto
        mock_requests_get.assert_called_with(f"{config.API_URL}/settings", timeout=2.0)

        # Verifica se o system prompt inicial foi atualizado com o profile_summary
        self.assertIn("Aqui estão os fatos que você lembra sobre a vida e os gostos dele:", processor._history[0]['content'])
        self.assertIn("Gosta de café", processor._history[0]['content'])
        self.assertIn("Tem um gato chamado Mimi", processor._history[0]['content'])

    @patch('core.ai_processor.requests.get')
    @patch('core.ai_processor.ollama.chat')
    def test_dynamic_system_prompt_fallback(self, mock_ollama_chat, mock_requests_get):
        # Simula erro de conexão no GET
        mock_requests_get.side_effect = Exception("Connection refused")
        
        # Define um valor no config.PROFILE_SUMMARY local
        config.PROFILE_SUMMARY = "- Gosta de passear de tarde"

        # Configura o retorno do Ollama
        mock_ollama_chat.return_value = {
            'message': {'content': 'Olá, como posso ajudar?'}
        }

        processor = AIProcessor()
        response = processor.get_response("Oi Lyra")

        # Verifica se o system prompt inicial utilizou o fallback do config local
        self.assertIn("Aqui estão os fatos que você lembra sobre a vida e os gostos dele:", processor._history[0]['content'])
        self.assertIn("Gosta de passear de tarde", processor._history[0]['content'])

    def test_merge_profile_summaries(self):
        processor = AIProcessor()
        old_summary = "- Gosta de futebol\n- Gosta de ler"
        new_summary = "- Gosta de futebol\n- Tem 2 gatos"
        
        merged = processor._merge_profile_summaries(old_summary, new_summary)
        
        # Deve remover duplicatas de forma case-insensitive e manter no formato "* Item"
        expected = "* Gosta de futebol\n* Gosta de ler\n* Tem 2 gatos"
        self.assertEqual(merged, expected)

    @patch('core.ai_processor.requests.put')
    @patch('core.ai_processor.requests.get')
    @patch('core.ai_processor.ollama.chat')
    def test_extract_and_update_memory_success(self, mock_ollama_chat, mock_requests_get, mock_requests_put):
        # 1. Configura o mock do Ollama retornando fatos novos
        mock_ollama_chat.return_value = {
            'message': {'content': '- Gosta de chá de camomila'}
        }

        # 2. Configura o GET settings do backend retornando o perfil atual
        mock_get_resp = MagicMock()
        mock_get_resp.status_code = 200
        mock_get_resp.json.return_value = {
            "id": 1,
            "checkin_interval_hours": 12,
            "emergency_contact_name": "Maria",
            "emergency_contact_phone": "+55 11 99999-9999",
            "profile_summary": "- Gosta de ler"
        }
        mock_requests_get.return_value = mock_get_resp

        # 3. Configura o PUT settings retornando sucesso
        mock_put_resp = MagicMock()
        mock_put_resp.status_code = 200
        mock_requests_put.return_value = mock_put_resp

        processor = AIProcessor()
        recent_history = [
            {'role': 'user', 'content': 'Eu gosto de tomar chá de camomila.'},
            {'role': 'assistant', 'content': 'Que delícia! Chá de camomila acalma.'}
        ]

        # Executa de forma síncrona para testar logicamente
        processor._extract_and_update_memory(recent_history)

        # Verifica se buscou as configs atuais
        mock_requests_get.assert_called_with(f"{config.API_URL}/settings", timeout=2.0)

        # Verifica se realizou a chamada de PUT com os resumos mesclados
        expected_put_payload = {
            "checkin_interval_hours": 12,
            "emergency_contact_name": "Maria",
            "emergency_contact_phone": "+55 11 99999-9999",
            "profile_summary": "* Gosta de ler\n* Gosta de chá de camomila"
        }
        mock_requests_put.assert_called_with(
            f"{config.API_URL}/settings",
            json=expected_put_payload,
            timeout=2.0
        )
        
        # Verifica se atualizou a variável global no config
        self.assertEqual(config.PROFILE_SUMMARY, "* Gosta de ler\n* Gosta de chá de camomila")

    @patch('core.ai_processor.requests.put')
    @patch('core.ai_processor.requests.get')
    @patch('core.ai_processor.ollama.chat')
    def test_extract_and_update_memory_empty_vazio(self, mock_ollama_chat, mock_requests_get, mock_requests_put):
        # Ollama retornando VAZIO
        mock_ollama_chat.return_value = {
            'message': {'content': ' VAZIO. '}
        }

        processor = AIProcessor()
        recent_history = [
            {'role': 'user', 'content': 'Tudo bem.'},
            {'role': 'assistant', 'content': 'Tudo ótimo!'}
        ]

        processor._extract_and_update_memory(recent_history)

        # Não deve ter feito chamadas ao backend se for VAZIO
        mock_requests_get.assert_not_called()
        mock_requests_put.assert_not_called()

if __name__ == '__main__':
    unittest.main()
