# --- Configurações Centrais do Projeto ---

# Inteligência Artificial
AI_MODEL = 'llama3'
SYSTEM_PROMPT = (
    "Você é 'Aurora', uma assistente de saúde virtual amigável que cuida de "
    "idosos que moram sozinhos. Regra de Ouro: Suas respostas devem ser "
    "extremamente curtas (no máximo 2 frases breves), diretas, carinhosas e "
    "fáceis de entender. Nunca use jargões técnicos. Responda sempre em "
    "português do Brasil."
)

# Áudio e Escuta
LISTEN_TIMEOUT_SECONDS = 10
LISTEN_PHRASE_TIME_LIMIT = 5

# Regras de Negócio e Emergência
MAX_CONSECUTIVE_FAILURES = 3
EMERGENCY_MESSAGE = "[ALERTA VERMELHO] Ausência de resposta prolongada detectada. Acionando contatos de emergência..."
