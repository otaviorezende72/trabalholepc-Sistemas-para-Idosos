# Guia Completo de Execução: Ecossistema Lyra 🛡️

Este guia prático e detalhado explica como configurar, testar e executar localmente todo o ecossistema da **Lyra**, composto por:
1. **Backend (FastAPI + SQLAlchemy + SQLite)**
2. **Motor de Voz / Assistente Virtual (Python + Ollama)**
3. **Aplicativo Mobile (React Native + Expo)**

---

## 📋 Requisitos Prévios

Antes de começar, certifique-se de que sua máquina possui:
- **Python 3.10 ou superior** (com pip).
- **Node.js 18 ou superior** (com npm).
- **Ollama** instalado e ativo:
  * Baixe e instale via [ollama.com](https://ollama.com).
  * Baixe o modelo Qwen (usado por padrão no projeto) rodando no seu terminal:
    ```bash
    ollama run qwen2.5:3b
    ```
    *(Mantenha o Ollama ativo em segundo plano durante a execução da Lyra)*.
- **Microfone e Caixas de Som** configurados e funcionais no Windows.

---

## 🛠️ Passo 1: Configuração e Execução do Backend

O backend serve a API RESTful e gerencia as salas de WebSocket isoladas por idoso (`elder_id`).

1. Abra um terminal do PowerShell na raiz do projeto (`C:\Users\tator\PycharmProjects\PythonProject`).
2. Ative o ambiente virtual:
   ```powershell
   .venv\Scripts\Activate.ps1
   ```
3. Instale as dependências específicas do backend:
   ```bash
   pip install -r backend/requirements.txt
   ```
4. Inicie o servidor do backend FastAPI:
   ```bash
   uvicorn backend.main:app --reload
   ```
   * O servidor rodará em [http://localhost:8000](http://localhost:8000).
   * A documentação interativa da API estará acessível em: [http://localhost:8000/docs](http://localhost:8000/docs).
   * O banco de dados SQLite (`backend.db`) será criado automaticamente no primeiro boot.
   * **Mantenha este terminal aberto.**

---

## 🎙️ Passo 2: Configuração e Execução do Motor de Voz (Assistente)

O motor de voz é a interface residencial que escuta e conversa com o idoso.

1. Configure as variáveis de ambiente no arquivo `.env` na raiz do projeto. Garanta que a URL de WebSocket inclui o token do dispositivo de voz:
   ```env
   AI_MODEL=qwen2.5:3b
   DEVICE_TOKEN=123456
   WS_URL=ws://localhost:8000/ws?client_type=motor&token=123456
   API_URL=http://localhost:8000
   ```
2. Abra um **segundo terminal**, ative o ambiente virtual:
   ```powershell
   .venv\Scripts\Activate.ps1
   ```
3. Instale as dependências do motor de voz:
   ```bash
   pip install -r requirements.txt
   ```
4. Execute o script principal do motor:
   ```bash
   python main.py
   ```
   * O assistente calibrará o microfone por 1 segundo e se conectará ao WebSocket do backend.
   * Você ouvirá a voz sintetizada de saudação. **Mantenha este terminal aberto.**

---

## 📱 Passo 3: Configuração e Execução do Aplicativo Mobile (`lyra-app`)

O aplicativo móvel conecta o cuidador familiar e o idoso para monitorar rotinas e alertas de emergência.

1. Navegue até a pasta do aplicativo mobile:
   ```bash
   cd lyra-app
   ```
2. Configure o arquivo `lyra-app/.env`. 
   * **Importante:** Se você estiver testando em um celular real ou emulador que precise acessar o computador local na mesma rede Wi-Fi, coloque o seu IP de rede local (ex: `192.168.0.x`), ou mantenha `localhost` se for testar no navegador web:
   ```env
   EXPO_PUBLIC_API_URL=http://localhost:8000
   ```
3. Instale as dependências do React Native / Expo:
   ```bash
   npm install
   ```
4. Inicie o servidor de desenvolvimento do Expo:
   ```bash
   npx expo start -c
   ```
5. **Opções para Rodar o App:**
   * Pressione `w` no terminal do Expo para abrir a interface web no navegador.
   * Instale o aplicativo **Expo Go** no seu smartphone (Android/iOS) e escaneie o QR Code exibido no terminal.

---

## 🧪 Fluxo de Teste de Ponta a Ponta (Simulação de SOS)

Para validar a comunicação e o fluxo de segurança multi-tenant:

1. **Cadastro do Cuidador:**
   * No app móvel (`lyra-app`), faça o cadastro de um novo cuidador responsável.
   * Após o cadastro, você receberá um **Código de Acesso de 6 dígitos** (ex: `123456`) que vincula o assistente de voz a este perfil.
2. **Vinculação do Motor:**
   * Certifique-se de que o `DEVICE_TOKEN` no arquivo `.env` da raiz é igual ao código de 6 dígitos gerado.
   * Inicie o motor de voz (`python main.py`). Ele se conectará e autenticará na sala segura do idoso.
3. **Disparar SOS:**
   * Fale próximo ao microfone do motor de voz: *"Me ajuda, eu caí!"* ou clique no botão de microfone da aba do idoso no App Mobile e selecione o simulador de queda/ajuda.
   * O motor registrará o SOS localmente e transmitirá em tempo real para o backend.
   * O cuidador receberá a notificação em tempo real na tela do aplicativo, graças à segmentação WebSocket por `elder_id`.

---

## 🩺 Execução da Suíte de Testes Automatizados

Caso faça alterações no código, certifique-se de que nenhuma regra de negócio foi afetada rodando a suíte completa:

```powershell
.venv\Scripts\python.exe -m unittest backend/test_backend.py tests/test_lyra.py
```
*(Todos os 30 testes integrados e unitários devem retornar `OK`)*.
