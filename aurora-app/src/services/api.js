import axios from 'axios';

// ⚠️ IMPORTANTE: troque pelo IP do seu computador onde o FastAPI roda
// Se estiver testando no emulador Android: use 10.0.2.2
// Se estiver testando no celular físico: use o IP da sua rede (ex: 192.168.1.100)
const BASE_URL = 'http://10.0.2.2:8000';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000, // 30 segundos (IA pode demorar)
  headers: { 'Content-Type': 'application/json' },
});

// ── Chat / Voz ────────────────────────────────────────────────────────────────
export const enviarMensagem = async (idosoId, mensagem, fcmToken = null) => {
  const { data } = await api.post('/api/chat', {
    idoso_id: idosoId,
    mensagem,
    fcm_token: fcmToken,
  });
  return data; // { resposta, eh_emergencia, confianca_emergencia }
};

// ── SOS ───────────────────────────────────────────────────────────────────────
export const acionarSos = async (idosoId, motivo = 'botao_panico') => {
  const { data } = await api.post('/api/sos', {
    idoso_id: idosoId,
    motivo,
  });
  return data;
};

// ── Medicamentos ──────────────────────────────────────────────────────────────
export const listarMedicamentos = async (idosoId) => {
  const { data } = await api.get(`/api/medications/${idosoId}`);
  return data;
};

export const criarMedicamento = async (idosoId, nome, dosagem, horarios) => {
  const { data } = await api.post('/api/medications', {
    idoso_id: idosoId,
    nome,
    dosagem,
    horarios,
  });
  return data;
};

export const removerMedicamento = async (id) => {
  const { data } = await api.delete(`/api/medications/${id}`);
  return data;
};

export const confirmarMedicamento = async (medicamentoId, idosoId, horario) => {
  const { data } = await api.post('/api/medications/confirm', {
    medicamento_id: medicamentoId,
    idoso_id: idosoId,
    horario,
  });
  return data;
};

// ── Perfis ────────────────────────────────────────────────────────────────────
export const criarPerfilIdoso = async (nome, familiarId, checkinInicio, checkinFim) => {
  const { data } = await api.post('/api/profiles/idoso', {
    nome,
    familiar_id: familiarId,
    checkin_hora_inicio: checkinInicio,
    checkin_hora_fim: checkinFim,
  });
  return data;
};

export const buscarPerfilIdoso = async (familiarId) => {
  const { data } = await api.get(`/api/profiles/idoso/${familiarId}`);
  return data;
};

// ── Alertas ───────────────────────────────────────────────────────────────────
export const listarAlertas = async (idosoId) => {
  const { data } = await api.get(`/api/alerts/${idosoId}`);
  return data;
};

export const marcarAlertaVisualizado = async (id) => {
  const { data } = await api.patch(`/api/alerts/${id}/visualizar`);
  return data;
};

export default api;
