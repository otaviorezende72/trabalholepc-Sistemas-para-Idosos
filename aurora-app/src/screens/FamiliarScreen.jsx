import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  listarMedicamentos, criarMedicamento, removerMedicamento,
  listarAlertas, marcarAlertaVisualizado, buscarPerfilIdoso,
} from '../services/api';
import { lerFamiliarId, lerIdosoId } from '../services/armazenamento';
import CartaoAlerta from '../components/CartaoAlerta';

const ABAS = ['Início', 'Remédios', 'Alertas'];

export default function FamiliarScreen() {
  const [abaAtual, setAbaAtual] = useState(0);
  const [idosoId, setIdosoId] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [medicamentos, setMedicamentos] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [recarregando, setRecarregando] = useState(false);

  // Form novo medicamento
  const [nomeMed, setNomeMed] = useState('');
  const [dosagemMed, setDosagemMed] = useState('');
  const [horarioMed, setHorarioMed] = useState('08:00');
  const [adicionando, setAdicionando] = useState(false);

  useEffect(() => {
    carregarTudo();
  }, []);

  const carregarTudo = async () => {
    setRecarregando(true);
    try {
      const familiarId = await lerFamiliarId();
      const id = await lerIdosoId();
      setIdosoId(id);

      if (familiarId) {
        const p = await buscarPerfilIdoso(familiarId);
        setPerfil(p);
      }
      if (id) {
        const [meds, als] = await Promise.all([
          listarMedicamentos(id),
          listarAlertas(id),
        ]);
        setMedicamentos(meds);
        setAlertas(als);
      }
    } catch (e) {
      console.log('Erro ao carregar:', e.message);
    } finally {
      setRecarregando(false);
    }
  };

  const handleAdicionarMedicamento = async () => {
    if (!nomeMed.trim() || !dosagemMed.trim()) {
      Alert.alert('Atenção', 'Preencha nome e dosagem.');
      return;
    }
    setAdicionando(true);
    try {
      const novo = await criarMedicamento(idosoId, nomeMed, dosagemMed, [horarioMed]);
      setMedicamentos(prev => [...prev, novo]);
      setNomeMed(''); setDosagemMed(''); setHorarioMed('08:00');
      Alert.alert('✅ Pronto!', 'Medicamento adicionado com sucesso.');
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível adicionar. Verifique a conexão.');
    } finally {
      setAdicionando(false);
    }
  };

  const handleRemoverMedicamento = (id) => {
    Alert.alert('Remover', 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover', style: 'destructive',
        onPress: async () => {
          await removerMedicamento(id);
          setMedicamentos(prev => prev.filter(m => m.id !== id));
        },
      },
    ]);
  };

  const handleVisualizarAlerta = async (id) => {
    await marcarAlertaVisualizado(id);
    setAlertas(prev => prev.map(a => a.id === id ? { ...a, visualizado: true } : a));
  };

  const alertasNaoVistos = alertas.filter(a => !a.visualizado).length;

  return (
    <SafeAreaView style={estilos.container}>

      {/* Abas de navegação */}
      <View style={estilos.abas}>
        {ABAS.map((aba, i) => (
          <TouchableOpacity
            key={aba}
            style={[estilos.aba, abaAtual === i && estilos.abaAtiva]}
            onPress={() => setAbaAtual(i)}
          >
            <Text style={[estilos.abaTexto, abaAtual === i && estilos.abaTextoAtivo]}>
              {aba}
              {i === 2 && alertasNaoVistos > 0 ? ` (${alertasNaoVistos})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={estilos.conteudo}
        refreshControl={<RefreshControl refreshing={recarregando} onRefresh={carregarTudo} />}
      >

        {/* ABA: INÍCIO */}
        {abaAtual === 0 && (
          <View style={estilos.secao}>
            <Text style={estilos.tituloPagina}>Painel Aurora</Text>
            {perfil ? (
              <View style={estilos.cartaoPerfil}>
                <Text style={estilos.nomeIdoso}>{perfil.nome}</Text>
                <Text style={estilos.infoPerfil}>
                  Check-in: {perfil.checkin_hora_inicio}h às {perfil.checkin_hora_fim}h
                </Text>
                <Text style={estilos.infoPerfil}>
                  {medicamentos.length} medicamento(s) cadastrado(s)
                </Text>
              </View>
            ) : (
              <View style={estilos.cartaoPerfil}>
                <Text style={estilos.textoVazio}>Nenhum idoso configurado ainda.</Text>
              </View>
            )}

            {alertasNaoVistos > 0 && (
              <View style={estilos.alertaBanner}>
                <Text style={estilos.alertaBannerTexto}>
                  🔔 {alertasNaoVistos} alerta(s) não visualizado(s)
                </Text>
                <TouchableOpacity onPress={() => setAbaAtual(2)}>
                  <Text style={estilos.alertaBannerLink}>Ver alertas</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ABA: REMÉDIOS */}
        {abaAtual === 1 && (
          <View style={estilos.secao}>
            <Text style={estilos.tituloPagina}>Medicamentos</Text>

            {/* Formulário de adição */}
            <View style={estilos.formulario}>
              <Text style={estilos.formularioTitulo}>Adicionar medicamento</Text>
              <TextInput
                style={estilos.input}
                placeholder="Nome do remédio"
                value={nomeMed}
                onChangeText={setNomeMed}
              />
              <TextInput
                style={estilos.input}
                placeholder="Dosagem (ex: 500mg)"
                value={dosagemMed}
                onChangeText={setDosagemMed}
              />
              <TextInput
                style={estilos.input}
                placeholder="Horário (ex: 08:00)"
                value={horarioMed}
                onChangeText={setHorarioMed}
              />
              <TouchableOpacity
                style={[estilos.botaoAdicionar, adicionando && { opacity: 0.6 }]}
                onPress={handleAdicionarMedicamento}
                disabled={adicionando}
              >
                <Text style={estilos.botaoAdicionarTexto}>
                  {adicionando ? 'Salvando...' : '+ Adicionar'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Lista de medicamentos */}
            {medicamentos.length === 0 ? (
              <Text style={estilos.textoVazio}>Nenhum medicamento cadastrado.</Text>
            ) : (
              medicamentos.map((med) => (
                <View key={med.id} style={estilos.cartaoMed}>
                  <View style={estilos.cartaoMedInfo}>
                    <Text style={estilos.cartaoMedNome}>{med.nome}</Text>
                    <Text style={estilos.cartaoMedDetalhe}>{med.dosagem}</Text>
                    <Text style={estilos.cartaoMedDetalhe}>
                      {med.horarios?.join(', ')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={estilos.botaoRemover}
                    onPress={() => handleRemoverMedicamento(med.id)}
                  >
                    <Text style={estilos.botaoRemoverTexto}>🗑</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        {/* ABA: ALERTAS */}
        {abaAtual === 2 && (
          <View style={estilos.secao}>
            <Text style={estilos.tituloPagina}>Histórico de Alertas</Text>
            {alertas.length === 0 ? (
              <Text style={estilos.textoVazio}>😊 Tudo tranquilo! Nenhum alerta.</Text>
            ) : (
              alertas.map((alerta) => (
                <CartaoAlerta
                  key={alerta.id}
                  alerta={alerta}
                  onVisualizar={() => handleVisualizarAlerta(alerta.id)}
                />
              ))
            )}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },

  abas: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  aba: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  abaAtiva: { borderBottomWidth: 3, borderBottomColor: '#1565C0' },
  abaTexto: { fontSize: 14, color: '#888' },
  abaTextoAtivo: { color: '#1565C0', fontWeight: '600' },

  conteudo: { flex: 1 },
  secao: { padding: 20 },
  tituloPagina: { fontSize: 24, fontWeight: 'bold', color: '#1A1A2E', marginBottom: 16 },

  cartaoPerfil: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3, marginBottom: 16,
  },
  nomeIdoso: { fontSize: 22, fontWeight: 'bold', color: '#1A1A2E', marginBottom: 8 },
  infoPerfil: { fontSize: 15, color: '#666', marginBottom: 4 },

  alertaBanner: {
    backgroundColor: '#FFF3E0', borderRadius: 12, padding: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  alertaBannerTexto: { fontSize: 14, color: '#E65100', fontWeight: '500' },
  alertaBannerLink: { fontSize: 14, color: '#1565C0', fontWeight: '600' },

  formulario: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20,
    marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  formularioTitulo: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 12 },
  input: {
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10,
    padding: 12, fontSize: 15, marginBottom: 10, backgroundColor: '#FAFAFA',
  },
  botaoAdicionar: {
    backgroundColor: '#1565C0', borderRadius: 10,
    padding: 14, alignItems: 'center',
  },
  botaoAdicionarTexto: { color: '#fff', fontSize: 15, fontWeight: '600' },

  cartaoMed: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    flexDirection: 'row', alignItems: 'center', marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cartaoMedInfo: { flex: 1 },
  cartaoMedNome: { fontSize: 16, fontWeight: '600', color: '#1A1A2E' },
  cartaoMedDetalhe: { fontSize: 13, color: '#888', marginTop: 2 },
  botaoRemover: { padding: 8 },
  botaoRemoverTexto: { fontSize: 20 },

  textoVazio: { fontSize: 15, color: '#999', textAlign: 'center', marginTop: 32 },
});
