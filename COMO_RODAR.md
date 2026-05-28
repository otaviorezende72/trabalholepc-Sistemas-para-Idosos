# Guia de Execução Passo a Passo: Ecossistema Lyra

Este guia contém as instruções completas para configurar, testar e executar localmente o **Motor de Voz Lyra (Python)** integrado ao **Backend (FastAPI + SQLite)**.

---

## 📋 Pré-requisitos
Antes de iniciar, certifique-se de ter instalado em sua máquina Windows:
1.  **Python 3.10 ou superior** instalado e adicionado ao PATH do sistema.
2.  **Ollama** instalado e em execução:
    *   Acesse [ollama.com](https://ollama.com) para instalar.
    *   No terminal, baixe e carregue o modelo Llama 3 executando:
        ```bash
        ollama run llama3
        ```
        *(Mantenha o Ollama ativo em segundo plano durante a execução da Lyra)*.
3.  **Dispositivos de Áudio:** Um microfone padrão e uma saída de som funcionais configurados no Windows.

---

## 🛠️ Passo 1: Instalação das Dependências

Abra o terminal do PowerShell ou Command Prompt (cmd) na raiz do projeto (`C:\Users\tator\PycharmProjects\PythonProject`) e siga os passos abaixo:

### 1.1. Ativação do Ambiente Virtual
Ative o ambiente virtual já configurado no projeto:
*   No **PowerShell**:
    ```powershell
    .venv\Scripts\Activate.ps1
    ```
*   No **Command Prompt (cmd)**:
    ```cmd
    .venv\Scripts\activate.bat
    ```

### 1.2. Instalação das Dependências Gerais (Motor + Backend)
Atualize os pacotes do ambiente virtual executando os comandos a partir da raiz:
```bash
# Instala as dependências do Motor de Voz local (STT, TTS, websocket-client e requests)
pip install -r requirements.txt

# Instala as dependências do Backend FastAPI (FastAPI, Uvicorn, SQLAlchemy)
pip install -r backend/requirements.txt
```

---

## ⚙️ Passo 2: Configuração das Variáveis de Ambiente (.env)
O projeto já conta com um arquivo `.env` pré-configurado na raiz. Caso precise editá-lo ou recriá-lo a partir do `.env.example`, certifique-se de que possui as seguintes variáveis chaves:

```env
# IA / LLM (Ollama)
AI_MODEL=llama3
SYSTEM_PROMPT="Você é 'Lyra', uma assistente de saúde virtual amigável..."

# Ajustes de áudio (STT e TTS)
LISTEN_TIMEOUT_SECONDS=10
LISTEN_PHRASE_TIME_LIMIT=5
TTS_RATE=130
TTS_VOLUME=1.0

# Regras de Alerta e Contato
MAX_CONSECUTIVE_FAILURES=5
EMERGENCY_MESSAGE="[ALERTA VERMELHO] Ausência de resposta prolongada..."
EMERGENCY_CONTACT_NAME="Contato de Emergência"
EMERGENCY_CONTACT_PHONE="+55 11 99999-9999"

# URLs de Integração com o Backend Local
WS_URL=ws://localhost:8000/ws?client_type=motor
API_URL=http://localhost:8000
```

---

## 🚀 Passo 3: Inicialização do Backend (FastAPI)

1.  Com o ambiente virtual ativo, inicie o servidor FastAPI na porta padrão 8000:
    ```bash
    uvicorn backend.main:app --reload
    ```
2.  **Confirmações do Backend:**
    *   Ao iniciar, o arquivo `backend.db` (SQLite) será criado automaticamente se não existir.
    *   A documentação interativa da API REST estará disponível em: [http://localhost:8000/docs](http://localhost:8000/docs).
    *   *(Deixe este terminal rodando em segundo plano)*.

---

## 🎙️ Passo 4: Inicialização do Motor de Voz (Lyra)

1.  Abra um **segundo terminal**, ative o ambiente virtual e execute o script principal na raiz do projeto:
    ```bash
    python main.py
    ```
2.  **Fluxo Esperado:**
    *   O motor calibrará o microfone por 1 segundo (ajuste de ruído).
    *   A conexão WebSocket em segundo plano será estabelecida com o backend: `[WebSocket] Conexão estabelecida com sucesso com o servidor`.
    *   O assistente falará a saudação inicial: *"Olá! Eu sou Lyra, sua assistente. Como você está se sentindo hoje?"* e abrirá o microfone.

---

## 🧪 Passo 5: Testes Manuais de Validação

Com os dois terminais rodando (FastAPI + Motor de Voz), realize estes cenários para ver a arquitetura em ação:

### Cenário A: Ouvido Biônico (Detecção Instantânea de SOS)
*   **Ação:** Quando o microfone abrir, fale explicitamente: **"Socorro"** ou **"Me ajuda, eu caí"**.
*   **Comportamento:** O motor de voz intercepta o áudio, fala *"Entendido. Acionando emergência imediatamente"* e desliga o loop.
*   **No Terminal do Backend:** Você verá o log `[WebSocket] SOS recebido do motor. Enviando broadcast para os celulares.`, comprovando o repasse em tempo real.

### Cenário B: Prevenção de Falsos Alarmes (Sons e Barulhos)
*   **Ação:** Quando a Lyra abrir o microfone, faça barulho com a boca ou sussurre de forma ininteligível.
*   **Comportamento:** A Lyra identificará que houve um som ativo do idoso (`AudioResult.UNINTELLIGIBLE`). Ela dirá *"Desculpe, não consegui te ouvir bem. Você pode repetir?"* e **resetará** o contador de falhas (evitando alertas de emergência falsos).

### Cenário C: Queda de Internet (Infraestrutura)
*   **Ação:** Desconecte a sua conexão de rede (Wi-Fi/Cabo) ou simule bloqueios.
*   **Comportamento:** Ao tentar escutar, o STT retornará erro de conexão. A Lyra falará localmente *"Estou com dificuldades para me conectar à internet..."*, mas **não** acionará a emergência médica.

### Cenário D: Agendamento de Medicamentos Proativo
1.  Acesse a documentação da API em [http://localhost:8000/docs](http://localhost:8000/docs).
2.  Insira um medicamento usando o método `POST /medications` com o horário do sistema atual **mais 1 minuto** (ex: se agora são 13:30, coloque `"time": "13:31"`).
3.  **Comportamento:** 
    *   A thread de segundo plano (`MedicationWorker`) fará o polling e detectará a hora.
    *   A Lyra falará: *"Olá! Está na hora de tomar o [Nome do Remédio]. Você já tomou?"*.
    *   Responda **"Sim, já tomei"**: A Lyra dirá *"Ótimo, registrado!"*, enviará o `PUT /medications/{id}/confirm` ao backend, e este transmitirá para os WebSockets móveis a mensagem `MEDICATION_CONFIRMED` com o status `"tomado"`.

---

## 🩺 Passo 6: Execução dos Testes Unitários Automatizados

Para certificar-se de que novas refatorações não quebraram regras de negócio ou geraram erros de sintaxe, rode os testes integrados e unitários:

*   **Testes do Motor de Voz (Timeout Gradual, Sliding Window e Spotter de SOS):**
    ```bash
    python -m unittest tests/test_lyra.py
    ```
*   **Testes do Backend (Endpoints REST e Conexão/Broadcast do WebSocket):**
    ```bash
    python backend/test_backend.py
    ```
*(Ambos devem retornar status `OK`)*.
