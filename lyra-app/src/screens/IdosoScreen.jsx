import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Animated, Vibration, Alert, Dimensions, Keyboard, Platform, Modal, TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { CORES, SOMBRA } from '../theme';
import { falar, pedirPermissaoMicrofone, confirmarPorVoz, negarPorVoz } from '../services/voz';
import {
  listarMedicamentos,
  criarAlerta,
  criarMedicamento
} from '../services/api';
import { wsService } from '../services/websocket';
import { encerrarSessao } from '../services/armazenamento';

const { width: SW } = Dimensions.get('window');

export default function IdosoScreen({ navigation }) {
  const [medicamentos, setMedicamentos] = useState([]);
  const [medAtivo, setMedAtivo] = useState(null);
  const [vozAtiva, setVozAtiva] = useState(false);
  const [sosAtivado, setSosAtivado] = useState(false);
  
  const pulsoSos = useRef(new Animated.Value(1)).current;
  const [modalMed, setModalMed] = useState(false);
  const [nomeMed, setNomeMed] = useState('');
  const [dosagemMed, setDosagemMed] = useState('');
  const [horariosMed, setHorariosMed] = useState(['08:00']);
  const [diasMed, setDiasMed] = useState([]);
  const [salvandoMed, setSalvandoMed] = useState(false);

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
  const handleAdicionarMed = async () => {
    if (!nomeMed.trim() || !dosagemMed.trim()) {
      Alert.alert('Atenção', 'Preencha o nome e a dosagem do medicamento.');
      return;
    }

    setSalvandoMed(true);

    try {
      const novo = await criarMedicamento(
        nomeMed,
        dosagemMed,
        horariosMed.join(', '), // 👈 TODOS os horários
      );

      setMedicamentos((p) => [...p, { ...novo, active: true }]);

      setModalMed(false);
      setNomeMed('');
      setDosagemMed('');
      setHorariosMed(['08:00']); // 👈 reset correto
      setDiasMed([]); // 👈 reset dias também
    } catch (err) {
      console.log("❌ ERRO:", err);
      Alert.alert(
        "Erro ao salvar",
        JSON.stringify(err?.response?.data || err.message)
      );
    } finally {
      setSalvandoMed(false);
    }
  };
  const handleTocarMed = async (med) => { setMedAtivo(med); setVozAtiva(true); await falar(med.name + '. Você já tomou?'); setVozAtiva(false); };

  const jaConfirmado = (med) => med.status === 'tomado';

  const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  const toggleDia = (dia) => {
    setDiasMed(prev =>
      prev.includes(dia)
        ? prev.filter(d => d !== dia)
        : [...prev, dia]
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      {/* Header CliniQ Minimal */}
      
      <View style={s.headerRow}>
        <View style={{ width: 44 }} />

        <Text style={s.cuidadoTitle}>Cuidando de Mim</Text>

        <TouchableOpacity onPress={handleSair} style={s.sairBtn}>
          <Feather name="log-out" size={22} color={CORES.primaria} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* SOS - Circular Card */}
        <View style={s.helpSection}>
          <Text style={s.helpDescription}>
            Em caso de emergência peça por ajuda ou clique no botão abaixo
          </Text>

          <TouchableOpacity
            style={s.helpButton}
            onPress={handleSos}
            activeOpacity={0.85}
          >
            <Feather name="alert-triangle" size={24} color={CORES.branco} />
            <Text style={s.helpText}>AJUDA</Text>
          </TouchableOpacity>
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

        <View style={s.rotinaSection}>
          <Text style={s.sectionTitle}>Rotina do Dia</Text>

          <Text style={s.rotinaSub}>
            Suas tarefas programadas para hoje
          </Text>
        </View>
        {medicamentos.map(med => (
          <TouchableOpacity key={med.id} style={[s.medCard, jaConfirmado(med) && s.medCardOk]} onPress={() => !jaConfirmado(med) && handleTocarMed(med)} activeOpacity={0.8}>
            <View style={[s.medCardIcon, jaConfirmado(med) && s.medCardIconOk]}><Feather name={jaConfirmado(med) ? 'check' : 'plus'} size={24} color={jaConfirmado(med) ? CORES.sucesso : CORES.primaria} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.medCardNome}>{med.name}</Text>
              <Text style={s.medCardDosagem}>
                {med.dosage}
              </Text>

              {med.time && (
                <Text style={s.medCardDosagem}>
                  🕒 {med.time}
                </Text>
              )}

              {med.days && Array.isArray(med.days) && (
                <Text style={s.medCardDosagem}>
                  📅 {med.days.join(', ')}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={s.bottomButtonContainer}>
        <View style={s.fabContainer}>
  
          <TouchableOpacity
            style={s.micBtn}
            onPress={() => console.log('capturar áudio')}
          >
            <Feather name="mic" size={20} color={CORES.branco} />
          </TouchableOpacity>

          <TouchableOpacity
            style={s.iconBtnAction}
            onPress={() => setModalMed(true)}
          >
            <Feather name="plus" size={20} color={CORES.branco} />
          </TouchableOpacity>

        </View>
      </View>
      <Modal visible={modalMed} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>

            <View style={s.modalDrag} />
            <Text style={s.modalTitle}>Novo Medicamento</Text>

            <ScrollView showsVerticalScrollIndicator={false}>

            <View style={s.field}>
              <Text style={s.fieldTxt}>Nome</Text>
              <TextInput
                style={s.input}
                value={nomeMed}
                onChangeText={setNomeMed}
              />
            </View>

            <View style={s.field}>
              <Text style={s.fieldTxt}>Dosagem</Text>
              <TextInput
                style={s.input}
                value={dosagemMed}
                onChangeText={setDosagemMed}
              />
            </View>

            <Text style={s.fieldTxt}>Dias da Semana</Text>

            <View style={s.daysContainer}>
              {DIAS_SEMANA.map(dia => (
                <TouchableOpacity
                  key={dia}
                  style={[
                    s.dayChip,
                    diasMed.includes(dia) && s.dayChipSelected
                  ]}
                  onPress={() => toggleDia(dia)}
                >
                  <Text style={
                    diasMed.includes(dia)
                      ? s.dayChipTextSelected
                      : s.dayChipText
                  }>
                    {dia}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[s.fieldTxt, { marginTop: 20 }]}>
              Horários
            </Text>

            {horariosMed.map((hora, index) => (
              <TextInput
                key={index}
                style={[s.input, { marginBottom: 10 }]}
                value={hora}
                onChangeText={(text) => {
                  const copia = [...horariosMed];
                  copia[index] = text;
                  setHorariosMed(copia);
                }}
              />
            ))}

            <TouchableOpacity
              style={s.addTimeBtn}
              onPress={() =>
                setHorariosMed([...horariosMed, '08:00'])
              }
            >
              <Feather name="plus" size={16} color={CORES.branco} />
              <Text style={s.addTimeText}>Adicionar horário</Text>
            </TouchableOpacity>


            <TouchableOpacity
              style={[s.btnPrimary, salvandoMed && { opacity: 0.6 }]}
              onPress={handleAdicionarMed}
              disabled={salvandoMed}
            >
              <Text style={s.btnText}>Adicionar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.btnCancel]}
              onPress={() => setModalMed(false)}
            >
              <Text style={s.btnCancelText}>Cancelar</Text>
            </TouchableOpacity>
            </ScrollView>
          </View>
            
        </View>
      </Modal>
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

  headerRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: 20,
},

bottomButtonContainer: {
  position: 'absolute',
  bottom: 30,
  alignSelf: 'center',
},

iconBtnAction: {
  width: 60,
  height: 60,
  borderRadius: 30,
  backgroundColor: CORES.primaria,
  alignItems: 'center',
  justifyContent: 'center',
  ...SOMBRA.pequena,
},

modalOverlay: {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.3)',
  justifyContent: 'flex-end',
},

modalCard: {
  backgroundColor: CORES.branco,
  borderTopLeftRadius: 32,
  borderTopRightRadius: 32,
  padding: 24,
  paddingBottom: 40,
},

modalDrag: {
  width: 40,
  height: 4,
  borderRadius: 2,
  backgroundColor: CORES.borda,
  alignSelf: 'center',
  marginBottom: 20,
},

modalTitle: {
  fontSize: 20,
  fontWeight: '700',
  color: CORES.texto,
  marginBottom: 24,
},

field: {
  marginBottom: 16,
},

fieldTxt: {
  fontSize: 13,
  fontWeight: '600',
  color: CORES.textoSecundario,
  marginBottom: 8,
},

input: {
  backgroundColor: CORES.secundaria,
  borderRadius: 16,
  padding: 16,
  fontSize: 15,
  color: CORES.texto,
},

btnPrimary: {
  backgroundColor: CORES.primaria,
  borderRadius: 16,
  padding: 16,
  alignItems: 'center',
  marginTop: 20,
},

btnText: {
  color: CORES.branco,
  fontSize: 16,
  fontWeight: '600',
},

btnCancel: {
  marginTop: 12,
  alignItems: 'center',
},

btnCancelText: {
  color: CORES.textoSecundario,
  fontSize: 16,
},

helpSection: {
  marginHorizontal: 24,
  marginTop: 20,
  alignItems: 'center',
},

helpDescription: {
  fontSize: 14,
  color: CORES.textoSecundario,
  textAlign: 'center',
  marginBottom: 12,
  lineHeight: 20,
},

helpButton: {
  width: '100%',
  backgroundColor: '#b82a2a',
  borderRadius: 20,
  paddingVertical: 18,
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'row',
  gap: 10,
},

helpText: {
  color: CORES.branco,
  fontSize: 18,
  fontWeight: '800',
},

rotinaSub: {
  fontSize: 14,
  color: CORES.textoSecundario,
  marginBottom: 12,
  marginTop: -8,
},

rotinaSection: {
  marginTop: 40,
  marginBottom: 10,
  alignItems: 'center', // 👈 isso centraliza tudo dentro
},

fabContainer: {
  flexDirection: 'row',
  gap: 12,
},

micBtn: {
  width: 60,
  height: 60,
  borderRadius: 30,
  backgroundColor: '#3B82F6', // azul voz
  alignItems: 'center',
  justifyContent: 'center',
  ...SOMBRA.pequena,
},

headerRow: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingHorizontal: 24,
  marginTop: 20,
},

cuidadoTitle: {
  fontSize: 22,
  fontWeight: '700',
  color: '#000',
  textAlign: 'center',
},

sairBtn: {
  width: 44,
  height: 44,
  borderRadius: 22,
  backgroundColor: CORES.secundaria,
  alignItems: 'center',
  justifyContent: 'center',
},

group: {
  marginBottom: 18,
  backgroundColor: '#F9FAFB',
  padding: 14,
  borderRadius: 16,
},

daysContainer: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 10,
},

dayChip: {
  paddingVertical: 8,
  paddingHorizontal: 12,
  borderRadius: 12,
  backgroundColor: '#E5E7EB',
},

dayChipSelected: {
  backgroundColor: CORES.primaria,
},

dayChipText: {
  color: '#374151',
  fontWeight: '600',
},

dayChipTextSelected: {
  color: '#fff',
  fontWeight: '700',
},

addTimeBtn: {
  flexDirection: 'row',
  backgroundColor: CORES.primaria,
  paddingVertical: 12,
  paddingHorizontal: 14,
  borderRadius: 14,
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: 8,
  gap: 8,
},

addTimeText: {
  color: CORES.branco,
  fontWeight: '700',
  fontSize: 14,
},

});