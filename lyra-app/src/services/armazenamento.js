import AsyncStorage from '@react-native-async-storage/async-storage';

// Dados permanentes da conta (nunca apagados no logout)
const CONTA = {
  USUARIO: 'lyra_conta_usuario',
  SENHA:   'lyra_conta_senha',
  CODIGO:  'lyra_conta_codigo',
};

// Dados de sessão (apagados no logout)
const SESSAO = {
  MODO: 'lyra_sessao_modo',
};

// ── Conta (permanente) ────────────────────────────────────────────────────────

export const salvarConta = async (usuario, senha, codigo) => {
  await AsyncStorage.multiSet([
    [CONTA.USUARIO, usuario],
    [CONTA.SENHA,   senha],
    [CONTA.CODIGO,  codigo],
  ]);
};

export const lerConta = async () => {
  const pares = await AsyncStorage.multiGet([CONTA.USUARIO, CONTA.SENHA, CONTA.CODIGO]);
  return {
    usuario: pares[0][1],
    senha:   pares[1][1],
    codigo:  pares[2][1],
  };
};

export const contaExiste = async () => {
  const usuario = await AsyncStorage.getItem(CONTA.USUARIO);
  return !!usuario;
};

export const salvarModo = (modo) => AsyncStorage.setItem(SESSAO.MODO, modo);
export const lerModo = () => AsyncStorage.getItem(SESSAO.MODO);

export const salvarToken = (token) => AsyncStorage.setItem('lyra_jwt_token', token);
export const lerToken = () => AsyncStorage.getItem('lyra_jwt_token');
export const removerToken = () => AsyncStorage.removeItem('lyra_jwt_token');

export const encerrarSessao = async () => {
  await AsyncStorage.removeItem(SESSAO.MODO);
  await AsyncStorage.removeItem('lyra_jwt_token');
};


// ── Gerador de código ─────────────────────────────────────────────────────────

export const gerarCodigo = () =>
  Math.floor(100000 + Math.random() * 900000).toString();