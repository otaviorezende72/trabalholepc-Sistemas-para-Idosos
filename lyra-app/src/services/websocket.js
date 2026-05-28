import { WS_URL } from './api';

class LyraWebSocket {
  constructor() {
    this.ws = null;
    this.listeners = {};
    this.tentativas = 0;
    this.maxTentativas = 3;
    this.conectado = false;
    this.desistiu = false;
  }

  conectar(clientType = 'mobile') {
    if (this.desistiu) return;

    try {
      this.ws = new WebSocket(`${WS_URL}?client_type=${clientType}`);

      this.ws.onopen = () => {
        this.conectado = true;
        this.tentativas = 0;
        this.desistiu = false;
        console.log('[WebSocket] Conectado');
        this._emitir('conectado');
      };

      this.ws.onmessage = (event) => {
        try {
          const mensagem = JSON.parse(event.data);
          this._emitir(mensagem.event, mensagem.data);
        } catch (e) {}
      };

      // Silencia o erro — apenas loga discretamente
      this.ws.onerror = () => {
        this.conectado = false;
      };

      this.ws.onclose = () => {
        this.conectado = false;
        if (!this.desistiu) {
          this._tentarReconectar(clientType);
        }
      };
    } catch (e) {
      // Ignora falha de conexão silenciosamente
    }
  }

  _tentarReconectar(clientType) {
    if (this.tentativas >= this.maxTentativas) {
      // Desiste silenciosamente após 3 tentativas
      this.desistiu = true;
      return;
    }
    this.tentativas++;
    const delay = this.tentativas * 5000;
    setTimeout(() => {
      if (!this.desistiu) this.conectar(clientType);
    }, delay);
  }

  on(evento, callback) {
    if (!this.listeners[evento]) this.listeners[evento] = [];
    this.listeners[evento].push(callback);
    return () => {
      this.listeners[evento] = this.listeners[evento].filter(cb => cb !== callback);
    };
  }

  _emitir(evento, dados) {
    if (this.listeners[evento]) {
      this.listeners[evento].forEach(cb => cb(dados));
    }
  }

  desconectar() {
    this.desistiu = true;
    this.tentativas = 0;
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
    }
  }

  resetar() {
    this.desistiu = false;
    this.tentativas = 0;
  }
}

export const wsService = new LyraWebSocket();