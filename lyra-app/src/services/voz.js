import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';

// ── Text-to-Speech (lyra fala) ──────────────────────────────────────────────

export const falar = (texto, opcoes = {}) => {
  return new Promise((resolve) => {
    Speech.speak(texto, {
      language: 'pt-BR',
      rate: 0.85,      // um pouco mais devagar para idosos
      pitch: 1.0,
      onDone: resolve,
      onError: resolve, // mesmo em erro, resolve para não travar
      ...opcoes,
    });
  });
};

export const pararFala = () => {
  Speech.stop();
};

export const estaFalando = async () => {
  return await Speech.isSpeakingAsync();
};

// ── Permissão de Microfone ────────────────────────────────────────────────────

export const pedirPermissaoMicrofone = async () => {
  const { status } = await Audio.requestPermissionsAsync();
  return status === 'granted';
};

// ── Gravação de Áudio (para enviar ao backend) ─────────────────────────────────
// O reconhecimento de fala (STT) é feito pelo Google Speech Recognition
// através da API nativa do dispositivo

let gravacao = null;

export const iniciarGravacao = async () => {
  try {
    const temPermissao = await pedirPermissaoMicrofone();
    if (!temPermissao) throw new Error('Sem permissão de microfone');

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    gravacao = new Audio.Recording();
    await gravacao.prepareToRecordAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    await gravacao.startAsync();
    return true;
  } catch (erro) {
    console.error('Erro ao iniciar gravação:', erro);
    return false;
  }
};

export const pararGravacao = async () => {
  try {
    if (!gravacao) return null;
    await gravacao.stopAndUnloadAsync();
    const uri = gravacao.getURI();
    gravacao = null;
    return uri; // caminho do arquivo de áudio gravado
  } catch (erro) {
    console.error('Erro ao parar gravação:', erro);
    return null;
  }
};
