import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, RefreshControl, Modal, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { CORES, SOMBRA } from '../theme';
import {
  listarAlertas, resolverAlerta,
  listarMedicamentos, criarMedicamento, removerMedicamento,
  buscarConfiguracoes, salvarConfiguracoes,
} from '../services/api';
import { wsService } from '../services/websocket';
import { encerrarSessao, lerConta, lerUsuario } from '../services/armazenamento';

const ABAS = [
  { id: 'inicio',   label: 'Início',   icone: 'grid' },
  { id: 'remedios', label: 'Remédios', icone: 'plus-square' },
  { id: 'alertas',  label: 'Alertas',  icone: 'bell' },
  { id: 'config',   label: 'Config',   icone: 'user' },
];

export default function FamiliarScreen({ navigation }) {
  const [aba, setAba] = useState('inicio');
  const [alertas, setAlertas] = useState([]);
  const [medicamentos, setMedicamentos] = useState([]);
  const [config, setConfig] = useState(null);
  const [recarregando, setRecarregando] = useState(false);
  const [modalMed, setModalMed] = useState(false);
  // States do Form
  const [nomeMed, setNomeMed] = useState('');
  const [dosagemMed, setDosagemMed] = useState('');
  const [horarioMed, setHorarioMed] = useState('08:00');
  const [salvandoMed, setSalvandoMed] = useState(false);
  const [intervalo, setIntervalo] = useState('12');
  const [nomeContato, setNomeContato] = useState('');
  const [telefone, setTelefone] = useState('');
  const [codigoAcesso, setCodigoAcesso] = useState('');
  const [nomeUsuario, setNomeUsuario] = useState('');

  useEffect(() => { carregarTudo(); conectarWs(); return () => wsService.desconectar(); }, []);

  const conectarWs = () => {
    wsService.resetar(); wsService.conectar('mobile');
    wsService.on('SOS_TRIGGERED', (d) => { setAlertas(p => [{ id: d.alert_id, type: 'SOS', resolved: false, timestamp: d.timestamp }, ...p]); setAba('alertas'); });
    wsService.on('MEDICATION_CONFIRMED', () => carregarMedicamentos());
  };

  const carregarTudo = async () => {
    setRecarregando(true);
    await Promise.all([carregarAlertas(), carregarMedicamentos(), carregarConfig(), carregarConta()]);
    setRecarregando(false);
  };
  const carregarConta = async () => { try { const c = await lerConta(); if (c.codigo) setCodigoAcesso(c.codigo); if (c.usuario) setNomeUsuario(c.usuario); } catch {} };
  const carregarAlertas = async () => { try { setAlertas(await listarAlertas()); } catch {} };
  const carregarMedicamentos = async () => { try { setMedicamentos(await listarMedicamentos()); } catch {} };
  const carregarConfig = async () => { try { const d = await buscarConfiguracoes(); setConfig(d); setIntervalo(String(d.checkin_interval_hours)); setNomeContato(d.emergency_contact_name); setTelefone(d.emergency_contact_phone); } catch {} };

  const handleSair = () => { Alert.alert('Sair', 'Voltar à tela de acesso?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Sair', style: 'destructive', onPress: async () => { await encerrarSessao(); navigation.replace('Onboarding'); } }]); };
  const handleAdicionarMed = async () => {
    if (!nomeMed.trim() || !dosagemMed.trim()) return;
    setSalvandoMed(true);
    try { const novo = await criarMedicamento(nomeMed, dosagemMed, horarioMed); setMedicamentos(p => [...p, novo]); setModalMed(false); } catch {}
    setSalvandoMed(false);
  };
  const handleRemoverMed = (med) => { Alert.alert('Remover', `Remover ${med.name}?`, [{ text: 'Cancelar' }, { text: 'Remover', style: 'destructive', onPress: async () => { await removerMedicamento(med.id); setMedicamentos(p => p.filter(m => m.id !== med.id)); }}]); };
  const handleResolverAlerta = async (a) => { await resolverAlerta(a.id); setAlertas(p => p.map(x => x.id === a.id ? { ...x, resolved: true } : x)); };
  
  const naoResolvidos = alertas.filter(a => !a.resolved).length;
  const confirmados = medicamentos.filter(m => m.status === 'tomado').length;

  return (
    <SafeAreaView style={s.safe}>
      {/* Header CliniQ style - Fundo suave, botões de ação arredondados */}
      <View style={s.header}>
        <View style={s.headerContent}>
          <TouchableOpacity style={s.iconBtn} onPress={handleSair}><Feather name="chevron-left" size={20} color={CORES.primaria} /></TouchableOpacity>
          <TouchableOpacity style={s.iconBtn} onPress={carregarTudo}><Feather name="refresh-cw" size={18} color={CORES.primaria} /></TouchableOpacity>
        </View>
        <View style={s.titleBox}>
          <Text style={s.headerTitle}>Lyra</Text>
          <Text style={s.headerGreeting}>Olá, {nomeUsuario || 'Responsável'}</Text>
        </View>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={recarregando} onRefresh={carregarTudo} />}>
        {aba === 'inicio'   && <AbaInicio nao={naoResolvidos} conf={confirmados} meds={medicamentos} onVer={() => setAba('alertas')} />}
        {aba === 'remedios' && <AbaRemedios meds={medicamentos} onAdd={() => setModalMed(true)} onRem={handleRemoverMed} />}
        {aba === 'alertas'  && <AbaAlertas alertas={alertas} onRes={handleResolverAlerta} />}
        {aba === 'config'   && <AbaConfig int={intervalo} setInt={setIntervalo} nom={nomeContato} setNom={setNomeContato} tel={telefone} setTel={setTelefone} cod={codigoAcesso} onSalvar={() => {}} />}
        <View style={{height: 100}} />
      </ScrollView>

      {/* Floating Bottom Nav */}
      <View style={s.bottomNavContainer}>
        <View style={s.bottomNav}>
          {ABAS.map((item) => {
            const ativo = aba === item.id;
            return (
              <TouchableOpacity key={item.id} style={s.navItem} onPress={() => setAba(item.id)}>
                <View style={[s.navIcon, ativo && s.navIconAtivo]}>
                  <Feather name={item.icone} size={20} color={ativo ? CORES.branco : CORES.textoSecundario} />
                  {item.id === 'alertas' && naoResolvidos > 0 && <View style={s.badge} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <Modal visible={modalMed} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalDrag} />
            <Text style={s.modalTitle}>Novo Medicamento</Text>
            <View style={s.field}><Text style={s.fieldTxt}>Nome</Text><TextInput style={s.input} value={nomeMed} onChangeText={setNomeMed} /></View>
            <View style={s.field}><Text style={s.fieldTxt}>Dosagem</Text><TextInput style={s.input} value={dosagemMed} onChangeText={setDosagemMed} /></View>
            <View style={s.field}><Text style={s.fieldTxt}>Horário</Text><TextInput style={s.input} value={horarioMed} onChangeText={setHorarioMed} /></View>
            <TouchableOpacity style={s.btnPrimary} onPress={handleAdicionarMed}><Text style={s.btnText}>Adicionar</Text><Feather name="arrow-up-right" size={18} color={CORES.branco}/></TouchableOpacity>
            <TouchableOpacity style={[s.btnPrimary, {backgroundColor: 'transparent', marginTop: 10, shadowOpacity:0}]} onPress={() => setModalMed(false)}><Text style={[s.btnText, {color: CORES.textoSecundario}]}>Cancelar</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function AbaInicio({ nao, conf, meds, onVer }) {
  return (
    <View style={s.secao}>
      <View style={s.statsRow}>
        <View style={s.statCardCliniq}>
          <Text style={s.statNum}>{conf}/{meds.length}</Text>
          <Text style={s.statLabel}>Medicamentos Tomados</Text>
          <View style={s.statIconBottom}><Feather name="arrow-up-right" size={16} color={CORES.primaria} /></View>
        </View>
        <View style={[s.statCardCliniq, { backgroundColor: CORES.primaria }]}>
          <Text style={[s.statNum, { color: CORES.branco }]}>{nao}</Text>
          <Text style={[s.statLabel, { color: 'rgba(255,255,255,0.7)' }]}>Alertas Pendentes</Text>
          <TouchableOpacity onPress={onVer} style={[s.statIconBottom, { backgroundColor: 'rgba(255,255,255,0.2)' }]}><Feather name="arrow-up-right" size={16} color={CORES.branco} /></TouchableOpacity>
        </View>
      </View>
      <Text style={s.sectionTitle}>Rotina de Hoje</Text>
      {meds.slice(0, 4).map(m => (
        <View key={m.id} style={s.medRowCard}>
          <View style={s.medRowIcon}><Feather name="heart" size={18} color={CORES.primaria} /></View>
          <View style={{ flex: 1 }}><Text style={s.medRowName}>{m.name}</Text><Text style={s.medRowTime}>{m.time} • {m.dosage}</Text></View>
          <View style={[s.statusBadge, m.status === 'tomado' ? { backgroundColor: CORES.primaria } : { backgroundColor: CORES.primariaClara }]}>
            <Text style={[s.statusTxt, m.status === 'tomado' ? { color: CORES.branco } : { color: CORES.primaria }]}>{m.status === 'tomado' ? 'OK' : 'Pendente'}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function AbaRemedios({ meds, onAdd, onRem }) {
  return (
    <View style={s.secao}>
      <View style={s.headerRow}>
        <Text style={s.sectionTitle}>Prescrições</Text>
        <TouchableOpacity style={s.iconBtnAction} onPress={onAdd}><Feather name="plus" size={18} color={CORES.branco} /></TouchableOpacity>
      </View>
      {meds.map(m => (
        <View key={m.id} style={s.medRowCard}>
          <View style={s.medRowIcon}><Feather name="file-text" size={18} color={CORES.primaria} /></View>
          <View style={{ flex: 1 }}><Text style={s.medRowName}>{m.name}</Text><Text style={s.medRowTime}>{m.dosage} às {m.time}</Text></View>
          <TouchableOpacity onPress={() => onRem(m)} style={s.delBtn}><Feather name="trash" size={16} color={CORES.erro} /></TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

function AbaAlertas({ alertas, onRes }) {
  return (
    <View style={s.secao}>
      <Text style={s.sectionTitle}>Eventos & Alertas</Text>
      {alertas.map(a => (
        <View key={a.id} style={[s.alertaCard, a.resolved && { opacity: 0.5 }]}>
          <View style={[s.alertaIcon, a.type === 'SOS' && { backgroundColor: '#FEE2E2' }]}><Feather name={a.type === 'SOS' ? "alert-triangle" : "bell"} size={18} color={a.type === 'SOS' ? CORES.erro : CORES.primaria} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.alertaTipo}>{a.type === 'SOS' ? 'Emergência' : 'Aviso'}</Text>
            <Text style={s.alertaData}>{new Date(a.timestamp).toLocaleTimeString()}</Text>
          </View>
          {!a.resolved && <TouchableOpacity style={s.btnSolve} onPress={() => onRes(a)}><Text style={s.btnSolveTxt}>Resolver</Text></TouchableOpacity>}
        </View>
      ))}
    </View>
  );
}

function AbaConfig({ int, setInt, nom, setNom, tel, setTel, cod, onSalvar }) {
  return (
    <View style={s.secao}>
      <Text style={s.sectionTitle}>Ajustes do Paciente</Text>
      <View style={s.configCard}>
        <Text style={s.fieldTxt}>Código de Vínculo</Text>
        <Text style={s.codigoHighlight}>{cod}</Text>
      </View>
      <View style={s.configCard}>
        <View style={s.field}><Text style={s.fieldTxt}>Contato Emergência</Text><TextInput style={s.input} value={nom} onChangeText={setNom} /></View>
        <View style={s.field}><Text style={s.fieldTxt}>Telefone</Text><TextInput style={s.input} value={tel} onChangeText={setTel} /></View>
        <TouchableOpacity style={s.btnPrimary} onPress={onSalvar}><Text style={s.btnText}>Salvar Dados</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: CORES.secundaria },
  header: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 20 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: CORES.branco, alignItems: 'center', justifyContent: 'center', ...SOMBRA.pequena },
  iconBtnAction: { width: 40, height: 40, borderRadius: 20, backgroundColor: CORES.primaria, alignItems: 'center', justifyContent: 'center', ...SOMBRA.pequena },
  titleBox: { marginTop: 24 },
  headerTitle: { fontSize: 28, fontWeight: '700', color: CORES.primaria },
  headerGreeting: { fontSize: 15, color: CORES.textoSecundario, marginTop: 4 },
  
  scroll: { flex: 1 },
  secao: { paddingHorizontal: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: CORES.texto, marginVertical: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  // Stats CliniQ style
  statsRow: { flexDirection: 'row', gap: 16, marginTop: 10 },
  statCardCliniq: { flex: 1, backgroundColor: CORES.branco, borderRadius: 28, padding: 20, height: 160, ...SOMBRA.pequena },
  statNum: { fontSize: 24, fontWeight: '700', color: CORES.primaria, marginBottom: 8 },
  statLabel: { fontSize: 13, color: CORES.textoSecundario, lineHeight: 18 },
  statIconBottom: { position: 'absolute', bottom: 20, right: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: CORES.primariaClara, alignItems: 'center', justifyContent: 'center' },

  // Cards
  medRowCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: CORES.branco, borderRadius: 20, padding: 16, marginBottom: 12, ...SOMBRA.pequena },
  medRowIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: CORES.secundaria, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  medRowName: { fontSize: 16, fontWeight: '700', color: CORES.texto },
  medRowTime: { fontSize: 13, color: CORES.textoSecundario, marginTop: 4 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statusTxt: { fontSize: 11, fontWeight: '700' },
  delBtn: { padding: 10 },

  alertaCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: CORES.branco, borderRadius: 20, padding: 16, marginBottom: 12, ...SOMBRA.pequena },
  alertaIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: CORES.primariaClara, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  alertaTipo: { fontSize: 15, fontWeight: '700', color: CORES.texto },
  alertaData: { fontSize: 13, color: CORES.textoSecundario, marginTop: 4 },
  btnSolve: { backgroundColor: CORES.primaria, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  btnSolveTxt: { color: CORES.branco, fontSize: 12, fontWeight: '700' },

  // Config
  configCard: { backgroundColor: CORES.branco, borderRadius: 24, padding: 20, marginBottom: 16, ...SOMBRA.pequena },
  codigoHighlight: { fontSize: 32, fontWeight: '800', color: CORES.primaria, letterSpacing: 8, textAlign: 'center', marginVertical: 10 },

  // Formulário
  field: { marginBottom: 16 },
  fieldTxt: { fontSize: 13, fontWeight: '600', color: CORES.textoSecundario, marginBottom: 8 },
  input: { backgroundColor: CORES.secundaria, borderRadius: 16, padding: 16, fontSize: 15, color: CORES.texto },
  btnPrimary: { backgroundColor: CORES.primaria, borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...SOMBRA.media },
  btnText: { color: CORES.branco, fontSize: 16, fontWeight: '600' },

  // Floating Nav
  bottomNavContainer: { position: 'absolute', bottom: 30, left: 24, right: 24, alignItems: 'center' },
  bottomNav: { flexDirection: 'row', backgroundColor: CORES.branco, borderRadius: 30, paddingHorizontal: 12, paddingVertical: 10, ...SOMBRA.media },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  navIconAtivo: { backgroundColor: CORES.primaria },
  badge: { position: 'absolute', top: 10, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: CORES.erro },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: CORES.branco, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
  modalDrag: { width: 40, height: 4, borderRadius: 2, backgroundColor: CORES.borda, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: CORES.texto, marginBottom: 24 },
});