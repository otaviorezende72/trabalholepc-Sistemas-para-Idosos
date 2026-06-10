import axios from 'axios';

// Trocar pelo IP do seu computador onde o FastAPI roda
// Celular físico na mesma rede Wi-Fi: use o IP local (ex: 192.168.1.100)
// Emulador Android: use 10.0.2.2
export const BASE_URL = 'http://192.168.0.135:8000';
export const WS_URL = `ws://192.168.0.135:8000/ws`;

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

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

export default api;