import axios from 'axios';
import { lerToken } from './armazenamento';

// A URL do backend é consumida dinamicamente a partir do ambiente do Expo
export const BASE_URL = 'http://192.168.0.10:8000'; 
export const WS_URL = BASE_URL.replace(/^http/, 'ws') + '/ws';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor para injetar o JWT de forma dinâmica
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await lerToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      console.warn('[API] Falha ao ler token da sessão:', e);
    }
    return config;
  },
  (error) => Promise.reject(error)
);


// ── Medicamentos ──────────────────────────────────────────────────────────────

// GET /medications
export const listarMedicamentos = async () => {
  const { data } = await api.get('/medications');
  return data; // [{ id, name, dosage, time, active, status, confirmed_at }]
};

// POST /medications
export const criarMedicamento = async (name, dosage, time, days) => { 
  const { data } = await api.post('/medications', { name, dosage, time, days, active: true });
  return data;
};

// PUT /medications/{id}
export const atualizarMedicamento = async (id, payload) => {
  const { data } = await api.put(`/medications/${id}`, payload);
  return data;
};

// DELETE /medications/{id}
export const removerMedicamento = async (id) => {
  await api.delete(`/medications/${id}`);
};

// PUT /medications/{id}/confirm — idoso confirmou que tomou
export const confirmarMedicamento = async (id) => {
  const { data } = await api.put(`/medications/${id}/confirm`);
  return data;
};

// ── Tarefas ───────────────────────────────────────────────────────────────────

export const listarTarefas = async () => {
  const { data } = await api.get('/tasks');
  return data;
};

export const criarTarefa = async (descricao, horarios, dias) => {
  const { data } = await api.post('/tasks', { descricao, horarios, dias });
  return data;
};

export const removerTarefa = async (id) => {
  await api.delete(`/tasks/${id}`);
};

// ── Alertas ───────────────────────────────────────────────────────────────────

// GET /alerts
export const listarAlertas = async (skip = 0, limit = 50) => {
  const { data } = await api.get('/alerts', { params: { skip, limit } });
  return data; // [{ id, type, resolved, timestamp, resolved_at }]
};

// POST /alerts
export const criarAlerta = async (type) => {
  const { data } = await api.post('/alerts', { type, resolved: false });
  return data;
};

// PUT /alerts/{id}/resolve
export const resolverAlerta = async (id) => {
  const { data } = await api.put(`/alerts/${id}/resolve`);
  return data;
};

// ── Configurações do Idoso ────────────────────────────────────────────────────

// GET /settings (Corrigido para bater com o backend do seu colega)
export const buscarConfiguracoes = async () => {
  const { data } = await api.get('/settings');
  return data;
};

// PUT /settings (Corrigido para bater com o backend do seu colega)
export const salvarConfiguracoes = async (payload) => {
  const { data } = await api.put('/settings', payload);
  return data;
};

// ── Autenticação ─────────────────────────────────────────────────────────────

export const loginResponsavel = async (username, password) => {
  const { data } = await api.post('/api/auth/login', { username, password });
  return data; // { token, username, access_code }
};

export const cadastrarResponsavel = async (username, password) => {
  const { data } = await api.post('/api/auth/register', { username, password });
  return data; // { token, username, access_code }
};

export const loginIdoso = async (code) => {
  const { data } = await api.post('/api/auth/login-elder', { code });
  return data; // { token, elder_name, elder_id }
};

// ── Toggles de Rotina ─────────────────────────────────────────────────────────

export const toggleTarefa = async (id) => {
  const { data } = await api.patch(`/api/tasks/${id}/toggle`);
  return data;
};

export const desconfirmarMedicamento = async (id) => {
  const { data } = await api.put(`/medications/${id}/unconfirm`);
  return data;
};

// ── Status e Utilitários ──────────────────────────────────────────────────────

export const declararAusente = async () => {
  const { data } = await api.post('/api/status/away');
  return data;
};

export const declararPresente = async () => {
  const { data } = await api.post('/api/status/home');
  return data;
};

export const buscarClima = async (cidade = '') => {
  const params = cidade ? { city: cidade } : {};
  const { data } = await api.get('/api/utility/weather', { params });
  return data;
};

export const buscarFutebol = async () => {
  const { data } = await api.get('/api/utility/football');
  return data;
};

export const buscarNutricao = async () => {
  const { data } = await api.get('/api/utility/nutrition');
  return data;
};

export default api;
