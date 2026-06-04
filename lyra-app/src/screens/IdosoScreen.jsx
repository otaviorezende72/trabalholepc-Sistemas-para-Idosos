import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Animated, Vibration, Alert, Dimensions, Keyboard, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { CORES, SOMBRA } from '../theme';
import { falar, pedirPermissaoMicrofone, confirmarPorVoz, negarPorVoz } from '../services/voz';
import { listarMedicamentos, criarAlerta } from '../services/api';
import { wsService } from '../services/websocket';
import { encerrarSessao } from '../services/armazenamento';

const { width: SW } = Dimensions.get('window');

export default function IdosoScreen({ navigation }) {
  const [medicamentos, setMedicamentos] = useState([]);
  const [medAtivo, setMedAtivo] = useState(null);
  const [vozAtiva, setVozAtiva] = useState(false);
  const [sosAtivado, setSosAtivado] = useState(false);
  
  const pulsoSos = useRef(new Animated.Value(1)).current;

  useEffect(() => { inicializar(); return () => wsService.desconectar(); }, []);
  useEffect(() => {
    if (sosAtivado) { Animated.loop(Animated.sequence([Animated.timing(pulsoSos, { toValue: 1.05, duration: 800, useNativeDriver: true }), Animated.timing(pulsoSos, { toValue: 1.0, duration: 800, useNativeDriver: true })])).start(); } 
    else { pulsoSos.setValue(1); }
  }, [sosAtivado]);

  const inicializar = async () => { await pedirPermissaoMicrofone(); await carregarMedicamentos(); wsService.resetar(); wsService.conectar('mobile'); wsService.on('MEDICATION_CONFIRMED', carregarMedicamentos); };
  const carregarMedicamentos = async () => { try { setMedicamentos((await listarMedicamentos()).filter(m => m.active)); } catch {} };

  const handleSair = () => { Alert.alert('Sair', 'Sair do modo paciente?', [{ text: 'Cancelar' }, { text: 'Sair', onPress: async () => { await encerrarSessao(); navigation.replace('Onboarding'); } }]); };
  
  const handleSos = () => {
    setSosAtivado(true); Vibration.vibrate([0, 400, 200, 400]);
    criarAlerta('SOS').then(() => falar('Sua família foi avisada. Estou aqui com você. Fique calmo.'));
  };

  const handleConfirmar = async (med) => { try { await confirmarPorVoz(med.id); await carregarMedicamentos(); setMedAtivo(null); } catch { falar('Tente de novo.'); } };
  const handleTocarMed = async (med) => { setMedAtivo(med); setVozAtiva(true); await falar(med.name + '. Você já tomou?'); setVozAtiva(false); };

  const jaConfirmado = (med) => med.status === 'tomado';

  return (
    <SafeAreaView style={s.safe}>
      {/* Header CliniQ Minimal */}
      <View style={s.header}>
        <View style={s.iconBtnPlaceholder} />
        <Text style={s.headerTitle}>Meu Cuidado</Text>
        <TouchableOpacity style={s.iconBtn} onPress={handleSair}><Feather name="log-out" size={20} color={CORES.primaria} /></TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* SOS - Circular Card */}
        <View style={s.sosSection}>
          <Animated.View style={{ transform: [{ scale: pulsoSos }] }}>
            <TouchableOpacity style={[s.sosBtn, sosAtivado && s.sosBtnAtivo]} onPress={handleSos} activeOpacity={0.85}>
              <View style={s.sosInner}>
                <Feather name="alert-circle" size={40} color={CORES.branco} />
                <Text style={s.sosTitulo}>Ajuda</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {medAtivo && (
          <View style={s.lembreteCard}>
            <View style={s.medRowIcon}><Feather name="clock" size={24} color={CORES.primaria} /></View>
            <Text style={s.lembreteNome}>{medAtivo.name}</Text>
            <Text style={s.lembretePergunta}>Você já tomou?</Text>
            <View style={s.botoesRow}>
              <TouchableOpacity style={s.simBtn} onPress={() => handleConfirmar(medAtivo)}><Text style={s.simBtnTxt}>Sim</Text></TouchableOpacity>
              <TouchableOpacity style={s.naoBtn} onPress={() => setMedAtivo(null)}><Text style={s.naoBtnTxt}>Ainda não</Text></TouchableOpacity>
            </View>
          </View>
        )}

        <Text style={s.sectionTitle}>Remédios de hoje</Text>
        {medicamentos.map(med => (
          <TouchableOpacity key={med.id} style={[s.medCard, jaConfirmado(med) && s.medCardOk]} onPress={() => !jaConfirmado(med) && handleTocarMed(med)} activeOpacity={0.8}>
            <View style={[s.medCardIcon, jaConfirmado(med) && s.medCardIconOk]}><Feather name={jaConfirmado(med) ? 'check' : 'plus'} size={24} color={jaConfirmado(med) ? CORES.sucesso : CORES.primaria} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.medCardNome}>{med.name}</Text>
              <Text style={s.medCardDosagem}>{med.dosage} • {med.time}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: CORES.secundaria },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 10, paddingBottom: 20 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: CORES.texto },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: CORES.branco, alignItems: 'center', justifyContent: 'center', ...SOMBRA.pequena },
  iconBtnPlaceholder: { width: 44, height: 44 },

  scroll: { padding: 24, paddingBottom: 40 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: CORES.texto, marginVertical: 16 },

  // SOS Redesenhado
  sosSection: { alignItems: 'center', marginVertical: 20 },
  sosBtn: { width: SW * 0.5, height: SW * 0.5, borderRadius: SW * 0.25, backgroundColor: CORES.sos, alignItems: 'center', justifyContent: 'center', borderWidth: 8, borderColor: '#FCA5A5', ...SOMBRA.grande },
  sosBtnAtivo: { backgroundColor: '#991B1B', borderColor: '#EF4444' },
  sosInner: { alignItems: 'center' },
  sosTitulo: { fontSize: 28, fontWeight: '800', color: CORES.branco, marginTop: 8 },

  // Cards de Med
  medCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: CORES.branco, borderRadius: 24, padding: 20, marginBottom: 16, ...SOMBRA.pequena },
  medCardOk: { backgroundColor: '#F0FDF4' },
  medCardIcon: { width: 60, height: 60, borderRadius: 20, backgroundColor: CORES.secundaria, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  medCardIconOk: { backgroundColor: '#DCFCE7' },
  medCardNome: { fontSize: 20, fontWeight: '700', color: CORES.texto },
  medCardDosagem: { fontSize: 15, color: CORES.textoSecundario, marginTop: 4 },

  // Modal ativo
  lembreteCard: { backgroundColor: CORES.branco, borderRadius: 32, padding: 24, alignItems: 'center', marginBottom: 24, borderWidth: 2, borderColor: CORES.primariaClara, ...SOMBRA.media },
  medRowIcon: { width: 64, height: 64, borderRadius: 24, backgroundColor: CORES.primariaClara, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  lembreteNome: { fontSize: 28, fontWeight: '800', color: CORES.texto },
  lembretePergunta: { fontSize: 18, color: CORES.textoSecundario, marginVertical: 16 },
  botoesRow: { flexDirection: 'row', gap: 12, width: '100%' },
  simBtn: { flex: 1, backgroundColor: CORES.primaria, borderRadius: 20, paddingVertical: 18, alignItems: 'center' },
  simBtnTxt: { color: CORES.branco, fontSize: 18, fontWeight: '700' },
  naoBtn: { flex: 1, backgroundColor: CORES.secundaria, borderRadius: 20, paddingVertical: 18, alignItems: 'center' },
  naoBtnTxt: { color: CORES.textoSecundario, fontSize: 18, fontWeight: '700' },
});