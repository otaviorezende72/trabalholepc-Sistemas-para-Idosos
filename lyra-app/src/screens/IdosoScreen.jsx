import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Animated, Vibration, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { CORES, SOMBRA } from '../theme';
import { falar, pedirPermissaoMicrofone, confirmarPorVoz, negarPorVoz } from '../services/voz';
import { listarMedicamentos, criarAlerta } from '../services/api';
import { wsService } from '../services/websocket';
import { encerrarSessao } from '../services/armazenamento';

export default function IdosoScreen({ navigation }) {
  const [medicamentos, setMedicamentos] = useState([]);
  const [medicamentoAtivo, setMedicamentoAtivo] = useState(null);
  const [escutando, setEscutando] = useState(false);
  const [sosAtivado, setSosAtivado] = useState(false);
  const [saudacao, setSaudacao] = useState('');
  const pulsoSos = useRef(new Animated.Value(1)).current;
  const ondaMic = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    inicializar();
    return () => wsService.desconectar();
  }, []);

  useEffect(() => {
    if (sosAtivado) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulsoSos, { toValue: 1.08, duration: 700, useNativeDriver: true }),
          Animated.timing(pulsoSos, { toValue: 1.0, duration: 700, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulsoSos.setValue(1);
    }
  }, [sosAtivado]);

  useEffect(() => {
    if (escutando) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(ondaMic, { toValue: 1.25, duration: 600, useNativeDriver: true }),
          Animated.timing(ondaMic, { toValue: 1.0, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      ondaMic.setValue(1);
    }
  }, [escutando]);

  const inicializar = async () => {
    await pedirPermissaoMicrofone();
    await carregarMedicamentos();
    definirSaudacao();
    wsService.conectar('mobile');
    wsService.on('MEDICATION_CONFIRMED', () => carregarMedicamentos());
  };

  const definirSaudacao = () => {
    const hora = new Date().getHours();
    if (hora < 12) setSaudacao('Bom dia');
    else if (hora < 18) setSaudacao('Boa tarde');
    else setSaudacao('Boa noite');
  };

  const carregarMedicamentos = async () => {
    try {
      const meds = await listarMedicamentos();
      setMedicamentos(meds.filter(m => m.active));
    } catch (e) {
      console.log('Erro medicamentos:', e.message);
    }
  };

  const handleSair = () => {
    Alert.alert(
      'Sair',
      'Deseja voltar à tela de seleção de perfil?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            await encerrarSessao();
            navigation.replace('Onboarding');
          },
        },
      ]
    );
  };

  const handleSos = () => {
    Alert.alert(
      'Chamar ajuda?',
      'Isso vai avisar sua família agora.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Chamar agora',
          style: 'destructive',
          onPress: async () => {
            setSosAtivado(true);
            Vibration.vibrate([0, 400, 200, 400]);
            await criarAlerta('SOS');
            await falar('Sua família foi avisada. Estou aqui com você. Fique calmo.');
          },
        },
      ]
    );
  };

  const handleConfirmar = async (med) => {
    try {
      await confirmarPorVoz(med.id);
      await carregarMedicamentos();
      setMedicamentoAtivo(null);
    } catch (e) {
      await falar('Não consegui registrar agora. Tente de novo.');
    }
  };

  const handleNegar = async (med) => {
    await negarPorVoz(med.id);
    setMedicamentoAtivo(null);
  };

  const handleTocarMedicamento = async (med) => {
    setMedicamentoAtivo(med);
    await falar(med.name + ', ' + med.dosage + '. Você já tomou?');
  };

  const jaConfirmado = (med) => med.status === 'tomado';

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.saudacao}>{saudacao}</Text>
            <Text style={s.subtitulo}>Lyra está com você</Text>
          </View>
          <View style={s.headerAcoes}>
            <View style={[s.statusPill, escutando && s.statusPillAtivo]}>
              <View style={[s.statusDot, escutando && s.statusDotAtivo]} />
              <Text style={[s.statusTexto, escutando && s.statusTextoAtivo]}>
                {escutando ? 'Ouvindo' : 'Ativa'}
              </Text>
            </View>
            <TouchableOpacity style={s.sairBotao} onPress={handleSair}>
              <Feather name="log-out" size={18} color={CORES.textoSecundario} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Lembrete de medicamento ativo */}
        {medicamentoAtivo && (
          <View style={s.lembreteCard}>
            <View style={s.lembreteIconeContainer}>
              <Feather name="clock" size={20} color={CORES.primaria} />
            </View>
            <Text style={s.lembreteTitulo}>Hora do remédio</Text>
            <Text style={s.lembreteNome}>{medicamentoAtivo.name}</Text>
            <Text style={s.lembreteDosagem}>{medicamentoAtivo.dosage}</Text>
            <Text style={s.lembretePergunta}>Você já tomou?</Text>
            <View style={s.lembreteBotoes}>
              <TouchableOpacity
                style={s.botaoSim}
                onPress={() => handleConfirmar(medicamentoAtivo)}
              >
                <Feather name="check" size={20} color={CORES.branco} />
                <Text style={s.botaoSimTexto}>Sim, tomei</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.botaoNao}
                onPress={() => handleNegar(medicamentoAtivo)}
              >
                <Text style={s.botaoNaoTexto}>Ainda não</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Botão SOS */}
        <View style={s.sosArea}>
          <Animated.View style={{ transform: [{ scale: pulsoSos }] }}>
            <TouchableOpacity
              style={[s.botaoSos, sosAtivado && s.botaoSosAtivado]}
              onPress={handleSos}
              activeOpacity={0.85}
            >
              <Feather name="alert-triangle" size={40} color={CORES.branco} />
              <Text style={s.sosTitulo}>SOS</Text>
              <Text style={s.sosSubtitulo}>
                {sosAtivado ? 'Família avisada' : 'Chamar família'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
          <Text style={s.sosDica}>Toque para pedir ajuda</Text>
        </View>

        {/* Medicamentos do dia */}
        {medicamentos.length > 0 && (
          <View style={s.secao}>
            <Text style={s.secaoTitulo}>Remédios de hoje</Text>
            {medicamentos.map((med) => (
              <TouchableOpacity
                key={med.id}
                style={[s.cartaoMed, jaConfirmado(med) && s.cartaoMedConfirmado]}
                onPress={() => !jaConfirmado(med) && handleTocarMedicamento(med)}
                activeOpacity={jaConfirmado(med) ? 1 : 0.7}
              >
                <View style={[s.medIconeContainer, jaConfirmado(med) && s.medIconeContainerOk]}>
                  <Feather
                    name={jaConfirmado(med) ? 'check' : 'package'}
                    size={20}
                    color={jaConfirmado(med) ? CORES.sucesso : CORES.primaria}
                  />
                </View>
                <View style={s.medInfo}>
                  <Text style={s.medNome}>{med.name}</Text>
                  <Text style={s.medDetalhe}>{med.dosage}</Text>
                  <View style={s.medHorarioRow}>
                    <Feather name="clock" size={11} color={CORES.primaria} />
                    <Text style={s.medHorario}>{med.time}</Text>
                  </View>
                </View>
                {!jaConfirmado(med) && (
                  <View style={s.medBotao}>
                    <Text style={s.medBotaoTexto}>Tomei</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: CORES.secundaria },
  scroll: { padding: 20, paddingBottom: 40 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 28,
  },
  saudacao: { fontSize: 28, fontWeight: '800', color: CORES.texto },
  subtitulo: { fontSize: 14, color: CORES.textoSecundario, marginTop: 2 },
  headerAcoes: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: CORES.borda, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  statusPillAtivo: { backgroundColor: CORES.primariaClara },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: CORES.textoSecundario },
  statusDotAtivo: { backgroundColor: CORES.primaria },
  statusTexto: { fontSize: 12, color: CORES.textoSecundario, fontWeight: '500' },
  statusTextoAtivo: { color: CORES.primaria },
  sairBotao: { padding: 6 },

  lembreteCard: {
    backgroundColor: CORES.branco, borderRadius: 20, padding: 24,
    alignItems: 'center', marginBottom: 24,
    borderWidth: 1.5, borderColor: CORES.primaria,
    ...SOMBRA.media,
  },
  lembreteIconeContainer: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: CORES.primariaClara,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  lembreteTitulo: {
    fontSize: 13, fontWeight: '600', color: CORES.primaria,
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  lembreteNome: { fontSize: 24, fontWeight: '800', color: CORES.texto, marginBottom: 4 },
  lembreteDosagem: { fontSize: 15, color: CORES.textoSecundario, marginBottom: 16 },
  lembretePergunta: { fontSize: 17, color: CORES.texto, fontWeight: '600', marginBottom: 20 },
  lembreteBotoes: { flexDirection: 'row', gap: 10, width: '100%' },
  botaoSim: {
    flex: 1, backgroundColor: CORES.primaria, borderRadius: 14,
    paddingVertical: 15, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  botaoSimTexto: { color: CORES.branco, fontSize: 16, fontWeight: '700' },
  botaoNao: {
    flex: 1, backgroundColor: CORES.secundaria, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: CORES.borda,
  },
  botaoNaoTexto: { color: CORES.textoSecundario, fontSize: 16, fontWeight: '600' },

  sosArea: { alignItems: 'center', marginBottom: 36 },
  botaoSos: {
    width: 176, height: 176, borderRadius: 88,
    backgroundColor: CORES.sos,
    alignItems: 'center', justifyContent: 'center',
    gap: 4, ...SOMBRA.grande,
  },
  botaoSosAtivado: { backgroundColor: '#991B1B' },
  sosTitulo: { fontSize: 32, fontWeight: '900', color: CORES.branco, letterSpacing: 2 },
  sosSubtitulo: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  sosDica: { fontSize: 13, color: CORES.textoSecundario, marginTop: 14 },

  secao: { marginBottom: 24 },
  secaoTitulo: { fontSize: 16, fontWeight: '700', color: CORES.texto, marginBottom: 12 },
  cartaoMed: {
    backgroundColor: CORES.branco, borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginBottom: 10, ...SOMBRA.pequena,
  },
  cartaoMedConfirmado: { backgroundColor: CORES.sucessoClaro },
  medIconeContainer: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: CORES.primariaClara,
    alignItems: 'center', justifyContent: 'center',
  },
  medIconeContainerOk: { backgroundColor: '#DCFCE7' },
  medInfo: { flex: 1 },
  medNome: { fontSize: 16, fontWeight: '700', color: CORES.texto },
  medDetalhe: { fontSize: 13, color: CORES.textoSecundario, marginTop: 2 },
  medHorarioRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  medHorario: { fontSize: 12, color: CORES.primaria, fontWeight: '600' },
  medBotao: {
    backgroundColor: CORES.primaria, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  medBotaoTexto: { color: CORES.branco, fontWeight: '700', fontSize: 13 },
});
