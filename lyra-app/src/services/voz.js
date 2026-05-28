import * as Speech from 'expo-speech';
import { Platform, PermissionsAndroid } from 'react-native';

// ── TTS — Lyra fala ───────────────────────────────────────────────────────────

export const falar = (texto) => {
  return new Promise((resolve) => {
    Speech.stop();
    Speech.speak(texto, {
      language: 'pt-BR',
      rate: 0.85,
      pitch: 1.05,
      onDone: resolve,
      onError: resolve,
    });
  });
};

export const pararFala = () => Speech.stop();

// ── Permissão de microfone ────────────────────────────────────────────────────

export const pedirPermissaoMicrofone = async () => {
  if (Platform.OS === 'android') {
    try {
      const resultado = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Permissão de Microfone',
          message: 'O Lyra precisa acessar o microfone para ouvir você.',
          buttonPositive: 'Permitir',
          buttonNegative: 'Cancelar',
        }
      );
      return resultado === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  }
  return true; // iOS pede permissão automaticamente
};

// ── Confirmação e negação por voz ─────────────────────────────────────────────

export const confirmarPorVoz = async (medicamentoId) => {
  const { confirmarMedicamento } = await import('./api');
  await confirmarMedicamento(medicamentoId);
  await falar('Ótimo! Registrado. Cuide-se bem!');
};

export const negarPorVoz = async () => {
  await falar('Tudo bem. Lembre-se de tomar assim que puder, combinado?');
};

// ── SOS por voz ───────────────────────────────────────────────────────────────

export const acionarSosPorVoz = async () => {
  const { criarAlerta } = await import('./api');
  await criarAlerta('SOS');
  await falar('Entendido. Acionando emergência imediatamente. Sua família foi avisada.');
};
