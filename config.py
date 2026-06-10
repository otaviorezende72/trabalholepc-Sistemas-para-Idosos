import os
from dotenv import load_dotenv

# Carrega as variáveis do arquivo .env
load_dotenv()

# Inteligência Artificial
AI_MODEL = os.getenv("AI_MODEL", "qwen2.5:3b")
MAX_HISTORY_TURNS = int(os.getenv("MAX_HISTORY_TURNS", "10"))
SYSTEM_PROMPT = os.getenv(
    "SYSTEM_PROMPT",
    "Você é a Lyra, uma amiga e cuidadora virtual extremamente calorosa, empática e atenciosa. "
    "Sua missão é conversar com o usuário de forma natural, como um ser humano faria. "
    "Regra de Ouro: Use frases curtas, fáceis de entender e acolhedoras. Responda sempre em português do Brasil."
)

# Áudio e Escuta
LISTEN_TIMEOUT_SECONDS = int(os.getenv("LISTEN_TIMEOUT_SECONDS", "10"))
LISTEN_PHRASE_TIME_LIMIT = int(os.getenv("LISTEN_PHRASE_TIME_LIMIT", "5"))

# Ajustes de TTS (Text-to-Speech) para Idosos
TTS_RATE = int(os.getenv("TTS_RATE", "130"))
TTS_VOLUME = float(os.getenv("TTS_VOLUME", "1.0"))

# Regras de Negócio e Emergência
MAX_CONSECUTIVE_FAILURES = int(os.getenv("MAX_CONSECUTIVE_FAILURES", "5"))
EMERGENCY_MESSAGE = os.getenv(
    "EMERGENCY_MESSAGE",
    "[ALERTA VERMELHO] Ausência de resposta prolongada detectada. Acionando contatos de emergência..."
)

# Contatos de Emergência
EMERGENCY_CONTACT_NAME = os.getenv("EMERGENCY_CONTACT_NAME", "Contato de Emergência")
EMERGENCY_CONTACT_PHONE = os.getenv("EMERGENCY_CONTACT_PHONE", "+55 11 99999-9999")

# Conexão WebSocket com o Backend FastAPI
DEVICE_TOKEN = os.getenv("DEVICE_TOKEN", "123456")
WS_URL = os.getenv("WS_URL", f"ws://localhost:8000/ws?client_type=motor&token={DEVICE_TOKEN}")
API_URL = os.getenv("API_URL", "http://localhost:8000")


# Resumo do perfil do idoso (Memória de Longo Prazo)
PROFILE_SUMMARY = ""

# Estado de ausência (Modo Ausente) e delay de conciliação
IS_AWAY = False
RECONCILIATION_DELAY = 120
