import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, Vibration, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { falar, pararFala, pedirPermissaoMicrofone } from '../services/voz';
import { enviarMensagem, acionarSos, confirmarMedicamento, listarMedicamentos } from '../services/api';
import { lerIdosoId } from '../services/armazenamento';
import CartaoMedicamento from '../components/CartaoMedicamento';
import VozIndicador from '../components/VozIndicador';

export default function IdosoScreen() {
  const [idosoId, setIdosoId] = useState(null);
  const [medicamentos, setMedicamentos] = useState([]);
  const [medicamentosConfirmados, setMedicamentosConfirmados] = useState(new Set());
  const [vozAtiva, setVozAtiva] = useState(false);
  const [sosAtivado, setSosAtivado] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [respondendo, setRespondendo] = useState(false);

  // Carrega dados ao abrir a tela
  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    const id = await lerIdosoId();
    if (!id) return;
    setIdosoId(id);

    try {
      const meds = await listarMedicamentos(id);
      setMedicamentos(meds);
    } catch (e) {
      console.log('Erro ao carregar medicamentos:', e.message);
    }
  };

  // ── Confirmar Medicamento ─────────────────────────────────────────────────

  const handleConfirmarMedicamento = async (medicamentoId, horario) => {
    try {
      await confirmarMedicamento(medicamentoId, idosoId, horario);
      setMedicamentosConfirmados(prev => new Set([...prev, medicamentoId]));
      await falar('Ótimo! Medicamento confirmado.');
    } catch (e) {
      Alert.alert('Erro', 'Não consegui confirmar. Tente de novo.');
    }
  };

  // ── Botão SOS ─────────────────────────────────────────────────────────────

  const handleSos = async () => {
    // Confirmação antes de acionar
    Alert.alert(
      '🚨 Chamar Família?',
      'Deseja enviar um alerta de emergência agora?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'SIM, chamar!',
          style: 'destructive',
          onPress: async () => {
            setSosAtivado(true);
            Vibration.vibrate([0, 500, 200, 500]);
            try {
              await acionarSos(idosoId, 'botao_panico');
              await falar('Sua família foi avisada. Estou aqui com você.');
            } catch (e) {
              await falar('Estou tentando avisar sua família. Aguarde.');
            }
          },
        },
      ]
    );
  };

  // ── Falar com lyra (toque para falar) ────────────────────────────────────

  const handleFalarComlyra = async () => {
    if (respondendo) return;

    const temPermissao = await pedirPermissaoMicrofone();
    if (!temPermissao) {
      Alert.alert('Permissão', 'Preciso de acesso ao microfone.');
      return;
    }

    // Esta é uma versão simplificada — em produção use expo-speech-recognition
    await falar('Estou ouvindo você. Pode falar.');
    setVozAtiva(true);

    // Simula escuta por 5 segundos e envia texto de teste
    // Em produção, aqui você integra o reconhecimento de voz nativo
    setTimeout(async () => {
      setVozAtiva(false);
      setRespondendo(true);
      try {
        const resultado = await enviarMensagem(idosoId, 'Como você está?');
        await falar(resultado.resposta);
      } catch (e) {
        await falar('Desculpe, tive um probleminha. Tudo bem com você?');
      } finally {
        setRespondendo(false);
      }
    }, 5000);
  };

  return (
    <SafeAreaView style={estilos.container}>
      <ScrollView contentContainerStyle={estilos.scroll}>

        {/* Cabeçalho */}
        <View style={estilos.cabecalho}>
          <Text style={estilos.titulo}>Olá! 👋</Text>
          <Text style={estilos.subtitulo}>lyra está aqui com você</Text>
          <VozIndicador ativa={vozAtiva || respondendo} />
        </View>

        {/* Botão SOS */}
        <TouchableOpacity
          style={[estilos.botaoSos, sosAtivado && estilos.botaoSosAtivado]}
          onPress={handleSos}
          activeOpacity={0.8}
        >
          <Text style={estilos.sosTitulo}>🚨</Text>
          <Text style={estilos.sosTexto}>SOS</Text>
          <Text style={estilos.sosSubtexto}>Chamar família</Text>
        </TouchableOpacity>

        {/* Botão de conversa */}
        <TouchableOpacity
          style={[estilos.botaoVoz, (vozAtiva || respondendo) && estilos.botaoVozAtivo]}
          onPress={handleFalarComlyra}
          disabled={respondendo}
          activeOpacity={0.8}
        >
          {respondendo ? (
            <ActivityIndicator color="#fff" size="large" />
          ) : (
            <>
              <Text style={estilos.vozIcone}>🎤</Text>
              <Text style={estilos.vozTexto}>
                {vozAtiva ? 'Ouvindo...' : 'Falar com lyra'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Medicamentos do dia */}
        {medicamentos.length > 0 && (
          <View style={estilos.secao}>
            <Text style={estilos.secaoTitulo}>💊 Seus remédios de hoje</Text>
            {medicamentos.map((med) => (
              <CartaoMedicamento
                key={med.id}
                medicamento={med}
                confirmado={medicamentosConfirmados.has(med.id)}
                onConfirmar={(horario) => handleConfirmarMedicamento(med.id, horario)}
              />
            ))}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4FF' },
  scroll: { padding: 24, alignItems: 'center' },

  cabecalho: { alignItems: 'center', marginBottom: 32 },
  titulo: { fontSize: 32, fontWeight: 'bold', color: '#1A1A2E' },
  subtitulo: { fontSize: 16, color: '#666', marginTop: 4 },

  // SOS
  botaoSos: {
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: '#D32F2F',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#D32F2F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  botaoSosAtivado: { backgroundColor: '#B71C1C' },
  sosTitulo: { fontSize: 40 },
  sosTexto: { fontSize: 36, fontWeight: 'bold', color: '#fff' },
  sosSubtexto: { fontSize: 14, color: 'rgba(255,255,255,0.85)' },

  // Voz
  botaoVoz: {
    width: '100%', height: 80, borderRadius: 16,
    backgroundColor: '#1565C0',
    flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    gap: 12, marginBottom: 32,
  },
  botaoVozAtivo: { backgroundColor: '#0D47A1' },
  vozIcone: { fontSize: 28 },
  vozTexto: { fontSize: 20, fontWeight: '600', color: '#fff' },

  // Medicamentos
  secao: { width: '100%' },
  secaoTitulo: { fontSize: 20, fontWeight: 'bold', color: '#1A1A2E', marginBottom: 12 },
});
