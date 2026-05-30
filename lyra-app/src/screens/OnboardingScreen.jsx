import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Alert, ScrollView, ActivityIndicator, KeyboardAvoidingView,
  Platform, Dimensions, Keyboard
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { CORES, SOMBRA } from '../theme';
import { salvarConta, lerConta, salvarModo, gerarCodigo } from '../services/armazenamento';

const { height: SH, width: SW } = Dimensions.get('window');

// ── Fundo com Curva Suave (Estilo Imagem 1) ──────────────────────────────────
function Onda({ alturaPercent = 0.45, children, onVoltar }) {
  return (
    <View style={{ flex: 1, backgroundColor: CORES.primaria }}>
      {onVoltar && (
        <TouchableOpacity style={ow.voltarBtn} onPress={onVoltar}>
          <Feather name="arrow-left" size={20} color={CORES.branco} />
        </TouchableOpacity>
      )}
      
      {/* Background Rosa Base */}
      <View style={{ height: SH * alturaPercent, zIndex: 10 }}>
        {children}
      </View>

      {/* Curva Branca Perfeita usando círculo sobredimensionado */}
      <View style={[ow.curvaBranca, { top: SH * alturaPercent - 50 }]} />
    </View>
  );
}

const ow = StyleSheet.create({
  voltarBtn: {
    position: 'absolute', top: 16, left: 24, zIndex: 20,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  curvaBranca: {
    position: 'absolute', left: -SW * 0.5, right: -SW * 0.5,
    width: SW * 2, height: SH,
    backgroundColor: CORES.branco,
    borderRadius: SW, // Transforma em um círculo gigante para fazer a curva suave
  },
});

// ── Tela 1: Boas-vindas ───────────────────────────────────────────────────────
function TelaEscolha({ onResponsavel, onIdoso }) {
  const [sel, setSel] = useState(null);

  return (
    <View style={{ flex: 1 }}>
      <Onda alturaPercent={0.45}>
        <View style={[s.ondaTopo, { paddingTop: SH * 0.15 }]}>
          <Text style={s.ondaTituloLargo}>Bem-vindo(a)</Text>
          <Text style={s.ondaSub}>Selecione seu modo de acesso.</Text>
        </View>
      </Onda>

      <View style={s.conteudoBranco}>
        <View style={{ gap: 16, marginTop: 20 }}>
          {[
            { id: 'RESPONSAVEL', icone: 'shield', titulo: 'Sou o Responsável', sub: 'Configuro e monitoro o cuidado' },
            { id: 'IDOSO',       icone: 'heart',  titulo: 'Sou o Idoso',        sub: 'Tenho o código do meu familiar' },
          ].map(op => (
            <TouchableOpacity
              key={op.id}
              style={[s.selCard, sel === op.id && s.selCardAtivo]}
              onPress={() => setSel(op.id)}
              activeOpacity={0.8}
            >
              <View style={[s.selIcone, sel === op.id && { backgroundColor: CORES.primaria }]}>
                <Feather name={op.icone} size={18} color={sel === op.id ? CORES.branco : CORES.primaria} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.selTitulo}>{op.titulo}</Text>
                <Text style={s.selSub}>{op.sub}</Text>
              </View>
              {sel === op.id && <Feather name="check-circle" size={18} color={CORES.primaria} />}
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.continuarRow}>
          <Text style={s.continuarTexto}>Continue</Text>
          <TouchableOpacity
            style={[s.continuarBtn, !sel && s.continuarBtnOff]}
            onPress={() => sel === 'RESPONSAVEL' ? onResponsavel() : onIdoso()}
            disabled={!sel}
          >
            <Feather name="arrow-right" size={20} color={CORES.branco} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── Tela 2: Responsável — entrar ou criar ─────────────────────────────────────
function TelaResponsavel({ onVoltar, onEntrar, onCriarConta }) {
  return (
    <View style={{ flex: 1 }}>
      <Onda alturaPercent={0.35} onVoltar={onVoltar}>
        <View style={[s.ondaTopo, { paddingTop: SH * 0.12 }]}>
          <Text style={s.ondaTituloLargo}>Responsável</Text>
          <Text style={s.ondaSub}>Como deseja acessar o painel?</Text>
        </View>
      </Onda>
      <View style={s.conteudoBranco}>
        <TouchableOpacity style={s.actionCard} onPress={onEntrar} activeOpacity={0.8}>
          <View style={s.actionCardIcone}><Feather name="log-in" size={20} color={CORES.primaria} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.actionCardTitulo}>Entrar na conta</Text>
            <Text style={s.actionCardSub}>Já tenho cadastro</Text>
          </View>
        </TouchableOpacity>

        <View style={s.divisorRow}>
          <View style={s.divisorLinha} /><Text style={s.divisorTexto}>ou</Text><View style={s.divisorLinha} />
        </View>

        <TouchableOpacity style={[s.actionCard, s.actionCardRosa]} onPress={onCriarConta} activeOpacity={0.8}>
          <View style={[s.actionCardIcone, { backgroundColor: 'rgba(255,255,255,0.2)' }]}><Feather name="user-plus" size={20} color={CORES.branco} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[s.actionCardTitulo, { color: CORES.branco }]}>Criar conta</Text>
            <Text style={[s.actionCardSub, { color: 'rgba(255,255,255,0.8)' }]}>Quero me cadastrar agora</Text>
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
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEntrar = async () => {
    if (!usuario.trim() || !senha.trim()) { setErro('Preencha todos os campos.'); return; }
    setLoading(true); setErro('');
    try {
      const c = await lerConta();
      if (!c.usuario) { setErro('Nenhuma conta encontrada.'); setLoading(false); return; }
      if (usuario.trim() === c.usuario && senha === c.senha) { await salvarModo('FAMILIAR'); onSucesso(); }
      else setErro('Usuário ou senha incorretos.');
    } catch { setErro('Erro ao verificar.'); }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={{ flex: 1 }}>
        <Onda alturaPercent={0.35} onVoltar={onVoltar}>
          <View style={[s.ondaTopo, { paddingTop: SH * 0.12 }]}>
            <Text style={s.ondaTituloLargo}>Entrar</Text>
            <Text style={s.ondaSub}>Acesse com suas credenciais</Text>
          </View>
        </Onda>
        <ScrollView style={s.formScroll} keyboardShouldPersistTaps="handled">
          <View style={s.formPadding}>
            
            <Text style={s.fieldLabel}>Username</Text>
            <View style={s.fieldBox}>
              <Feather name="user" size={16} color={CORES.textoSecundario} />
              <TextInput style={s.fieldInput} placeholder="demo@email.com" placeholderTextColor="#D1D5DB"
                value={usuario} onChangeText={t => { setUsuario(t); setErro(''); }} autoCapitalize="none" />
            </View>

            <Text style={s.fieldLabel}>Password</Text>
            <View style={s.fieldBox}>
              <Feather name="lock" size={16} color={CORES.textoSecundario} />
              <TextInput style={s.fieldInput} placeholder="enter your password" placeholderTextColor="#D1D5DB"
                value={senha} onChangeText={t => { setSenha(t); setErro(''); }}
                secureTextEntry={!verSenha} autoCapitalize="none" />
              <TouchableOpacity onPress={() => setVerSenha(v => !v)}>
                <Feather name={verSenha ? 'eye-off' : 'eye'} size={16} color={CORES.textoSecundario} />
              </TouchableOpacity>
            </View>

            {erro !== '' && <View style={s.erroBox}><Text style={s.erroTexto}>{erro}</Text></View>}

            <TouchableOpacity style={[s.botaoPrincipal, loading && { opacity: 0.7 }]} onPress={handleEntrar} disabled={loading}>
              {loading ? <ActivityIndicator color={CORES.branco} /> : <Text style={s.botaoTexto}>Login</Text>}
            </TouchableOpacity>
          </View>
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
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCriar = async () => {
    if (!usuario.trim() || senha.length < 4 || senha !== confirmar) { setErro('Verifique os campos inseridos.'); return; }
    setLoading(true);
    const codigo = gerarCodigo();
    await salvarConta(usuario.trim(), senha, codigo);
    onConcluir(usuario.trim(), codigo);
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={{ flex: 1 }}>
        <Onda alturaPercent={0.25} onVoltar={onVoltar} />
        <ScrollView style={s.formScroll} keyboardShouldPersistTaps="handled">
          <View style={s.formPadding}>
            <Text style={[s.ondaTituloLargo, { color: CORES.texto, marginBottom: 30 }]}>Entre</Text>

            <Text style={s.fieldLabel}>Usuário</Text>
            <View style={s.fieldBox}><TextInput style={s.fieldInput} value={usuario} onChangeText={t => { setUsuario(t); setErro(''); }} autoCapitalize="none" /></View>

            <Text style={s.fieldLabel}>Senha</Text>
            <View style={s.fieldBox}><TextInput style={s.fieldInput} value={senha} onChangeText={t => { setSenha(t); setErro(''); }} secureTextEntry autoCapitalize="none" /></View>

            <Text style={s.fieldLabel}>Confirme a senha</Text>
            <View style={s.fieldBox}><TextInput style={s.fieldInput} value={confirmar} onChangeText={t => { setConfirmar(t); setErro(''); }} secureTextEntry autoCapitalize="none" /></View>

            {erro !== '' && <View style={s.erroBox}><Text style={s.erroTexto}>{erro}</Text></View>}

            <TouchableOpacity style={s.botaoPrincipal} onPress={handleCriar} disabled={loading}>
              {loading ? <ActivityIndicator color={CORES.branco} /> : <Text style={s.botaoTexto}>Criar conta</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Tela 5: Exibir código ─────────────────────────────────────────────────────
function TelaExibirCodigo({ nome, codigo, onConcluir }) {
  return (
    <View style={{ flex: 1 }}>
      <Onda alturaPercent={0.4}>
        <View style={[s.ondaTopo, { paddingTop: SH * 0.15, alignItems: 'center' }]}>
          <View style={s.successIcone}><Feather name="check" size={28} color={CORES.primaria} /></View>
          <Text style={[s.ondaTituloLargo, { textAlign: 'center' }]}>All set!</Text>
          <Text style={[s.ondaSub, { textAlign: 'center' }]}>Account created for {nome}</Text>
        </View>
      </Onda>
      <View style={[s.conteudoBranco, { alignItems: 'center' }]}>
        <Text style={s.fieldLabel}>Elderly Access Code</Text>
        <View style={s.codigoRow}>
          {codigo.split('').map((d, i) => (
            <View key={i} style={s.codigoDigito}><Text style={s.codigoDigitoTexto}>{d}</Text></View>
          ))}
        </View>
        <Text style={[s.ondaSub, { color: CORES.textoSecundario, textAlign: 'center', marginBottom: 40 }]}>
          Share this 6-digit code with the elderly person's device to link accounts.
        </Text>
        <TouchableOpacity style={[s.botaoPrincipal, { width: '100%' }]} onPress={onConcluir}>
          <Text style={s.botaoTexto}>Go to Dashboard</Text>
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
    const c = await lerConta();
    if (codigo === c.codigo) { await salvarModo('IDOSO'); onSucesso(); }
    else { setErro(true); setCodigo(''); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={{ flex: 1 }}>
        <Onda alturaPercent={0.4} onVoltar={onVoltar}>
          <View style={[s.ondaTopo, { paddingTop: SH * 0.15 }]}>
            <Text style={s.ondaTituloLargo}>Patient Access</Text>
            <Text style={s.ondaSub}>Enter the 6-digit code provided by your caregiver.</Text>
          </View>
        </Onda>
        <View style={s.conteudoBranco}>
          <TextInput
            style={[s.pinInput, erro && { borderColor: CORES.erro }]}
            value={codigo}
            onChangeText={t => {const valor = t.replace(/\D/g, '');
              setCodigo(valor);
              setErro(false);
              if (valor.length === 6) {
              Keyboard.dismiss();
              }
            }}
            keyboardType="numeric" maxLength={6}
            placeholder="• • • • • •" placeholderTextColor={CORES.borda}
            textAlign="center" autoFocus
          />
          {erro && <Text style={[s.erroTexto, { textAlign: 'center', marginTop: 10 }]}>Invalid code</Text>}
          <TouchableOpacity style={[s.botaoPrincipal, { marginTop: 40 }, codigo.length < 6 && s.botaoOff]} onPress={handleVerificar} disabled={codigo.length < 6}>
            <Text style={s.botaoTexto}>Connect</Text>
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
  const handleCriou = (nome, codigo) => { setContaNome(nome); setContaCodigo(codigo); setTela('exibir_codigo'); };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {tela === 'escolha'        && <TelaEscolha onResponsavel={() => setTela('responsavel')} onIdoso={() => setTela('codigo_idoso')} />}
      {tela === 'responsavel'    && <TelaResponsavel onVoltar={() => setTela('escolha')} onEntrar={() => setTela('login')} onCriarConta={() => setTela('criar')} />}
      {tela === 'login'          && <TelaLogin onVoltar={() => setTela('responsavel')} onSucesso={entrarFamiliar} />}
      {tela === 'criar'          && <TelaCriarConta onVoltar={() => setTela('responsavel')} onConcluir={handleCriou} />}
      {tela === 'exibir_codigo'  && <TelaExibirCodigo nome={contaNome} codigo={contaCodigo} onConcluir={entrarFamiliar} />}
      {tela === 'codigo_idoso'   && <TelaCodigoIdoso onVoltar={() => setTela('escolha')} onSucesso={entrarIdoso} />}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: CORES.primaria },
  ondaTopo: { paddingHorizontal: 32, zIndex: 11 },
  ondaTituloLargo: { fontSize: 34, fontWeight: '700', color: CORES.branco, letterSpacing: -0.5, marginBottom: 8 },
  ondaSub: { fontSize: 15, color: 'rgba(255,255,255,0.85)', lineHeight: 22 },
  
  conteudoBranco: {
    position: 'absolute', left: 0, right: 0, bottom: 0, top: SH * 0.40,
    paddingHorizontal: 32, paddingTop: 20, zIndex: 15,
  },
  formScroll: {
    position: 'absolute', left: 0, right: 0, bottom: 0, top: SH * 0.30,
    zIndex: 15,
  },
  formPadding: { paddingHorizontal: 32, paddingTop: 10, paddingBottom: 40 },

  // Cards & Seleção
  selCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: CORES.branco, borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: CORES.borda, ...SOMBRA.pequena,
  },
  selCardAtivo: { borderColor: CORES.primaria, backgroundColor: '#FFF6F6' },
  selIcone: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#F8F9FA', alignItems: 'center', justifyContent: 'center' },
  selTitulo: { fontSize: 16, fontWeight: '800', color: CORES.texto },
  selSub: { fontSize: 13, color: CORES.textoSecundario, marginTop: 4 },

  // Botões
  continuarRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 40, gap: 16 },
  continuarTexto: { fontSize: 15, fontWeight: '600', color: CORES.textoSecundario },
  continuarBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: CORES.primaria, alignItems: 'center', justifyContent: 'center', ...SOMBRA.media },
  continuarBtnOff: { backgroundColor: '#E5E7EB', shadowOpacity: 0 },

  botaoPrincipal: { backgroundColor: CORES.primaria, borderRadius: 16, padding: 18, alignItems: 'center', marginTop: 24, ...SOMBRA.media },
  botaoOff: { backgroundColor: '#E5E7EB', shadowOpacity: 0 },
  botaoTexto: { color: CORES.branco, fontSize: 16, fontWeight: '700' },

  // Ações
  actionCard: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: CORES.branco, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: CORES.borda, ...SOMBRA.pequena },
  actionCardRosa: { backgroundColor: CORES.primaria, borderColor: CORES.primaria, ...SOMBRA.media },
  actionCardIcone: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center' },
  actionCardTitulo: { fontSize: 16, fontWeight: '700', color: CORES.texto },
  actionCardSub: { fontSize: 13, color: CORES.textoSecundario, marginTop: 4 },

  divisorRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginVertical: 24 },
  divisorLinha: { flex: 1, height: 1, backgroundColor: CORES.borda },
  divisorTexto: { fontSize: 14, color: CORES.textoSecundario, fontWeight: '500' },

  // Inputs Minimalistas (Linha em baixo)
  fieldLabel: { fontSize: 13, fontWeight: '700', color: CORES.texto, marginTop: 24, marginBottom: 8 },
  fieldBox: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 10 },
  fieldInput: { flex: 1, fontSize: 15, color: CORES.texto, paddingVertical: 4 },
  
  erroBox: { marginTop: 12 },
  erroTexto: { fontSize: 13, color: CORES.erro, fontWeight: '500' },

  // Exibir Código
  successIcone: { width: 72, height: 72, borderRadius: 36, backgroundColor: CORES.branco, alignItems: 'center', justifyContent: 'center', marginBottom: 20, ...SOMBRA.media },
  codigoRow: { flexDirection: 'row', gap: 12, justifyContent: 'center', marginVertical: 30 },
  codigoDigito: { width: 45, height: 55, borderRadius: 14, backgroundColor: '#FFF6F6', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: CORES.primaria },
  codigoDigitoTexto: { fontSize: 24, fontWeight: '800', color: CORES.primaria },

  // PIN Idoso
  pinInput: { width: '80%', alignSelf: 'center', backgroundColor: '#F9FAFB', borderRadius: 20, borderWidth: 1, borderColor: CORES.borda, paddingVertical: 20, fontSize: 28, fontWeight: '800', color: CORES.texto, letterSpacing: 8, marginTop: 20 },
});