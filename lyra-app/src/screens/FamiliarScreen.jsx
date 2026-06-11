import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, RefreshControl, Modal, Dimensions, Platform, Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { CORES, SOMBRA } from '../theme';
import {
  listarAlertas, resolverAlerta,
  listarMedicamentos, criarMedicamento, removerMedicamento,
  buscarConfiguracoes, salvarConfiguracoes,
  listarTarefas, criarTarefa, removerTarefa,
  confirmarMedicamento, desconfirmarMedicamento, toggleTarefa,
  declararAusente, declararPresente, buscarClima, buscarFutebol, buscarNutricao
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
  const [horariosMed, setHorariosMed] = useState(['08:00']);
  const [diasMed, setDiasMed] = useState([]);
  const [diasSemana, setDiasSemana] = useState([]);
  const [salvandoMed, setSalvandoMed] = useState(false);
  const [tarefas, setTarefas] = useState([]);
  const [modalTarefa, setModalTarefa] = useState(false);
  const [descricaoTarefa, setDescricaoTarefa] = useState('');
  const [horariosTarefa, setHorariosTarefa] = useState(['08:00']);
  const [diasTarefa, setDiasTarefa] = useState([]);
  const [intervalo, setIntervalo] = useState('12');
  const [nomeContato, setNomeContato] = useState('');
  const [telefone, setTelefone] = useState('');
  const [codigoAcesso, setCodigoAcesso] = useState('');
  const [nomeUsuario, setNomeUsuario] = useState('');
  const [sleepStartNight, setSleepStartNight] = useState('22:00');
  const [sleepEndNight, setSleepEndNight] = useState('07:00');
  const [sleepStartAfternoon, setSleepStartAfternoon] = useState('13:30');
  const [sleepEndAfternoon, setSleepEndAfternoon] = useState('15:30');
  const [statusConexao, setStatusConexao] = useState('reconectando');
  const [sosLogs, setSosLogs] = useState([]);
  const [isAway, setIsAway] = useState(false);
  const DIAS_SEMANA = [
  'Seg',
  'Ter',
  'Qua',
  'Qui',
  'Sex',
  'Sáb',
  'Dom',
];

  useEffect(() => { carregarTudo(); conectarWs(); return () => wsService.desconectar(); }, []);

  const conectarWs = () => {
    wsService.resetar(); 
    wsService.conectar('mobile');

    // Escuta alterações de conectividade do WebSocket para alimentar a UI
    wsService.on('estado_alterado', (estado) => {
      setStatusConexao(estado.status);
    });

    wsService.on('SOS_TRIGGERED', (d) => {
      setAlertas(p => [{ id: d.alert_id, type: 'SOS', resolved: false, timestamp: d.timestamp }, ...p]);
      setSosLogs([]);
      setAba('alertas');
    });
    wsService.on('SOS_LOG_UPDATE', (d) => {
      setSosLogs(p => [...p, d.text]);
    });
    wsService.on('MEDICATION_CONFIRMED', () => carregarMedicamentos());
    wsService.on('STATUS_CHANGED', (d) => {
      setIsAway(d.is_away);
    });
  };

  const carregarTarefas = async () => { try { setTarefas(await listarTarefas()); } catch {} };
  const carregarTudo = async () => {
    setRecarregando(true);
    await Promise.all([carregarAlertas(), carregarMedicamentos(), carregarTarefas(), carregarConfig(), carregarConta()]);
    setRecarregando(false);
  };
  const carregarConta = async () => { try { const c = await lerConta(); if (c.codigo) setCodigoAcesso(c.codigo); if (c.usuario) setNomeUsuario(c.usuario); } catch {} };
  const carregarAlertas = async () => { try { setAlertas(await listarAlertas()); } catch {} };
  const carregarMedicamentos = async () => { try { setMedicamentos(await listarMedicamentos()); } catch {} };
  const carregarConfig = async () => {
    try {
      const d = await buscarConfiguracoes();
      setConfig(d);
      setIntervalo(String(d.checkin_interval_hours));
      setNomeContato(d.emergency_contact_name);
      setTelefone(d.emergency_contact_phone);
      setSleepStartNight(d.sleep_start_night || '22:00');
      setSleepEndNight(d.sleep_end_night || '07:00');
      setSleepStartAfternoon(d.sleep_start_afternoon || '13:30');
      setSleepEndAfternoon(d.sleep_end_afternoon || '15:30');
      setIsAway(d.is_away || false);
    } catch {}
  };

  const handleSair = async () => {
    console.log("[Sair - Passo 1] Botão de sair clicado! Plataforma:", Platform.OS);
    
    try {
      if (Platform.OS === 'web') {
        console.log("[Sair - Passo 2] A tentar abrir o alerta da Web...");
        const confirmar = window.confirm('Sair: Voltar à tela de acesso?');
        
        console.log("[Sair - Passo 3] Utilizador confirmou?", confirmar);
        
        if (confirmar) {
          console.log("[Sair - Passo 4] A limpar a sessão local...");
          await encerrarSessao();
          
          console.log("[Sair - Passo 5] A redirecionar para o Onboarding...");
          // Mudámos de replace para navigate, pois na web o replace por vezes bloqueia dependendo do tipo de navegação
          navigation.navigate('Onboarding'); 
        }
      } else {
        Alert.alert('Sair', 'Voltar à tela de acesso?', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Sair', style: 'destructive', onPress: async () => { 
              await encerrarSessao(); 
              navigation.replace('Onboarding'); 
            } 
          }
        ]);
      }
    } catch (error) {
      console.error("❌ [ERRO AO SAIR]:", error);
    }
  };

  const handleAdicionarMed = async () => {
    console.log("[Passo 1] Botão de adicionar clicado!");
    
    if (!nomeMed.trim() || !dosagemMed.trim()) {
      console.log("[Passo 2] Cancelado: Campos de nome ou dosagem estavam vazios.");
      Alert.alert('Atenção', 'Preencha o nome e a dosagem do medicamento antes de salvar.');
      return;
    }

    console.log("[Passo 3] Enviando requisição para o backend...", { 
      nome: nomeMed, 
      dosagem: dosagemMed, 
      horarios: horariosMed.join(', '), 
      dias: diasMed.join(', ')
    });
    
    setSalvandoMed(true);
    
    try { 
      const novo = await criarMedicamento(
        nomeMed,
        dosagemMed,
        horariosMed.join(', '), // Envia todos os horários numa única string
        diasMed.join(', ')      // Envia todos os dias numa única string
      );
      console.log("[Passo 4] Sucesso! Backend devolveu:", novo);
      
      setMedicamentos(p => [...p, novo]); 
      setModalMed(false); 
      
      // Limpa os campos para o próximo medicamento
      setNomeMed('');
      setDosagemMed('');
      setHorariosMed(['08:00']);
      setDiasMed([]); 
    } catch (error) {
      console.log("[ERRO] Falha ao comunicar com o backend!");
      console.log("Mensagem:", error.message);
      if (error.response) {
        console.log("Detalhes da recusa do backend:", error.response.data);
      }
      Alert.alert('Erro de Conexão', 'Não foi possível salvar. Verifique se o servidor está ligado e o IP está correto.');
    } finally {
      setSalvandoMed(false);
    }
  };
  
  const handleAdicionarTarefa = async () => {
    if (!descricaoTarefa.trim()) {
      Alert.alert('Atenção', 'Informe a descrição da tarefa.');
      return;
    }

    try {
      // Envia a requisição para o seu backend salvar no banco de dados
      const nova = await criarTarefa(
        descricaoTarefa, 
        horariosTarefa.join(', '), 
        diasTarefa.join(', ')
      );

      // Atualiza a lista na tela com o item devolvido pelo servidor
      setTarefas(prev => [...prev, nova]);

      // Limpa o formulário e fecha o modal
      setDescricaoTarefa('');
      setHorariosTarefa(['08:00']);
      setDiasTarefa([]);
      setModalTarefa(false);
    } catch (err) {
      console.log("[ERRO TAREFA]:", err.message);
      Alert.alert('Erro ao Salvar', 'Ops! O servidor demorou a responder. Tente salvar a tarefa novamente em alguns instantes.');
    }
  };

  const handleRemoverMed = (med) => { Alert.alert('Remover', `Remover ${med.name}?`, [{ text: 'Cancelar' }, { text: 'Remover', style: 'destructive', onPress: async () => { await removerMedicamento(med.id); setMedicamentos(p => p.filter(m => m.id !== med.id)); }}]); };
  const handleResolverAlerta = async (a) => { await resolverAlerta(a.id); setAlertas(p => p.map(x => x.id === a.id ? { ...x, resolved: true } : x)); };
  const handleRemoverTarefa = (t) => {
    Alert.alert(
      'Excluir tarefa',
      `Deseja realmente excluir "${t.descricao}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              // Primeiro apaga no banco de dados do backend
              await removerTarefa(t.id);
              // Se deu certo, remove da tela
              setTarefas(prev => prev.filter(item => item.id !== t.id));
            } catch (err) {
              Alert.alert('Erro de Rede', 'Não foi possível apagar a tarefa. Verifique se o servidor está ativo.');
            }
          }
        }
      ]
    );
  };

  const handleSalvarConfig = async () => {
    try {
      const payload = {
        ...config,
        checkin_interval_hours: parseInt(intervalo, 10) || (config ? config.checkin_interval_hours : 12),
        emergency_contact_name: nomeContato,
        emergency_contact_phone: telefone,
        sleep_start_night: sleepStartNight,
        sleep_end_night: sleepEndNight,
        sleep_start_afternoon: sleepStartAfternoon,
        sleep_end_afternoon: sleepEndAfternoon,
      };
      const result = await salvarConfiguracoes(payload);
      setConfig(result);
      Alert.alert('Sucesso', 'Configurações salvas com sucesso!');
    } catch (error) {
      console.log("[ERRO CONFIG]:", error.message);
      Alert.alert('Erro ao Configurar', 'Não conseguimos salvar suas preferências. Verifique sua conexão com a internet.');
    }
  };
  const naoResolvidos = alertas.filter(a => !a.resolved).length;
  const confirmados = medicamentos.filter(m => m.status === 'tomado').length;
  const rotinaHoje = [
    ...medicamentos.map(m => ({
      id: `med-${m.id}`,
      tipo: 'medicamento',
      titulo: m.name,
      horario: m.time || horariosMed[0] || '00:00',
      concluido: m.status === 'tomado',
      dosagem: m.dosage,
    })),

    ...tarefas.map(t => ({
      id: `tar-${t.id}`,
      tipo: 'tarefa',
      titulo: t.descricao,
      horario: t.horarios?.[0] || '00:00',
      concluido: t.concluido || false,
    })),
  ].sort((a, b) => a.horario.localeCompare(b.horario));

  const toggleDiaMed = (dia) => {
    setDiasMed(prev =>
      prev.includes(dia)
        ? prev.filter(d => d !== dia)
        : [...prev, dia]
    );
  };

  const toggleDiaTarefa = (dia) => {
    setDiasTarefa(prev =>
      prev.includes(dia)
        ? prev.filter(d => d !== dia)
        : [...prev, dia]
    );
  };

  const handleToggleAway = async (value) => {
    const oldValue = isAway;
    setIsAway(value); // Optimistic UI update
    try {
      if (value) {
        const res = await declararAusente();
        setIsAway(res.is_away);
      } else {
        const res = await declararPresente();
        setIsAway(res.is_away);
      }
    } catch (err) {
      setIsAway(oldValue); // Rollback
      Alert.alert(
        'Erro de Status',
        'Não foi possível alterar o status de ausência. Verifique sua conexão.'
      );
    }
  };

  const toggleRotina = async (item) => {
    const rawId = parseInt(item.id.split('-')[1], 10);
    
    if (item.tipo === 'tarefa') {
      // Atualização otimista
      setTarefas(prev =>
        prev.map(t =>
          t.id === rawId
            ? { ...t, concluido: !t.concluido, completed: !t.completed }
            : t
        )
      );
      try {
        await toggleTarefa(rawId);
      } catch (err) {
        // Reverte em caso de erro
        setTarefas(prev =>
          prev.map(t =>
            t.id === rawId
              ? { ...t, concluido: !t.concluido, completed: !t.completed }
              : t
          )
        );
        Alert.alert('Erro', 'Não foi possível atualizar o status da tarefa no servidor.');
      }
    }

    if (item.tipo === 'medicamento') {
      const novoStatus = item.concluido ? 'pendente' : 'tomado';
      // Atualização otimista
      setMedicamentos(prev =>
        prev.map(m =>
          m.id === rawId
            ? { ...m, status: novoStatus }
            : m
        )
      );
      try {
        if (item.concluido) {
          await desconfirmarMedicamento(rawId);
        } else {
          await confirmarMedicamento(rawId);
        }
      } catch (err) {
        // Reverte em caso de erro
        setMedicamentos(prev =>
          prev.map(m =>
            m.id === rawId
              ? { ...m, status: item.concluido ? 'tomado' : 'pendente' }
              : m
          )
        );
        Alert.alert('Erro', 'Não foi possível atualizar o status do medicamento no servidor.');
      }
    }
  };


  return (
    <SafeAreaView style={s.safe}>
      {/* Header CliniQ style - Fundo suave, botões de ação arredondados */}
      <View style={s.header}>
        <View style={s.headerContent}>
          <TouchableOpacity style={s.iconBtn} onPress={handleSair}>
            <Feather name="chevron-left" size={20} color={CORES.primaria} />
          </TouchableOpacity>
          
          {/* 🟢 Título e Saudação agrupados no centro */}
          <View style={s.headerTitles}>
            <Text style={s.headerTitle}>Lyra</Text>
            <Text style={s.headerGreeting}>Olá, {nomeUsuario || 'Responsável'}</Text>
          </View>
          
          <TouchableOpacity style={s.iconBtn} onPress={carregarTudo}>
            <Feather name="refresh-cw" size={18} color={CORES.primaria} />
          </TouchableOpacity>
        </View>

        {/* 🟢 Controles Lado a Lado */}
        <View style={s.statusControlsRow}>
          
          {/* Indicador de Status da Conexão em Tempo Real */}
          <View style={[
            s.statusBanner, 
            statusConexao === 'conectado' ? s.statusBannerConectado : s.statusBannerReconectando
          ]}>
            <View style={[
              s.statusPonto, 
              statusConexao === 'conectado' ? { backgroundColor: CORES.sucesso } : { backgroundColor: CORES.alerta }
            ]} />
            <Text style={[
              s.statusBannerTexto, 
              statusConexao === 'conectado' ? { color: CORES.sucesso } : { color: '#B45309' }
            ]}>
              {statusConexao === 'conectado' ? 'Monitoramento Ativo' : 'Tentando Reconectar...'}
            </Text>
          </View>

          {/* Switch do Modo Ausente */}
          <View style={s.awaySwitchRow}>
            <Text style={s.awaySwitchLabel}>
              {isAway ? 'Ausente' : 'Em Casa'}
            </Text>
            <Switch
              value={isAway}
              onValueChange={handleToggleAway}
              trackColor={{ false: '#D1D5DB', true: CORES.primariaClara }}
              thumbColor={isAway ? CORES.primaria : '#F3F4F6'}
            />
          </View>
        </View>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={recarregando} onRefresh={carregarTudo} />}>
        {aba === 'inicio'   && <AbaInicio
          nao={naoResolvidos}
          conf={confirmados}
          meds={medicamentos}
          rotina={rotinaHoje}
          onToggle={toggleRotina}
          onVer={() => setAba('alertas')}
        />}
        {aba === 'remedios' &&
          <AbaRemedios
            meds={medicamentos}
            tarefas={tarefas}
            onAdd={() => setModalMed(true)}
            onAddTarefa={() => setModalTarefa(true)}
            onRem={handleRemoverMed}
            onRemTarefa={handleRemoverTarefa}
          />
        }
        {aba === 'alertas'  && <AbaAlertas alertas={alertas} onRes={handleResolverAlerta} sosLogs={sosLogs} />}
        {aba === 'config'   && (
          <AbaConfig
            int={intervalo} setInt={setIntervalo}
            nom={nomeContato} setNom={setNomeContato}
            tel={telefone} setTel={setTelefone}
            cod={codigoAcesso}
            sleepStartNight={sleepStartNight} setSleepStartNight={setSleepStartNight}
            sleepEndNight={sleepEndNight} setSleepEndNight={setSleepEndNight}
            sleepStartAfternoon={sleepStartAfternoon} setSleepStartAfternoon={setSleepStartAfternoon}
            sleepEndAfternoon={sleepEndAfternoon} setSleepEndAfternoon={setSleepEndAfternoon}
            onSalvar={handleSalvarConfig}
          />
        )}
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
            <Text style={s.fieldTxt}>Dias da Semana</Text>

            <View style={s.daysContainer}>
              {DIAS_SEMANA.map(dia => (
                <TouchableOpacity
                  key={dia}
                  style={[
                    s.dayChip,
                    diasMed.includes(dia) && s.dayChipSelected
                  ]}
                  onPress={() => toggleDiaMed(dia)}
                >
                  <Text
                    style={
                      diasMed.includes(dia)
                        ? s.dayChipTextSelected
                        : s.dayChipText
                    }
                  >
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
                onChangeText={(texto) => {
                  const copia = [...horariosMed];
                  copia[index] = texto;
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
              <Feather
                name="plus"
                size={16}
                color={CORES.primaria}
              />
              <Text style={s.addTimeText}>
                Adicionar horário
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnPrimary} onPress={handleAdicionarMed}><Text style={s.btnText}>Adicionar</Text><Feather name="arrow-up-right" size={18} color={CORES.branco}/></TouchableOpacity>
            <TouchableOpacity style={[s.btnPrimary, {backgroundColor: 'transparent', marginTop: 10, shadowOpacity:0}]} onPress={() => setModalMed(false)}><Text style={[s.btnText, {color: CORES.textoSecundario}]}>Cancelar</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal visible={modalTarefa} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalDrag} />

            <Text style={s.modalTitle}>Nova Tarefa</Text>

            <View style={s.field}>
              <Text style={s.fieldTxt}>Descrição</Text>
              <TextInput
                style={s.input}
                value={descricaoTarefa}
                onChangeText={setDescricaoTarefa}
              />
            </View>

            <Text style={s.fieldTxt}>Dias da Semana</Text>

            <View style={s.daysContainer}>
              {DIAS_SEMANA.map(dia => (
                <TouchableOpacity
                  key={dia}
                  style={[
                    s.dayChip,
                    diasTarefa.includes(dia) && s.dayChipSelected
                  ]}
                  onPress={() => toggleDiaTarefa(dia)}
                >
                  <Text
                    style={
                      diasTarefa.includes(dia)
                        ? s.dayChipTextSelected
                        : s.dayChipText
                    }
                  >
                    {dia}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[s.fieldTxt, { marginTop: 20 }]}>
              Horários
            </Text>

            {horariosTarefa.map((hora, index) => (
              <TextInput
                key={index}
                style={[s.input, { marginBottom: 10 }]}
                value={hora}
                onChangeText={(texto) => {
                  const copia = [...horariosTarefa];
                  copia[index] = texto;
                  setHorariosTarefa(copia);
                }}
              />
            ))}

            <TouchableOpacity
              style={s.addTimeBtn}
              onPress={() =>
                setHorariosTarefa([...horariosTarefa, '08:00'])
              }
            >
              <Feather
                name="plus"
                size={16}
                color={CORES.primaria}
              />
              <Text style={s.addTimeText}>
                Adicionar horário
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.btnPrimary}
              onPress={handleAdicionarTarefa}
            >
              <Text style={s.btnText}>Adicionar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.btnPrimary, { backgroundColor: 'transparent', marginTop: 10 }]}
              onPress={() => setModalTarefa(false)}
            >
              <Text style={[s.btnText, { color: CORES.textoSecundario }]}>
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function AbaInicio({nao, conf, meds, rotina, onToggle, onVer}) {
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

      {/* Cards de Utilidades Geriátricas */}
      <CardsUtilidade />

      <Text style={s.sectionTitle}>Rotina de Hoje</Text>
      {rotina.map(item => (
        <View
          key={item.id}
          style={s.medRowCard}
        >
          <TouchableOpacity
            onPress={() => onToggle(item)}
            style={{
              marginRight: 14,
            }}
          >
            <Feather
              name={
                item.concluido
                  ? 'check-square'
                  : 'square'
              }
              size={24}
              color={
                item.concluido
                  ? CORES.primaria
                  : '#999'
              }
            />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={s.medRowName}>
              {item.titulo}
            </Text>

            <Text style={s.medRowTime}>
              {item.horario}
            </Text>
          </View>

          <Feather
            name={
              item.tipo === 'medicamento'
                ? 'heart'
                : 'check-circle'
            }
            size={18}
            color={CORES.primaria}
          />
        </View>
      ))}
    </View>
  );
}

function AbaRemedios({
    meds,
    tarefas,
    onAdd,
    onAddTarefa,
    onRem,
    onRemTarefa
})
  {  return (
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
      <View style={s.headerRow}>
        <Text style={s.sectionTitle}>Tarefas</Text>

        <TouchableOpacity
          style={s.iconBtnAction}
          onPress={onAddTarefa}
        >
          <Feather name="plus" size={18} color={CORES.branco} />
        </TouchableOpacity>
      </View>

      {tarefas.map(t => (
        <View key={t.id} style={s.medRowCard}>
          <View style={s.medRowIcon}>
            <Feather name="check-square" size={18} color={CORES.primaria} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={s.medRowName}>{t.descricao}</Text>

            <Text style={s.medRowTime}>
              {t.horarios?.join(', ')}
            </Text>

            <Text style={s.medRowTime}>
              {t.dias?.join(', ')}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => onRemTarefa(t)}
            style={s.delBtn}
          >
            <Feather name="trash-2" size={18} color={CORES.erro} />
          </TouchableOpacity>

        </View>
    ))}
    </View>
  );
}

function AbaAlertas({ alertas, onRes, sosLogs }) {
  return (
    <View style={s.secao}>
      <Text style={s.sectionTitle}>Eventos & Alertas</Text>
      {alertas.map(a => (
        <View key={a.id} style={{ marginBottom: 16 }}>
          <View style={[s.alertaCard, a.resolved && { opacity: 0.5 }]}>
            <View style={[s.alertaIcon, a.type === 'SOS' && { backgroundColor: '#FEE2E2' }]}><Feather name={a.type === 'SOS' ? "alert-triangle" : "bell"} size={18} color={a.type === 'SOS' ? CORES.erro : CORES.primaria} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.alertaTipo}>{a.type === 'SOS' ? 'Emergência' : 'Aviso'}</Text>
              <Text style={s.alertaData}>{new Date(a.timestamp).toLocaleTimeString()}</Text>
            </View>
            {!a.resolved && <TouchableOpacity style={s.btnSolve} onPress={() => onRes(a)}><Text style={s.btnSolveTxt}>Resolver</Text></TouchableOpacity>}
          </View>
          {a.type === 'SOS' && !a.resolved && sosLogs && sosLogs.length > 0 && (
            <View style={s.sosLogsContainer}>
              <Text style={s.sosLogsTitle}>Transcrição de Resposta do Idoso (Tempo Real):</Text>
              {sosLogs.map((log, idx) => (
                <Text key={idx} style={s.sosLogItem}>🗣️ "{log}"</Text>
              ))}
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

function AbaConfig({
  int, setInt,
  nom, setNom,
  tel, setTel,
  cod,
  sleepStartNight, setSleepStartNight,
  sleepEndNight, setSleepEndNight,
  sleepStartAfternoon, setSleepStartAfternoon,
  sleepEndAfternoon, setSleepEndAfternoon,
  onSalvar
}) {
  return (
    <View style={s.secao}>
      <Text style={s.sectionTitle}>Ajustes do Paciente</Text>
      <View style={s.configCard}>
        <Text style={s.fieldTxt}>Código de Vínculo</Text>
        <Text style={s.codigoHighlight}>{cod}</Text>
      </View>
      <View style={s.configCard}>
        <View style={s.field}><Text style={s.fieldTxt}>Intervalo de Check-in (horas)</Text><TextInput style={s.input} value={int} onChangeText={setInt} keyboardType="numeric" /></View>
        <View style={s.field}><Text style={s.fieldTxt}>Contato Emergência</Text><TextInput style={s.input} value={nom} onChangeText={setNom} /></View>
        <View style={s.field}><Text style={s.fieldTxt}>Telefone</Text><TextInput style={s.input} value={tel} onChangeText={setTel} /></View>
        
        <Text style={[s.sectionTitle, { fontSize: 16, marginTop: 10, marginBottom: 10 }]}>Janelas de Sono</Text>
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
          <View style={[s.field, { flex: 1 }]}><Text style={s.fieldTxt}>Início Sono Noturno</Text><TextInput style={s.input} value={sleepStartNight} onChangeText={setSleepStartNight} placeholder="Ex: 22:00" /></View>
          <View style={[s.field, { flex: 1 }]}><Text style={s.fieldTxt}>Fim Sono Noturno</Text><TextInput style={s.input} value={sleepEndNight} onChangeText={setSleepEndNight} placeholder="Ex: 07:00" /></View>
        </View>
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
          <View style={[s.field, { flex: 1 }]}><Text style={s.fieldTxt}>Início Cochilo</Text><TextInput style={s.input} value={sleepStartAfternoon} onChangeText={setSleepStartAfternoon} placeholder="Ex: 13:30" /></View>
          <View style={[s.field, { flex: 1 }]}><Text style={s.fieldTxt}>Fim Cochilo</Text><TextInput style={s.input} value={sleepEndAfternoon} onChangeText={setSleepEndAfternoon} placeholder="Ex: 15:30" /></View>
        </View>

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
  
  // Header centralizado
  headerTitles: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: CORES.primaria,
    textAlign: 'center',
  },
  headerGreeting: {
    fontSize: 14,
    color: CORES.textoSecundario,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Linha de status (Banner e Switch centralizados e próximos)
  statusControlsRow: {
    flexDirection: 'row',
    justifyContent: 'center', // 🟢 Mudado de space-between para center
    alignItems: 'center',
    gap: 16,                  // 🟢 Espaço fixo e curto entre os dois elementos
    marginTop: 20,
    paddingHorizontal: 12,
  },
  
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14, // 🟢 Aumentado de 10 para 14
    paddingVertical: 8,    // 🟢 Aumentado de 6 para 8
    borderRadius: 20,
  },
  
  statusBannerConectado: {
    backgroundColor: CORES.sucessoClaro,
  },
  
  statusBannerReconectando: {
    backgroundColor: CORES.alertaClaro,
  },
  
  statusPonto: {
    width: 8,               // 🟢 Aumentado de 6 para 8
    height: 8,              // 🟢 Aumentado de 6 para 8
    borderRadius: 4,        // 🟢 Ajustado (metade do tamanho)
    marginRight: 8,         // 🟢 Aumentado de 6 para 8
  },
  
  statusBannerTexto: {
    fontSize: 13,           // 🟢 Aumentado de 11 para 13
    fontWeight: '700',
  },
  
  awaySwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,                 // 🟢 Espaço sutil entre o texto e o switch
  },
  
  awaySwitchLabel: {
    fontSize: 14,           // 🟢 Aumentado de 12 para 14
    fontWeight: '700',
    color: CORES.texto,
  },
  
  scroll: { flex: 1 },
  secao: { paddingHorizontal: 24 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: CORES.texto,
    marginVertical: 16,
    textAlign: 'center',
  },
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

  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  dayChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: CORES.secundaria,
  },
  dayChipSelected: {
    backgroundColor: CORES.primaria,
  },
  dayChipText: {
    color: CORES.texto,
  },
  dayChipTextSelected: {
    color: CORES.branco,
    fontWeight: '600',
  },

  addTimeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  addTimeText: {
    color: CORES.primaria,
    fontWeight: '600',
    marginLeft: 6,
  },
  sosLogsContainer: {
    marginTop: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  sosLogsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 8,
  },
  sosLogItem: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginTop: 4,
  },
  utilidadeContainer: {
    marginTop: 24,
    marginBottom: 8,
  },
  utilidadeSecaoTitulo: {
    fontSize: 15,
    fontWeight: '700',
    color: CORES.textoSecundario,
    marginBottom: 12,
    textAlign: 'center',
  },
  utilidadeScroll: {
    gap: 16,
    paddingRight: 24,
  },
  utilidadeCard: {
    width: 280,
    flexDirection: 'row',
    backgroundColor: CORES.branco,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...SOMBRA.pequena,
  },
  utilidadeIconBox: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  utilidadeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: CORES.texto,
  },
  utilidadeTexto: {
    fontSize: 12,
    color: CORES.textoSecundario,
    marginTop: 4,
    lineHeight: 16,
  },
});

function CardsUtilidade() {
  const [clima, setClima] = useState(null);
  const [futebol, setFutebol] = useState(null);
  const [nutricao, setNutricao] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUtils = async () => {
      try {
        const [dataClima, dataFut, dataNutri] = await Promise.all([
          buscarClima(),
          buscarFutebol(),
          buscarNutricao()
        ]);
        setClima(dataClima);
        setFutebol(dataFut);
        setNutricao(dataNutri);
      } catch (e) {
        console.log('Erro ao carregar cards utilitários:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchUtils();
  }, []);

  if (loading) return null;

  return (
    <View style={s.utilidadeContainer}>
      <Text style={s.utilidadeSecaoTitulo}>Resumos Diários da Lyra</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.utilidadeScroll}>
        {clima && (
          <View style={s.utilidadeCard}>
            <View style={[s.utilidadeIconBox, { backgroundColor: '#DBEAFE' }]}>
              <Feather name="cloud-snow" size={20} color="#1E40AF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.utilidadeTitle}>Clima Hoje ({clima.city})</Text>
              <Text style={s.utilidadeTexto}>{clima.voice_summary}</Text>
            </View>
          </View>
        )}
        {futebol && (
          <View style={s.utilidadeCard}>
            <View style={[s.utilidadeIconBox, { backgroundColor: '#D1FAE5' }]}>
              <Feather name="activity" size={20} color="#065F46" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.utilidadeTitle}>Brasileirão 2026</Text>
              <Text style={s.utilidadeTexto}>{futebol.voice_summary}</Text>
            </View>
          </View>
        )}
        {nutricao && (
          <View style={s.utilidadeCard}>
            <View style={[s.utilidadeIconBox, { backgroundColor: '#FEF3C7' }]}>
              <Feather name="heart" size={20} color="#D97706" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.utilidadeTitle}>Nutrição Geriátrica</Text>
              <Text style={s.utilidadeTexto}>{nutricao.voice_summary}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}