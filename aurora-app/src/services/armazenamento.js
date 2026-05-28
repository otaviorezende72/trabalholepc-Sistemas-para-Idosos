import AsyncStorage from '@react-native-async-storage/async-storage';

// Chaves de armazenamento
const CHAVES = {
  MODO: 'aurora_modo',           // 'FAMILIAR' ou 'IDOSO'
  FAMILIAR_ID: 'aurora_familiar_id',
  IDOSO_ID: 'aurora_idoso_id',
  ONBOARDING: 'aurora_onboarding',
};

// ── Salvar ────────────────────────────────────────────────────────────────────

export const salvarModo = (modo) =>
  AsyncStorage.setItem(CHAVES.MODO, modo);

export const salvarFamiliarId = (id) =>
  AsyncStorage.setItem(CHAVES.FAMILIAR_ID, id);

export const salvarIdosoId = (id) =>
  AsyncStorage.setItem(CHAVES.IDOSO_ID, id);

export const concluirOnboarding = () =>
  AsyncStorage.setItem(CHAVES.ONBOARDING, 'true');

// ── Ler ───────────────────────────────────────────────────────────────────────

export const lerModo = () => AsyncStorage.getItem(CHAVES.MODO);
export const lerFamiliarId = () => AsyncStorage.getItem(CHAVES.FAMILIAR_ID);
export const lerIdosoId = () => AsyncStorage.getItem(CHAVES.IDOSO_ID);
export const lerOnboarding = async () => {
  const val = await AsyncStorage.getItem(CHAVES.ONBOARDING);
  return val === 'true';
};

// ── Limpar sessão ─────────────────────────────────────────────────────────────

export const limparSessao = () => AsyncStorage.multiRemove(Object.values(CHAVES));
