import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, RefreshControl, Modal,
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
import { encerrarSessao, lerConta } from '../services/armazenamento';

const ABAS = [
  { id: 'inicio',   label: 'Início',   icone: 'home' },
  { id: 'remedios', label: 'Remédios', icone: 'package' },
  { id: 'alertas',  label: 'Alertas',  icone: 'bell' },
  { id: 'config',   label: 'Config',   icone: 'settings' },
];

const TIPO_ALERTA = {
  SOS:               { cor: CORES.erroClaro,  borda: CORES.erro,   icone: 'alert-triangle', label: 'Emergência SOS',           textoCor: CORES.erro },
  MISSED_MEDICATION: { cor: CORES.alertaClaro, borda: CORES.alerta, icone: 'package',        label: 'Remédio não tomado',       textoCor: CORES.alerta },
  MISSED_CHECKIN:    { cor: CORES.alertaClaro, borda: CORES.alerta, icone: 'bell-off',       label: 'Sem resposta no check-in', textoCor: CORES.alerta },
};

export default function FamiliarScreen({ navigation }) {
  const [abaAtual, setAbaAtual] = useState('inicio');
  const [alertas, setAlertas] = useState([]);
  const [medicamentos, setMedicamentos] = useState([]);
  const [configuracoes, setConfiguracoes] = useState(null);
  const [recarregando, setRecarregando] = useState(false);
  const [modalMed, setModalMed] = useState(false);
  const [nomeMed, setNomeMed] = useState('');
  const [dosagemMed, setDosagemMed] = useState('');
  const [horarioMed, setHorarioMed] = useState('08:00');
  const [salvandoMed, setSalvandoMed] = useState(false);
  const [intervalo, setIntervalo] = useState('12');
  const [nomeContato, setNomeContato] = useState('');
  const [telefone, setTelefone] = useState('');
  const [codigoAcesso, setCodigoAcesso] = useState('');
  const [nomeUsuario, setNomeUsuario] = useState('');
  const [salvandoConfig, setSalvandoConfig] = useState(false);

  useEffect(() => {
    carregarTudo();
    carregarDadosConta();
    conectarWs();
    return () => wsService.desconectar();
  }, []);

  const conectarWs = () => {
    wsService.conectar('mobile');
    wsService.on('SOS_TRIGGERED', (dados) => {
      setAlertas(prev => [{ id: dados.alert_id, type: 'SOS', resolved: false, timestamp: dados.timestamp }, ...prev]);
      setAbaAtual('alertas');
    });
    wsService.on('MEDICATION_CONFIRMED', () => carregarMedicamentos());
  };

  const carregarTudo = async () => {
    setRecarregando(true);
    await Promise.all([carregarAlertas(), carregarMedicamentos(), carregarConfig()]);
    setRecarregando(false);
  };

  const carregarAlertas = async () => {
    try { setAlertas(await listarAlertas()); } catch (e) {}
  };
  const carregarMedicamentos = async () => {
    try { setMedicamentos(await listarMedicamentos()); } catch (e) {}
  };
  const carregarDadosConta = async () => {
    try {
      const conta = await lerConta();
      if (conta.codigo) setCodigoAcesso(conta.codigo);
      if (conta.usuario) setNomeUsuario(conta.usuario);
    } catch (e) {}
  };

  const carregarConfig = async () => {
    try {
      const d = await buscarConfiguracoes();
      setConfiguracoes(d);
      setIntervalo(String(d.checkin_interval_hours));
      setNomeContato(d.emergency_contact_name);
      setTelefone(d.emergency_contact_phone);
    } catch (e) {}
  };

  const handleSair = () => {
    Alert.alert('Sair', 'Deseja voltar à tela de seleção de perfil?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: async () => {
        await encerrarSessao();
        navigation.replace('Onboarding');
      }},
    ]);
  };

  const handleAdicionarMedicamento = async () => {
    if (!nomeMed.trim() || !dosagemMed.trim()) {
      Alert.alert('Atenção', 'Preencha nome e dosagem.');
      return;
    }
    setSalvandoMed(true);
    try {
      const novo = await criarMedicamento(nomeMed, dosagemMed, horarioMed);
      setMedicamentos(prev => [...prev, novo]);
      setNomeMed(''); setDosagemMed(''); setHorarioMed('08:00');
      setModalMed(false);
    } catch { Alert.alert('Erro', 'Verifique a conexão com o servidor.'); }
    finally { setSalvandoMed(false); }
  };

  const handleRemover = (med) => {
    Alert.alert('Remover', `Remover ${med.name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => {
        await removerMedicamento(med.id);
        setMedicamentos(prev => prev.filter(m => m.id !== med.id));
      }},
    ]);
  };

  const handleResolver = async (alerta) => {
    await resolverAlerta(alerta.id);
    setAlertas(prev => prev.map(a => a.id === alerta.id ? { ...a, resolved: true } : a));
  };

  const handleSalvarConfig = async () => {

    setSalvandoConfig(true);
    try {
      await salvarConfiguracoes({
        checkin_interval_hours: parseInt(intervalo),
        emergency_contact_name: nomeContato,
        emergency_contact_phone: telefone,
        profile_summary: configuracoes?.profile_summary || '',
      });

      Alert.alert('Salvo!', 'Configurações atualizadas com sucesso.');
    } catch { Alert.alert('Erro', 'Não foi possível salvar.'); }
    finally { setSalvandoConfig(false); }
  };

  const naoResolvidos = alertas.filter(a => !a.resolved).length;
  const confirmados = medicamentos.filter(m => m.status === 'tomado').length;

  return (
    <SafeAreaView style={s.container}>

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitulo}>Lyra</Text>
          <Text style={s.headerSub}>Painel do Responsável</Text>
        </View>
        <View style={s.headerAcoes}>
          <TouchableOpacity style={s.headerIcone} onPress={carregarTudo}>
            <Feather name="refresh-cw" size={18} color={CORES.branco} />
          </TouchableOpacity>
          <TouchableOpacity style={s.headerIcone} onPress={handleSair}>
            <Feather name="log-out" size={18} color={CORES.branco} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Conteúdo */}
      <ScrollView
        style={s.conteudo}
        refreshControl={<RefreshControl refreshing={recarregando} onRefresh={carregarTudo} tintColor={CORES.primaria} />}
        showsVerticalScrollIndicator={false}
      >
        {abaAtual === 'inicio' && (
          <AbaInicio
            naoResolvidos={naoResolvidos}
            confirmados={confirmados}
            total={medicamentos.length}
            medicamentos={medicamentos}
            onVerAlertas={() => setAbaAtual('alertas')}
          />
        )}
        {abaAtual === 'remedios' && (
          <AbaRemedios medicamentos={medicamentos} onAdicionar={() => setModalMed(true)} onRemover={handleRemover} />
        )}
        {abaAtual === 'alertas' && (
          <AbaAlertas alertas={alertas} onResolver={handleResolver} />
        )}
        {abaAtual === 'config' && (
          <AbaConfig
            intervalo={intervalo} setIntervalo={setIntervalo}
            nomeContato={nomeContato} setNomeContato={setNomeContato}
            telefone={telefone} setTelefone={setTelefone}
            codigoAcesso={codigoAcesso} nomeUsuario={nomeUsuario}
            onSalvar={handleSalvarConfig} salvando={salvandoConfig}
          />
        )}
      </ScrollView>

      {/* Bottom nav */}
      <View style={s.nav}>
        {ABAS.map((aba) => {
          const ativo = abaAtual === aba.id;
          return (
            <TouchableOpacity key={aba.id} style={s.navItem} onPress={() => setAbaAtual(aba.id)}>
              <View style={[s.navIconeContainer, ativo && s.navIconeAtivo]}>
                <Feather name={aba.icone} size={20} color={ativo ? CORES.primaria : CORES.textoSecundario} />
                {aba.id === 'alertas' && naoResolvidos > 0 && (
                  <View style={s.badge}><Text style={s.badgeTexto}>{naoResolvidos}</Text></View>
                )}
              </View>
              <Text style={[s.navLabel, ativo && s.navLabelAtivo]}>{aba.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Modal medicamento */}
      <Modal visible={modalMed} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitulo}>Novo medicamento</Text>
              <TouchableOpacity onPress={() => setModalMed(false)}>
                <Feather name="x" size={22} color={CORES.textoSecundario} />
              </TouchableOpacity>
            </View>
            <Text style={s.label}>Nome</Text>
            <TextInput style={s.input} placeholder="Ex: Paracetamol" value={nomeMed} onChangeText={setNomeMed} />
            <Text style={s.label}>Dosagem</Text>
            <TextInput style={s.input} placeholder="Ex: 500mg" value={dosagemMed} onChangeText={setDosagemMed} />
            <Text style={s.label}>Horário</Text>
            <TextInput style={s.input} placeholder="Ex: 08:00" value={horarioMed} onChangeText={setHorarioMed} />
            <TouchableOpacity
              style={[s.botaoPrimario, salvandoMed && { opacity: 0.6 }]}
              onPress={handleAdicionarMedicamento}
              disabled={salvandoMed}
            >
              <Text style={s.botaoPrimarioTexto}>{salvandoMed ? 'Salvando...' : 'Salvar'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Aba Início ────────────────────────────────────────────────────────────────
function AbaInicio({ naoResolvidos, confirmados, total, medicamentos, onVerAlertas }) {
  return (
    <View style={s.secao}>
      <Text style={s.secaoTitulo}>Resumo de hoje</Text>
      <View style={s.cardsRow}>
        <View style={[s.cardResumo, { backgroundColor: naoResolvidos > 0 ? CORES.erroClaro : CORES.sucessoClaro }]}>
          <Feather name="bell" size={18} color={naoResolvidos > 0 ? CORES.erro : CORES.sucesso} />
          <Text style={[s.cardResumoNum, { color: naoResolvidos > 0 ? CORES.erro : CORES.sucesso }]}>{naoResolvidos}</Text>
          <Text style={s.cardResumoLabel}>Alertas abertos</Text>
        </View>
        <View style={[s.cardResumo, { backgroundColor: CORES.primariaClara }]}>
          <Feather name="package" size={18} color={CORES.primaria} />
          <Text style={[s.cardResumoNum, { color: CORES.primaria }]}>{confirmados}/{total}</Text>
          <Text style={s.cardResumoLabel}>Remédios tomados</Text>
        </View>
      </View>

      {naoResolvidos > 0 && (
        <TouchableOpacity style={s.bannerAlerta} onPress={onVerAlertas}>
          <Feather name="alert-triangle" size={16} color={CORES.erro} />
          <Text style={s.bannerAlertaTexto}>{naoResolvidos} alerta(s) precisam de atenção</Text>
          <Feather name="chevron-right" size={16} color={CORES.erro} />
        </TouchableOpacity>
      )}

      <Text style={[s.secaoTitulo, { marginTop: 24 }]}>Medicamentos</Text>
      {medicamentos.length === 0 ? (
        <View style={s.vazio}>
          <Feather name="package" size={28} color={CORES.borda} />
          <Text style={s.vazioTexto}>Nenhum medicamento cadastrado</Text>
        </View>
      ) : (
        medicamentos.slice(0, 4).map(med => (
          <View key={med.id} style={s.linhaResumo}>
            <View style={s.linhaResumoIcone}>
              <Feather name="package" size={14} color={CORES.primaria} />
            </View>
            <Text style={s.linhaResumoNome}>{med.name}</Text>
            <View style={[s.pill, { backgroundColor: med.status === 'tomado' ? CORES.sucessoClaro : CORES.alertaClaro }]}>
              <Text style={[s.pillTexto, { color: med.status === 'tomado' ? CORES.sucesso : CORES.alerta }]}>
                {med.status === 'tomado' ? 'Tomado' : med.time}
              </Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

// ── Aba Remédios ──────────────────────────────────────────────────────────────
function AbaRemedios({ medicamentos, onAdicionar, onRemover }) {
  return (
    <View style={s.secao}>
      <View style={s.secaoHeaderRow}>
        <Text style={s.secaoTitulo}>Medicamentos</Text>
        <TouchableOpacity style={s.botaoAdd} onPress={onAdicionar}>
          <Feather name="plus" size={16} color={CORES.branco} />
          <Text style={s.botaoAddTexto}>Adicionar</Text>
        </TouchableOpacity>
      </View>
      {medicamentos.length === 0 ? (
        <View style={s.vazio}>
          <Feather name="package" size={32} color={CORES.borda} />
          <Text style={s.vazioTexto}>Nenhum medicamento cadastrado</Text>
        </View>
      ) : (
        medicamentos.map(med => (
          <View key={med.id} style={s.cartaoMed}>
            <View style={s.cartaoMedIcone}>
              <Feather name="package" size={18} color={CORES.primaria} />
            </View>
            <View style={s.cartaoMedInfo}>
              <Text style={s.cartaoMedNome}>{med.name}</Text>
              <Text style={s.cartaoMedDetalhe}>{med.dosage}</Text>
              <View style={s.cartaoMedHorarioRow}>
                <Feather name="clock" size={11} color={CORES.textoSecundario} />
                <Text style={s.cartaoMedHorario}>{med.time}</Text>
              </View>
            </View>
            <View style={[s.pill, { backgroundColor: med.status === 'tomado' ? CORES.sucessoClaro : CORES.alertaClaro, marginRight: 8 }]}>
              <Text style={[s.pillTexto, { color: med.status === 'tomado' ? CORES.sucesso : CORES.alerta }]}>
                {med.status === 'tomado' ? 'Tomado' : 'Pendente'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => onRemover(med)} style={s.botaoRemover}>
              <Feather name="trash-2" size={16} color={CORES.erro} />
            </TouchableOpacity>
          </View>
        ))
      )}
    </View>
  );
}

// ── Aba Alertas ───────────────────────────────────────────────────────────────
function AbaAlertas({ alertas, onResolver }) {
  return (
    <View style={s.secao}>
      <Text style={s.secaoTitulo}>Histórico de Alertas</Text>
      {alertas.length === 0 ? (
        <View style={s.vazio}>
          <Feather name="check-circle" size={32} color={CORES.sucesso} />
          <Text style={s.vazioTexto}>Tudo tranquilo. Nenhum alerta.</Text>
        </View>
      ) : (
        alertas.map(alerta => {
          const cfg = TIPO_ALERTA[alerta.type] || TIPO_ALERTA.SOS;
          const data = new Date(alerta.timestamp).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
          });
          return (
            <View
              key={alerta.id}
              style={[s.cartaoAlerta, { backgroundColor: cfg.cor, borderLeftColor: cfg.borda }, alerta.resolved && { opacity: 0.45 }]}
            >
              <View style={[s.alertaIcone, { backgroundColor: cfg.borda + '22' }]}>
                <Feather name={cfg.icone} size={18} color={cfg.borda} />
              </View>
              <View style={s.alertaInfo}>
                <Text style={[s.alertaTipo, { color: cfg.textoCor }]}>{cfg.label}</Text>
                <Text style={s.alertaData}>{data}</Text>
              </View>
              {!alerta.resolved && (
                <TouchableOpacity style={s.botaoResolver} onPress={() => onResolver(alerta)}>
                  <Text style={s.botaoResolverTexto}>Resolver</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })
      )}
    </View>
  );
}

// ── Aba Config ────────────────────────────────────────────────────────────────
function AbaConfig({ intervalo, setIntervalo, nomeContato, setNomeContato, telefone, setTelefone, codigoAcesso, nomeUsuario, onSalvar, salvando }) {
  return (
    <View style={s.secao}>
      <Text style={s.secaoTitulo}>Configurações</Text>

      <View style={s.configCard}>
        <Text style={s.configCardTitulo}>Conta do responsável</Text>
        <View style={s.contaRow}>
          <View style={s.contaIcone}>
            <Feather name="user" size={16} color={CORES.primaria} />
          </View>
          <Text style={s.contaNome}>{nomeUsuario || '—'}</Text>
        </View>
        <Text style={[s.configCardDesc, { marginTop: 12 }]}>
          Código de acesso do idoso
        </Text>
        <View style={s.codigoBox}>
          {(codigoAcesso || '------').split('').map((d, i) => (
            <View key={i} style={s.codigoDigito}>
              <Text style={s.codigoDigitoTexto}>{d}</Text>
            </View>
          ))}
        </View>
        <Text style={s.codigoHint}>
          Compartilhe este código com o idoso para ele entrar no app.
        </Text>
      </View>

      <View style={s.configCard}>
        <Text style={s.configCardTitulo}>Check-in proativo</Text>
        <Text style={s.label}>Intervalo entre check-ins (horas)</Text>
        <TextInput style={s.input} value={intervalo} onChangeText={setIntervalo} keyboardType="numeric" />
      </View>

      <View style={s.configCard}>
        <Text style={s.configCardTitulo}>Contato de emergência</Text>
        <Text style={s.label}>Nome</Text>
        <TextInput style={s.input} value={nomeContato} onChangeText={setNomeContato} />
        <Text style={s.label}>Telefone</Text>
        <TextInput style={s.input} value={telefone} onChangeText={setTelefone} keyboardType="phone-pad" />
      </View>

      <TouchableOpacity
        style={[s.botaoPrimario, salvando && { opacity: 0.6 }]}
        onPress={onSalvar}
        disabled={salvando}
      >
        <Text style={s.botaoPrimarioTexto}>{salvando ? 'Salvando...' : 'Salvar configurações'}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: CORES.secundaria },

  header: {
    backgroundColor: CORES.primaria, paddingHorizontal: 20,
    paddingTop: 16, paddingBottom: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitulo: { fontSize: 22, fontWeight: '800', color: CORES.branco },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  headerAcoes: { flexDirection: 'row', gap: 8 },
  headerIcone: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },

  conteudo: { flex: 1 },
  secao: { padding: 20 },
  secaoTitulo: { fontSize: 16, fontWeight: '700', color: CORES.texto, marginBottom: 14 },
  secaoHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },

  cardsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  cardResumo: {
    flex: 1, borderRadius: 16, padding: 16, alignItems: 'center', gap: 6,
    ...SOMBRA.pequena,
  },
  cardResumoNum: { fontSize: 26, fontWeight: '800' },
  cardResumoLabel: { fontSize: 12, color: CORES.textoSecundario, textAlign: 'center' },

  bannerAlerta: {
    backgroundColor: CORES.erroClaro, borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderLeftWidth: 3, borderLeftColor: CORES.erro,
  },
  bannerAlertaTexto: { flex: 1, color: CORES.erro, fontWeight: '500', fontSize: 14 },

  linhaResumo: {
    backgroundColor: CORES.branco, borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginBottom: 8, ...SOMBRA.pequena,
  },
  linhaResumoIcone: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: CORES.primariaClara, alignItems: 'center', justifyContent: 'center',
  },
  linhaResumoNome: { flex: 1, fontSize: 14, fontWeight: '600', color: CORES.texto },
  pill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  pillTexto: { fontSize: 12, fontWeight: '600' },

  botaoAdd: {
    backgroundColor: CORES.primaria, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  botaoAddTexto: { color: CORES.branco, fontWeight: '600', fontSize: 13 },

  cartaoMed: {
    backgroundColor: CORES.branco, borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginBottom: 10, ...SOMBRA.pequena,
  },
  cartaoMedIcone: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: CORES.primariaClara, alignItems: 'center', justifyContent: 'center',
  },
  cartaoMedInfo: { flex: 1 },
  cartaoMedNome: { fontSize: 15, fontWeight: '700', color: CORES.texto },
  cartaoMedDetalhe: { fontSize: 12, color: CORES.textoSecundario, marginTop: 1 },
  cartaoMedHorarioRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  cartaoMedHorario: { fontSize: 12, color: CORES.textoSecundario },
  botaoRemover: { padding: 6 },

  cartaoAlerta: {
    borderRadius: 12, padding: 14, borderLeftWidth: 3,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginBottom: 10, ...SOMBRA.pequena,
  },
  alertaIcone: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  alertaInfo: { flex: 1 },
  alertaTipo: { fontSize: 14, fontWeight: '600' },
  alertaData: { fontSize: 12, color: CORES.textoSecundario, marginTop: 2 },
  botaoResolver: {
    backgroundColor: CORES.primaria, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  botaoResolverTexto: { color: CORES.branco, fontSize: 12, fontWeight: '600' },

  vazio: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  vazioTexto: { fontSize: 14, color: CORES.textoSecundario },

  configCard: {
    backgroundColor: CORES.branco, borderRadius: 16, padding: 18,
    marginBottom: 14, ...SOMBRA.pequena,
  },
  configCardTitulo: { fontSize: 14, fontWeight: '700', color: CORES.texto, marginBottom: 4 },
  configCardDesc: { fontSize: 13, color: CORES.textoSecundario, lineHeight: 18, marginBottom: 4 },
  label: { fontSize: 12, fontWeight: '600', color: CORES.textoSecundario, marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: CORES.secundaria, borderRadius: 10,
    borderWidth: 1, borderColor: CORES.borda,
    padding: 13, fontSize: 15, color: CORES.texto,
  },

  contaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4,
  },
  contaIcone: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: CORES.primariaClara, alignItems: 'center', justifyContent: 'center',
  },
  contaNome: { fontSize: 16, fontWeight: '700', color: CORES.texto },
  codigoBox: { flexDirection: 'row', gap: 6, marginTop: 10, marginBottom: 10 },
  codigoDigito: {
    width: 38, height: 46, borderRadius: 8,
    backgroundColor: CORES.primariaClara, borderWidth: 1.5, borderColor: CORES.primaria,
    alignItems: 'center', justifyContent: 'center',
  },
  codigoDigitoTexto: { fontSize: 20, fontWeight: '800', color: CORES.primaria },
  codigoHint: { fontSize: 12, color: CORES.textoSecundario, lineHeight: 17 },
  botaoPrimario: {
    backgroundColor: CORES.primaria, borderRadius: 14,
    padding: 16, alignItems: 'center', marginTop: 8,
  },
  botaoPrimarioTexto: { color: CORES.branco, fontSize: 16, fontWeight: '700' },

  nav: {
    flexDirection: 'row', backgroundColor: CORES.branco,
    borderTopWidth: 1, borderTopColor: CORES.borda,
    paddingVertical: 8,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 4 },
  navIconeContainer: {
    width: 44, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  navIconeAtivo: { backgroundColor: CORES.primariaClara },
  navLabel: { fontSize: 11, color: CORES.textoSecundario },
  navLabelAtivo: { color: CORES.primaria, fontWeight: '600' },
  badge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: CORES.erro, borderRadius: 8,
    width: 16, height: 16, alignItems: 'center', justifyContent: 'center',
  },
  badgeTexto: { color: CORES.branco, fontSize: 9, fontWeight: '700' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: CORES.branco,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  modalTitulo: { fontSize: 18, fontWeight: '700', color: CORES.texto },
});
