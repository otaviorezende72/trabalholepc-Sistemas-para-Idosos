import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Alert, ScrollView, ActivityIndicator,
  KeyboardAvoidingView, Platform, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { CORES, SOMBRA } from '../theme';
import { salvarConta, lerConta, salvarModo, gerarCodigo } from '../services/armazenamento';

const { height } = Dimensions.get('window');

// ── Componente reutilizável: header verde com onda ────────────────────────────
function HeaderOnda({ titulo, subtitulo, altura = 0.38, onVoltar }) {
  return (
    <View style={[hw.wrapper, { height: height * altura }]}>
      {onVoltar && (
        <TouchableOpacity style={hw.voltar} onPress={onVoltar}>
          <Feather name="arrow-left" size={20} color={CORES.branco} />
        </TouchableOpacity>
      )}
      <View style={hw.conteudo}>
        <View style={hw.logoBox}>
          <Feather name="activity" size={26} color={CORES.primaria} />
        </View>
        <Text style={hw.titulo}>{titulo}</Text>
        {subtitulo ? <Text style={hw.subtitulo}>{subtitulo}</Text> : null}
      </View>
      <View style={hw.onda} />
    </View>
  );
}

const hw = StyleSheet.create({
  wrapper: { backgroundColor: CORES.primaria, justifyContent: 'flex-end' },
  voltar: {
    position: 'absolute', top: 16, left: 20, zIndex: 10,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  conteudo: { paddingHorizontal: 28, paddingBottom: 44, gap: 8 },
  logoBox: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: CORES.branco,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  titulo: { fontSize: 30, fontWeight: '800', color: CORES.branco, letterSpacing: -0.5 },
  subtitulo: { fontSize: 14, color: 'rgba(255,255,255,0.72)', lineHeight: 20 },
  onda: {
    position: 'absolute', bottom: -28, left: 0, right: 0,
    height: 56, backgroundColor: CORES.branco,
    borderTopLeftRadius: 36, borderTopRightRadius: 36,
  },
});

// ── Tela 1: Boas-vindas ───────────────────────────────────────────────────────
function TelaEscolha({ onResponsavel, onIdoso }) {
  const [selecionado, setSelecionado] = useState(null);

  const opcoes = [
    { id: 'RESPONSAVEL', icone: 'shield',  titulo: 'Sou o Responsável', descricao: 'Configuro e monitoro o cuidado' },
    { id: 'IDOSO',       icone: 'heart',   titulo: 'Sou o Idoso',        descricao: 'Tenho o código do meu responsável' },
  ];

  return (
    <View style={s.tela}>
      <HeaderOnda titulo="Bem-vindo ao Lyra" subtitulo="Cuidado inteligente para quem você ama" altura={0.40} />
      <View style={s.corpo}>
        <Text style={s.secaoTitulo}>Como você vai usar o app?</Text>
        {opcoes.map((op) => (
          <TouchableOpacity
            key={op.id}
            style={[s.itemLista, selecionado === op.id && s.itemListaAtivo]}
            onPress={() => setSelecionado(op.id)}
            activeOpacity={0.75}
          >
            <View style={[s.itemIcone, selecionado === op.id && s.itemIconeAtivo]}>
              <Feather name={op.icone} size={20} color={selecionado === op.id ? CORES.branco : CORES.primaria} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.itemTitulo}>{op.titulo}</Text>
              <Text style={s.itemDescricao}>{op.descricao}</Text>
            </View>
            {selecionado === op.id && <Feather name="check-circle" size={18} color={CORES.primaria} />}
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[s.botao, !selecionado && s.botaoOff]}
          onPress={() => selecionado === 'RESPONSAVEL' ? onResponsavel() : onIdoso()}
          disabled={!selecionado}
        >
          <Text style={s.botaoTexto}>Continuar</Text>
          <Feather name="arrow-right" size={18} color={CORES.branco} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Tela 2: Responsável — entrar ou criar ─────────────────────────────────────
function TelaResponsavel({ onVoltar, onEntrar, onCriarConta }) {
  return (
    <View style={s.tela}>
      <HeaderOnda titulo="Área do Responsável" subtitulo="Escolha como deseja acessar" altura={0.34} onVoltar={onVoltar} />
      <View style={s.corpo}>
        <TouchableOpacity style={s.cardAcao} onPress={onEntrar} activeOpacity={0.8}>
          <View style={s.cardAcaoEsquerda}>
            <View style={s.cardAcaoIcone}>
              <Feather name="log-in" size={22} color={CORES.primaria} />
            </View>
            <View>
              <Text style={s.cardAcaoTitulo}>Entrar na conta</Text>
              <Text style={s.cardAcaoDescricao}>Já tenho cadastro</Text>
            </View>
          </View>
          <View style={s.cardAcaoSeta}>
            <Feather name="chevron-right" size={18} color={CORES.primaria} />
          </View>
        </TouchableOpacity>

        <View style={s.divisorRow}>
          <View style={s.divisorLinha} />
          <Text style={s.divisorTexto}>ou</Text>
          <View style={s.divisorLinha} />
        </View>

        <TouchableOpacity style={[s.cardAcao, s.cardAcaoVerde]} onPress={onCriarConta} activeOpacity={0.8}>
          <View style={s.cardAcaoEsquerda}>
            <View style={[s.cardAcaoIcone, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
              <Feather name="user-plus" size={22} color={CORES.branco} />
            </View>
            <View>
              <Text style={[s.cardAcaoTitulo, { color: CORES.branco }]}>Criar conta</Text>
              <Text style={[s.cardAcaoDescricao, { color: 'rgba(255,255,255,0.72)' }]}>Quero me cadastrar agora</Text>
            </View>
          </View>
          <View style={[s.cardAcaoSeta, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
            <Feather name="chevron-right" size={18} color={CORES.branco} />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Tela 3: Login ─────────────────────────────────────────────────────────────
function TelaLogin({ onVoltar, onSucesso }) {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [entrando, setEntrando] = useState(false);

  const handleEntrar = async () => {
    if (!usuario.trim() || !senha.trim()) { setErro('Preencha todos os campos.'); return; }
    setEntrando(true); setErro('');
    try {
      const conta = await lerConta();
      if (!conta.usuario) { setErro('Nenhuma conta encontrada.'); setEntrando(false); return; }
      if (usuario.trim() === conta.usuario && senha === conta.senha) {
        await salvarModo('FAMILIAR'); onSucesso();
      } else { setErro('Usuário ou senha incorretos.'); }
    } catch { setErro('Erro ao verificar conta.'); }
    setEntrando(false);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.tela}>
        <HeaderOnda titulo="Entrar" subtitulo="Acesse sua conta de responsável" altura={0.30} onVoltar={onVoltar} />
        <ScrollView contentContainerStyle={s.corpo} keyboardShouldPersistTaps="handled">
          <Text style={s.secaoTitulo}>Suas credenciais</Text>
          <View style={s.campo}>
            <View style={s.campoIconeBox}><Feather name="user" size={16} color={CORES.textoSecundario} /></View>
            <TextInput style={s.campoInput} placeholder="Usuário" placeholderTextColor={CORES.textoSecundario}
              value={usuario} onChangeText={(t) => { setUsuario(t); setErro(''); }} autoCapitalize="none" />
          </View>
          <View style={s.campo}>
            <View style={s.campoIconeBox}><Feather name="lock" size={16} color={CORES.textoSecundario} /></View>
            <TextInput style={s.campoInput} placeholder="Senha" placeholderTextColor={CORES.textoSecundario}
              value={senha} onChangeText={(t) => { setSenha(t); setErro(''); }}
              secureTextEntry={!mostrarSenha} autoCapitalize="none" />
            <TouchableOpacity onPress={() => setMostrarSenha(v => !v)} style={s.campoIconeBox}>
              <Feather name={mostrarSenha ? 'eye-off' : 'eye'} size={16} color={CORES.textoSecundario} />
            </TouchableOpacity>
          </View>
          {erro !== '' && <View style={s.erroBox}><Feather name="alert-circle" size={13} color={CORES.erro} /><Text style={s.erroTexto}>{erro}</Text></View>}
          <TouchableOpacity style={[s.botao, { marginTop: 28 }, entrando && { opacity: 0.7 }]} onPress={handleEntrar} disabled={entrando}>
            {entrando ? <ActivityIndicator color={CORES.branco} /> : <Text style={s.botaoTexto}>Entrar</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Tela 4: Criar conta ───────────────────────────────────────────────────────
function TelaCriarConta({ onVoltar, onConcluir }) {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [criando, setCriando] = useState(false);

  const handleCriar = async () => {
    if (!usuario.trim()) { setErro('Digite um nome de usuário.'); return; }
    if (senha.length < 4) { setErro('Senha deve ter pelo menos 4 caracteres.'); return; }
    if (senha !== confirmar) { setErro('As senhas não coincidem.'); return; }
    setCriando(true);
    const codigo = gerarCodigo();
    await salvarConta(usuario.trim(), senha, codigo);
    onConcluir(usuario.trim(), codigo);
    setCriando(false);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.tela}>
        <HeaderOnda titulo="Criar conta" subtitulo="Preencha para se cadastrar" altura={0.28} onVoltar={onVoltar} />
        <ScrollView contentContainerStyle={s.corpo} keyboardShouldPersistTaps="handled">
          <Text style={s.secaoTitulo}>Seus dados</Text>
          <View style={s.campo}>
            <View style={s.campoIconeBox}><Feather name="user" size={16} color={CORES.textoSecundario} /></View>
            <TextInput style={s.campoInput} placeholder="Nome de usuário" placeholderTextColor={CORES.textoSecundario}
              value={usuario} onChangeText={(t) => { setUsuario(t); setErro(''); }} autoCapitalize="none" autoFocus />
          </View>
          <View style={s.campo}>
            <View style={s.campoIconeBox}><Feather name="lock" size={16} color={CORES.textoSecundario} /></View>
            <TextInput style={s.campoInput} placeholder="Senha (mín. 4 caracteres)" placeholderTextColor={CORES.textoSecundario}
              value={senha} onChangeText={(t) => { setSenha(t); setErro(''); }} secureTextEntry={!mostrarSenha} autoCapitalize="none" />
            <TouchableOpacity onPress={() => setMostrarSenha(v => !v)} style={s.campoIconeBox}>
              <Feather name={mostrarSenha ? 'eye-off' : 'eye'} size={16} color={CORES.textoSecundario} />
            </TouchableOpacity>
          </View>
          <View style={s.campo}>
            <View style={s.campoIconeBox}><Feather name="lock" size={16} color={CORES.textoSecundario} /></View>
            <TextInput style={s.campoInput} placeholder="Confirmar senha" placeholderTextColor={CORES.textoSecundario}
              value={confirmar} onChangeText={(t) => { setConfirmar(t); setErro(''); }} secureTextEntry={!mostrarSenha} autoCapitalize="none" />
          </View>
          {erro !== '' && <View style={s.erroBox}><Feather name="alert-circle" size={13} color={CORES.erro} /><Text style={s.erroTexto}>{erro}</Text></View>}
          <TouchableOpacity
            style={[s.botao, { marginTop: 28 }, (!usuario.trim() || !senha || criando) && s.botaoOff]}
            onPress={handleCriar} disabled={!usuario.trim() || !senha || criando}
          >
            {criando ? <ActivityIndicator color={CORES.branco} /> : <Text style={s.botaoTexto}>Criar conta</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Tela 5: Exibir código gerado ──────────────────────────────────────────────
function TelaExibirCodigo({ nome, codigo, onConcluir }) {
  return (
    <View style={s.tela}>
      <HeaderOnda titulo="Pronto!" subtitulo={"Olá, " + nome + "! Sua conta foi criada."} altura={0.32} />
      <View style={s.corpo}>
        <View style={s.codigoCard}>
          <View style={s.codigoCardTopo}>
            <View style={s.codigoCardIcone}>
              <Feather name="key" size={20} color={CORES.primaria} />
            </View>
            <Text style={s.codigoCardTitulo}>Código de acesso do idoso</Text>
          </View>
          <View style={s.codigoDigitosRow}>
            {codigo.split('').map((d, i) => (
              <View key={i} style={s.codigoDigito}>
                <Text style={s.codigoDigitoTexto}>{d}</Text>
              </View>
            ))}
          </View>
          <View style={s.codigoAvisoRow}>
            <Feather name="info" size={13} color={CORES.textoSecundario} />
            <Text style={s.codigoAvisoTexto}>Compartilhe com o idoso. Disponível nas Configurações.</Text>
          </View>
        </View>
        <TouchableOpacity style={s.botao} onPress={onConcluir}>
          <Text style={s.botaoTexto}>Entrar no painel</Text>
          <Feather name="arrow-right" size={18} color={CORES.branco} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Tela 6: Código do idoso ───────────────────────────────────────────────────
function TelaCodigoIdoso({ onVoltar, onSucesso }) {
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState(false);

  const handleVerificar = async () => {
    const conta = await lerConta();
    if (!conta.codigo) { Alert.alert('Sem conta', 'O responsável ainda não criou uma conta neste dispositivo.'); return; }
    if (codigo === conta.codigo) { await salvarModo('IDOSO'); onSucesso(); }
    else { setErro(true); setCodigo(''); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.tela}>
        <HeaderOnda titulo="Olá, Idoso" subtitulo="Digite o código do seu responsável" altura={0.32} onVoltar={onVoltar} />
        <View style={s.corpo}>
          <Text style={s.secaoTitulo}>Código de 6 dígitos</Text>
          <TextInput
            style={[s.pinInput, erro && s.pinInputErro]}
            value={codigo}
            onChangeText={(t) => { setCodigo(t.replace(/\D/g, '')); setErro(false); }}
            keyboardType="numeric" maxLength={6}
            placeholder="• • • • • •" placeholderTextColor={CORES.borda}
            textAlign="center" autoFocus
          />
          {erro && <View style={s.erroBox}><Feather name="alert-circle" size={13} color={CORES.erro} /><Text style={s.erroTexto}>Código incorreto. Verifique com o responsável.</Text></View>}
          <TouchableOpacity
            style={[s.botao, { marginTop: 28 }, codigo.length < 6 && s.botaoOff]}
            onPress={handleVerificar} disabled={codigo.length < 6}
          >
            <Text style={s.botaoTexto}>Entrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Principal ─────────────────────────────────────────────────────────────────
export default function OnboardingScreen({ navigation }) {
  const [tela, setTela] = useState('escolha');
  const [contaNome, setContaNome] = useState('');
  const [contaCodigo, setContaCodigo] = useState('');

  const entrarFamiliar = async () => { await salvarModo('FAMILIAR'); navigation.replace('Familiar'); };
  const entrarIdoso = () => navigation.replace('Idoso');
  const handleContaCriada = (nome, codigo) => { setContaNome(nome); setContaCodigo(codigo); setTela('exibir_codigo'); };

  return (
    <SafeAreaView style={s.safe}>
      {tela === 'escolha'       && <TelaEscolha onResponsavel={() => setTela('responsavel')} onIdoso={() => setTela('codigo_idoso')} />}
      {tela === 'responsavel'   && <TelaResponsavel onVoltar={() => setTela('escolha')} onEntrar={() => setTela('login')} onCriarConta={() => setTela('criar')} />}
      {tela === 'login'         && <TelaLogin onVoltar={() => setTela('responsavel')} onSucesso={entrarFamiliar} />}
      {tela === 'criar'         && <TelaCriarConta onVoltar={() => setTela('responsavel')} onConcluir={handleContaCriada} />}
      {tela === 'exibir_codigo' && <TelaExibirCodigo nome={contaNome} codigo={contaCodigo} onConcluir={entrarFamiliar} />}
      {tela === 'codigo_idoso'  && <TelaCodigoIdoso onVoltar={() => setTela('escolha')} onSucesso={entrarIdoso} />}
    </SafeAreaView>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: CORES.primaria },
  tela: { flex: 1, backgroundColor: CORES.branco },

  corpo: { flex: 1, paddingHorizontal: 28, paddingTop: 48, paddingBottom: 32 },

  secaoTitulo: { fontSize: 14, fontWeight: '700', color: CORES.textoSecundario, marginBottom: 20, letterSpacing: 0.3 },

  // Itens de lista (escolha)
  itemLista: {
    backgroundColor: CORES.branco, borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12,
    borderWidth: 1.5, borderColor: CORES.borda, ...SOMBRA.pequena,
  },
  itemListaAtivo: { borderColor: CORES.primaria },
  itemIcone: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: CORES.primariaClara, alignItems: 'center', justifyContent: 'center',
  },
  itemIconeAtivo: { backgroundColor: CORES.primaria },
  itemTitulo: { fontSize: 15, fontWeight: '700', color: CORES.texto },
  itemDescricao: { fontSize: 12, color: CORES.textoSecundario, marginTop: 2 },

  // Cards de ação (responsável)
  cardAcao: {
    backgroundColor: CORES.branco, borderRadius: 16, padding: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: CORES.borda, ...SOMBRA.pequena,
  },
  cardAcaoVerde: { backgroundColor: CORES.primaria, borderColor: CORES.primaria, ...SOMBRA.media },
  cardAcaoEsquerda: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  cardAcaoIcone: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: CORES.primariaClara, alignItems: 'center', justifyContent: 'center',
  },
  cardAcaoTitulo: { fontSize: 16, fontWeight: '700', color: CORES.texto },
  cardAcaoDescricao: { fontSize: 13, color: CORES.textoSecundario, marginTop: 2 },
  cardAcaoSeta: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: CORES.primariaClara, alignItems: 'center', justifyContent: 'center',
  },

  // Divisor
  divisorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20 },
  divisorLinha: { flex: 1, height: 1, backgroundColor: CORES.borda },
  divisorTexto: { fontSize: 13, color: CORES.textoSecundario },

  // Campos de formulário
  campo: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: CORES.secundaria, borderRadius: 12,
    borderWidth: 1.5, borderColor: CORES.borda, marginBottom: 14,
  },
  campoIconeBox: { paddingHorizontal: 14, paddingVertical: 14 },
  campoInput: { flex: 1, fontSize: 15, color: CORES.texto, paddingVertical: 14 },

  // Erro
  erroBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  erroTexto: { fontSize: 13, color: CORES.erro },

  // Botão principal
  botao: {
    backgroundColor: CORES.primaria, borderRadius: 14, padding: 17,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, ...SOMBRA.media,
  },
  botaoOff: { backgroundColor: CORES.borda },
  botaoTexto: { color: CORES.branco, fontSize: 16, fontWeight: '700' },

  // Código
  codigoCard: {
    backgroundColor: CORES.primariaClara, borderRadius: 20, padding: 24,
    borderWidth: 1.5, borderColor: CORES.primaria, marginBottom: 28,
  },
  codigoCardTopo: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  codigoCardIcone: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: CORES.branco, alignItems: 'center', justifyContent: 'center',
  },
  codigoCardTitulo: { fontSize: 14, fontWeight: '700', color: CORES.primaria },
  codigoDigitosRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 20 },
  codigoDigito: {
    width: 40, height: 50, borderRadius: 10,
    backgroundColor: CORES.branco, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: CORES.primaria,
  },
  codigoDigitoTexto: { fontSize: 22, fontWeight: '800', color: CORES.primaria },
  codigoAvisoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  codigoAvisoTexto: { flex: 1, fontSize: 12, color: CORES.textoSecundario, lineHeight: 17 },

  // PIN
  pinInput: {
    alignSelf: 'center', width: '80%',
    backgroundColor: CORES.secundaria, borderRadius: 14,
    borderWidth: 2, borderColor: CORES.borda,
    paddingVertical: 18, fontSize: 26, fontWeight: '800',
    color: CORES.texto, letterSpacing: 12,
  },
  pinInputErro: { borderColor: CORES.erro },
});
