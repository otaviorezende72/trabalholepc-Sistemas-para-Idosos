import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Dimensions, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { CORES, SOMBRA } from '../theme';
import { salvarConta, lerConta, salvarModo, gerarCodigo } from '../services/armazenamento';

const { height: SH, width: SW } = Dimensions.get('window');


const ALTURA_ONDA = 0.34;

// ── Fundo com Curva Suave e Padrão Abstrato ──────────────────────────────────
function Onda({ onVoltar }) {
  return (
    <View style={{ flex: 1, backgroundColor: CORES.primaria, overflow: 'hidden' }}>
      
      {/* Padrão Abstrato (Wallpaper Style) */}
      <View style={ow.forma1} />
      <View style={ow.forma2} />
      <View style={ow.forma3} />
      <View style={ow.forma4} />

      {onVoltar && (
        <TouchableOpacity style={ow.voltarBtn} onPress={onVoltar}>
          <Feather name="arrow-left" size={20} color={CORES.branco} />
        </TouchableOpacity>
      )}

      {/* Curva Branca Perfeita usando círculo sobredimensionado */}
      <View style={[ow.curvaBranca, { top: SH * ALTURA_ONDA - 45 }]} />
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
    borderRadius: SW, 
  },
  forma1: { position: 'absolute', top: -60, right: -40, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.04)' },
  forma2: { position: 'absolute', top: 100, left: -80, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.06)' },
  forma3: { position: 'absolute', top: 30, left: 60, width: 300, height: 150, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.03)', transform: [{ rotate: '-20deg' }] },
  forma4: { position: 'absolute', top: 220, right: 30, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.05)' },
});

// ── Tela 1: Boas-vindas ───────────────────────────────────────────────────────
function TelaEscolha({ onResponsavel, onIdoso }) {
  const [sel, setSel] = useState(null);

  return (
    <View style={{ flex: 1 }}>
      <Onda />

      <View style={s.conteudoBranco}>
        <View>
          <Text style={s.tituloAreaBranca}>Bem-vindo(a) a Lyra</Text>
          <Text style={s.subAreaBranca}>
            O amor que você sente por eles merece o cuidado que a Lyra oferece.
          </Text>

          <Text style={s.selecaoTitulo}>Selecione seu modo de acesso</Text>
          
          <View style={{ gap: 16 }}>
            {[
              // Textos simplificados para ficar em uma linha
              { id: 'RESPONSAVEL', icone: 'shield', titulo: 'Sou o Responsável' },
              { id: 'IDOSO',       icone: 'heart',  titulo: 'Sou o Idoso' },
            ].map(op => (
              <TouchableOpacity
                key={op.id}
                style={[s.cardPadrao, sel === op.id && s.cardPadraoAtivo]}
                onPress={() => setSel(op.id)}
                activeOpacity={0.8}
              >
                <View style={[s.cardIcone, sel === op.id && { backgroundColor: CORES.primaria }]}>
                  <Feather name={op.icone} size={18} color={sel === op.id ? CORES.branco : CORES.primaria} />
                </View>
                {/* Flex 1 e justifyContent center para alinhar verticalmente com perfeição na ausência de subtítulo */}
                <View style={{ flex: 1, justifyContent: 'center' }}>
                  <Text style={s.cardTitulo}>{op.titulo}</Text>
                </View>
                <Feather 
                  name="check-circle" 
                  size={18} 
                  color={CORES.primaria} 
                  style={{ opacity: sel === op.id ? 1 : 0 }} 
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={s.continuarRow}>
          <Text style={s.continuarTexto}>Continuar</Text>
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
  const [sel, setSel] = useState(null);

  const handleContinuar = () => {
    if (sel === 'ENTRAR') onEntrar();
    if (sel === 'CRIAR') onCriarConta();
  };

  return (
    <View style={{ flex: 1 }}>
      <Onda onVoltar={onVoltar} />
      
      <View style={s.conteudoBranco}>
        <View>
          <Text style={s.tituloAreaBranca}>Responsável</Text>
          <Text style={s.subAreaBranca}>
            Gerencie e acompanhe a rotina do seu familiar em tempo real
          </Text>

          <Text style={s.selecaoTitulo}>Como deseja acessar o painel?</Text>
          
          <View style={{ gap: 16 }}>
            {[
              { id: 'ENTRAR', icone: 'log-in', titulo: 'Entrar na conta', sub: 'Já tenho cadastro' },
              { id: 'CRIAR',  icone: 'user-plus', titulo: 'Criar conta', sub: 'Quero me cadastrar agora' },
            ].map(op => (
              <TouchableOpacity
                key={op.id}
                style={[s.cardPadrao, sel === op.id && s.cardPadraoAtivo]}
                onPress={() => setSel(op.id)}
                activeOpacity={0.8}
              >
                <View style={[s.cardIcone, sel === op.id && { backgroundColor: CORES.primaria }]}>
                  <Feather name={op.icone} size={18} color={sel === op.id ? CORES.branco : CORES.primaria} />
                </View>
                <View style={{ flex: 1, justifyContent: 'center' }}>
                  <Text style={s.cardTitulo}>{op.titulo}</Text>
                  {op.sub && <Text style={s.cardSub}>{op.sub}</Text>}
                </View>
                <Feather name="check-circle" size={18} color={CORES.primaria} style={{ opacity: sel === op.id ? 1 : 0 }} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={s.continuarRow}>
          <Text style={s.continuarTexto}>Continuar</Text>
          <TouchableOpacity
            style={[s.continuarBtn, !sel && s.continuarBtnOff]}
            onPress={handleContinuar}
            disabled={!sel}
          >
            <Feather name="arrow-right" size={20} color={CORES.branco} />
          </TouchableOpacity>
        </View>
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
    <View style={{ flex: 1 }}>
      <KeyboardAvoidingView 
        style={{ flex: 1, backgroundColor: CORES.branco }} 
        behavior="position" 
        contentContainerStyle={{ height: SH }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? -70 : -115} 
      >
        <View style={{ height: SH }}>
          <Onda />
          
          <View style={s.conteudoBranco}>
            <Text style={s.tituloAreaBranca}>Entrar</Text>
            <Text style={s.subAreaBranca}>Insira suas credenciais para acessar o painel</Text>

            <View style={{ marginTop: 24 }}>
              <Text style={[s.fieldLabel, { marginTop: 0 }]}>Usuário</Text>
              <View style={s.fieldBox}>
                <Feather name="user" size={16} color={CORES.textoSecundario} />
                <TextInput style={s.fieldInput} placeholder="Ex: maria.silva" placeholderTextColor="#D1D5DB"
                  value={usuario} onChangeText={t => { setUsuario(t); setErro(''); }} autoCapitalize="none" />
              </View>

              <Text style={s.fieldLabel}>Senha</Text>
              <View style={s.fieldBox}>
                <Feather name="lock" size={16} color={CORES.textoSecundario} />
                <TextInput style={s.fieldInput} placeholder="Sua senha secreta" placeholderTextColor="#D1D5DB"
                  value={senha} onChangeText={t => { setSenha(t); setErro(''); }}
                  secureTextEntry={!verSenha} autoCapitalize="none" />
                <TouchableOpacity onPress={() => setVerSenha(v => !v)}>
                  <Feather name={verSenha ? 'eye-off' : 'eye'} size={16} color={CORES.textoSecundario} />
                </TouchableOpacity>
              </View>

              {erro !== '' && <View style={s.erroBox}><Text style={s.erroTexto}>{erro}</Text></View>}

              <TouchableOpacity style={[s.botaoPrincipal, loading && { opacity: 0.7 }]} onPress={handleEntrar} disabled={loading}>
                {loading ? <ActivityIndicator color={CORES.branco} /> : <Text style={s.botaoTexto}>Acessar painel</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {onVoltar && (
        <TouchableOpacity style={ow.voltarBtn} onPress={onVoltar}>
          <Feather name="arrow-left" size={20} color={CORES.branco} />
        </TouchableOpacity>
      )}
    </View>
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
    <View style={{ flex: 1 }}>
      <KeyboardAvoidingView 
        style={{ flex: 1, backgroundColor: CORES.branco }} 
        behavior="position"
        contentContainerStyle={{ height: SH }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : -45} 
      >
        <View style={{ height: SH }}>
          <Onda />
          
          <View style={s.conteudoBranco}>
            <Text style={s.tituloAreaBranca}>Criar Conta</Text>
            <Text style={s.subAreaBranca}>Preencha seus dados para começar</Text>

            <View style={{ marginTop: 24 }}>
              <Text style={[s.fieldLabel, { marginTop: 0 }]}>Usuário</Text>
              <View style={s.fieldBox}>
                <Feather name="user" size={16} color={CORES.textoSecundario} />
                <TextInput style={s.fieldInput} placeholder="Ex: maria.silva" placeholderTextColor="#D1D5DB"
                  value={usuario} onChangeText={t => { setUsuario(t); setErro(''); }} autoCapitalize="none" />
              </View>

              <Text style={s.fieldLabel}>Senha</Text>
              <View style={s.fieldBox}>
                <Feather name="lock" size={16} color={CORES.textoSecundario} />
                <TextInput style={s.fieldInput} placeholder="Mínimo 4 caracteres" placeholderTextColor="#D1D5DB"
                  value={senha} onChangeText={t => { setSenha(t); setErro(''); }} secureTextEntry autoCapitalize="none" />
              </View>

              <Text style={s.fieldLabel}>Confirmar Senha</Text>
              <View style={s.fieldBox}>
                <Feather name="check-circle" size={16} color={CORES.textoSecundario} />
                <TextInput style={s.fieldInput} placeholder="Repita sua senha" placeholderTextColor="#D1D5DB"
                  value={confirmar} onChangeText={t => { setConfirmar(t); setErro(''); }} secureTextEntry autoCapitalize="none" />
              </View>

              {erro !== '' && <View style={s.erroBox}><Text style={s.erroTexto}>{erro}</Text></View>}

              <TouchableOpacity style={[s.botaoPrincipal, loading && { opacity: 0.7 }]} onPress={handleCriar} disabled={loading}>
                {loading ? <ActivityIndicator color={CORES.branco} /> : <Text style={s.botaoTexto}>Cadastrar e avançar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {onVoltar && (
        <TouchableOpacity style={ow.voltarBtn} onPress={onVoltar}>
          <Feather name="arrow-left" size={20} color={CORES.branco} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Tela 5: Exibir código ─────────────────────────────────────────────────────
function TelaExibirCodigo({ nome, codigo, onConcluir }) {
  return (
    <View style={{ flex: 1 }}>
      <Onda />
      
      <View style={[s.conteudoBranco, { alignItems: 'center' }]}>
        <View style={s.successIcone}><Feather name="check" size={32} color={CORES.primaria} /></View>
        <Text style={s.tituloAreaBranca}>Tudo pronto!</Text>
        <Text style={s.subAreaBranca}>Conta criada com sucesso para {nome}</Text>

        <Text style={[s.fieldLabel, { marginTop: 10 }]}>Código de Acesso do Idoso</Text>
        <View style={s.codigoRow}>
          {codigo.split('').map((d, i) => (
            <View key={i} style={s.codigoDigito}><Text style={s.codigoDigitoTexto}>{d}</Text></View>
          ))}
        </View>
        
        <Text style={s.subAreaBranca}>
          Compartilhe este código de 6 dígitos para vincular a conta do seu familiar.
        </Text>
        
        <TouchableOpacity style={[s.botaoPrincipal, { width: '100%' }]} onPress={onConcluir}>
          <Text style={s.botaoTexto}>Ir para o Painel</Text>
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
    <View style={{ flex: 1 }}>
      <KeyboardAvoidingView 
        style={{ flex: 1, backgroundColor: CORES.branco }} 
        behavior="position"
        contentContainerStyle={{ height: SH }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? -35 : -80} 
      >
        <View style={{ height: SH }}>
          <Onda />
          
          <View style={[s.conteudoBranco, { paddingTop: 0 }]}>
            <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 20 }}>
              <Text style={s.tituloAreaBranca}>Acesso Paciente</Text>
              <Text style={s.subAreaBranca}>
                Digite o código de 6 dígitos gerado pelo seu familiar.
              </Text>

              <TextInput
                style={[s.pinInput, erro && { borderColor: CORES.erro }]}
                value={codigo}
                onChangeText={t => { setCodigo(t.replace(/\D/g, '')); setErro(false); }}
                keyboardType="numeric" maxLength={6}
                placeholder="• • • • • •" placeholderTextColor={CORES.borda}
                textAlign="center"
              />
              {erro && <Text style={[s.erroTexto, { textAlign: 'center', marginTop: 10 }]}>Código inválido</Text>}
              
              <TouchableOpacity 
                style={[s.botaoPrincipal, codigo.length < 6 && s.botaoOff, { marginTop: erro ? 12 : 32 }]} 
                onPress={handleVerificar} 
                disabled={codigo.length < 6}
              >
                <Text style={s.botaoTexto}>Conectar</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </KeyboardAvoidingView>

      {onVoltar && (
        <TouchableOpacity style={ow.voltarBtn} onPress={onVoltar}>
          <Feather name="arrow-left" size={20} color={CORES.branco} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Principal ─────────────────────────────────────────────────────────────────
export default function OnboardingScreen({ navigation }) {
  const [tela, setTela] = useState('escolha');
  const [contaNome, setContaNome] = useState('');
  const [contaCodigo, setContaCodigo] = useState('');

  const entrarFamiliar = async () => { await salvarModo('FAMILIAR'); navigation.replace('Familiar'); };
  const entrarIdoso = () => navigation.replace('Idoso');
  
  const handleCriou = (nome, codigo) => { 
    setContaNome(nome); 
    setContaCodigo(codigo); 
    setTela('exibir_codigo'); 
  };

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
  
  tituloAreaBranca: { fontSize: 28, fontWeight: '800', color: CORES.texto, textAlign: 'center', marginBottom: 6 },
  subAreaBranca: {fontSize: 14, color: CORES.textoSecundario, textAlign: 'center', paddingHorizontal: 24, lineHeight: 22, marginBottom: 24},

  conteudoBranco: {
    position: 'absolute', left: 0, right: 0, bottom: 0, top: SH * ALTURA_ONDA - 15,
    paddingTop: 40, paddingHorizontal: 32, paddingBottom: 20, zIndex: 15,
  },

  selecaoTitulo: { 
    fontSize: 14, 
    fontWeight: '700', 
    color: CORES.textoSecundario, 
    marginBottom: 16, 
    textAlign: 'center' 
  },
  cardPadrao: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: CORES.branco, borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: CORES.borda, ...SOMBRA.pequena,
  },
  cardPadraoAtivo: { borderColor: CORES.primaria, backgroundColor: CORES.primariaClara },
  
  cardIcone: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#F8F9FA', alignItems: 'center', justifyContent: 'center' },
  cardTitulo: { fontSize: 16, fontWeight: '700', color: CORES.texto },
  cardSub: { fontSize: 13, color: CORES.textoSecundario, marginTop: 4 },

  // Margem padronizada (32) empurrando a parte de baixo
  continuarRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 16, marginTop: 32 },
  continuarTexto: { fontSize: 15, fontWeight: '600', color: CORES.textoSecundario },
  continuarBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: CORES.primaria, alignItems: 'center', justifyContent: 'center', ...SOMBRA.media },
  continuarBtnOff: { backgroundColor: '#E5E7EB', shadowOpacity: 0 },

  botaoPrincipal: { backgroundColor: CORES.primaria, borderRadius: 16, padding: 18, alignItems: 'center', marginTop: 32, ...SOMBRA.media },
  botaoOff: { backgroundColor: '#E5E7EB', shadowOpacity: 0 },
  botaoTexto: { color: CORES.branco, fontSize: 16, fontWeight: '700' },

  fieldLabel: { fontSize: 13, fontWeight: '700', color: CORES.texto, marginTop: 20, marginBottom: 8 },
  fieldBox: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 10 },
  fieldInput: { flex: 1, fontSize: 15, color: CORES.texto, paddingVertical: 4, letterSpacing: 0},
  
  erroBox: { marginTop: 12 },
  erroTexto: { fontSize: 13, color: CORES.erro, fontWeight: '500' },

  successIcone: { width: 72, height: 72, borderRadius: 36, backgroundColor: CORES.primariaClara, alignItems: 'center', justifyContent: 'center', marginBottom: 20, ...SOMBRA.media },
  codigoRow: { flexDirection: 'row', gap: 12, justifyContent: 'center', marginVertical: 20 },
  codigoDigito: { width: 45, height: 55, borderRadius: 14, backgroundColor: CORES.primariaClara, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: CORES.primaria },
  codigoDigitoTexto: { fontSize: 24, fontWeight: '800', color: CORES.primaria },

  pinInput: { width: '80%', alignSelf: 'center', backgroundColor: '#F9FAFB', borderRadius: 20, borderWidth: 1, borderColor: CORES.borda, paddingVertical: 20, fontSize: 28, fontWeight: '800', color: CORES.texto, letterSpacing: 8, marginTop: 10 },
});