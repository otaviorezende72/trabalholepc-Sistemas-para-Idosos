import { WS_URL } from './api';

class LyraWebSocket {
  constructor() {
    this.ws = null;
    this.listeners = {};
    this.delayReconexao = 2000; // Começa com 2s
    this.conectado = false;
    this.timerReconexao = null;
    this.desistiu = false; // Controle de desconexão manual
  }

  conectar(clientType = 'mobile') {
    if (this.desistiu) return;
    
    // Evita múltiplos agendamentos concorrentes
    if (this.timerReconexao) {
      clearTimeout(this.timerReconexao);
      this.timerReconexao = null;
    }

    try {
      this.ws = new WebSocket(`${WS_URL}?client_type=${clientType}`);
      this._emitir('estado_alterado', { conectado: false, status: 'conectando' });

      this.ws.onopen = () => {
        this.conectado = true;
        this.delayReconexao = 2000; // Reseta backoff com sucesso
        console.log('[WebSocket] Conectado com sucesso.');
        this._emitir('conectado');
        this._emitir('estado_alterado', { conectado: true, status: 'conectado' });
      };

      this.ws.onmessage = (event) => {
        try {
          const mensagem = JSON.parse(event.data);
          this._emitir(mensagem.event, mensagem.data);
        } catch (e) {
          // Ignora JSONs malformatados
        }
      };

      this.ws.onerror = () => {
        this.conectado = false;
        this._emitir('estado_alterado', { conectado: false, status: 'desconectado' });
      };

      this.ws.onclose = () => {
        this.conectado = false;
        this._emitir('estado_alterado', { conectado: false, status: 'desconectado' });
        if (!this.desistiu) {
          this._tentarReconectar(clientType);
        }
      };
    } catch (e) {
      this.conectado = false;
      this._emitir('estado_alterado', { conectado: false, status: 'desconectado' });
      if (!this.desistiu) {
        this._tentarReconectar(clientType);
      }
    }
  }

  _tentarReconectar(clientType) {
    if (this.timerReconexao) return;

    console.log(`[WebSocket] Reconectando em ${this.delayReconexao}ms...`);
    this._emitir('estado_alterado', { conectado: false, status: 'reconectando', delay: this.delayReconexao });
    
    this.timerReconexao = setTimeout(() => {
      this.timerReconexao = null;
      this.conectar(clientType);
    }, this.delayReconexao);

    // Dobra o intervalo até atingir o teto de 30 segundos
    this.delayReconexao = Math.min(this.delayReconexao * 2, 30000);
  }

  on(evento, callback) {
    if (!this.listeners[evento]) this.listeners[evento] = [];
    this.listeners[evento].push(callback);
    
    // Retorna função para desinscrever o listener de forma limpa
    return () => {
      this.listeners[evento] = this.listeners[evento].filter(cb => cb !== callback);
    };
  }

  _emitir(evento, dados) {
    if (this.listeners[evento]) {
      this.listeners[evento].forEach(cb => {
        try {
          cb(dados);
        } catch (e) {
          console.error(`[WebSocket] Erro na execução de callback para '${evento}':`, e);
        }
      });
    }
  }

  desconectar() {
    this.desistiu = true;
    if (this.timerReconexao) {
      clearTimeout(this.timerReconexao);
      this.timerReconexao = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
    }
    this.conectado = false;
    this._emitir('estado_alterado', { conectado: false, status: 'desconectado' });
  }

  resetar() {
    this.desistiu = false;
    this.delayReconexao = 2000;
  }
}

export const wsService = new LyraWebSocket();