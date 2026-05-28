import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  salvarModo, salvarFamiliarId, salvarIdosoId, concluirOnboarding,
} from '../services/armazenamento';
import { criarPerfilIdoso } from '../services/api';

// ── Passo 1: Escolha do modo ──────────────────────────────────────────────────
function EscolhaModoPasso({ onFamiliar, onIdoso }) {
  return (
    <View style={estilos.passoContainer}>
      <Text style={estilos.logo}>🌙 lyra</Text>
      <Text style={estilos.logoSubtitulo}>Assistente de cuidado para idosos</Text>

      <Text style={estilos.pergunta}>Quem está usando este dispositivo?</Text>

      <TouchableOpacity style={estilos.botaoOpcao} onPress={onFamiliar}>
        <Text style={estilos.botaoOpcaoIcone}>👨‍👩‍👧</Text>
        <View>
          <Text style={estilos.botaoOpcaoTitulo}>Sou Familiar / Responsável</Text>
          <Text style={estilos.botaoOpcaoSub}>Vou configurar e monitorar</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={[estilos.botaoOpcao, estilos.botaoOpcaoSecundario]} onPress={onIdoso}>
        <Text style={estilos.botaoOpcaoIcone}>👴</Text>
        <View>
          <Text style={estilos.botaoOpcaoTitulo}>Sou o Idoso (já configurado)</Text>
          <Text style={estilos.botaoOpcaoSub}>O familiar já configurou para mim</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

// ── Passo 2: Configuração do familiar ────────────────────────────────────────
function ConfiguracaoFamiliarPasso({ onConcluir }) {
  const [nomeIdoso, setNomeIdoso] = useState('');
  const [checkinInicio, setCheckinInicio] = useState('9');
  const [checkinFim, setCheckinFim] = useState('18');
  const [salvando, setSalvando] = useState(false);

  const handleSalvar = async () => {
    if (!nomeIdoso.trim()) {
      Alert.alert('Atenção', 'Digite o nome do familiar idoso.');
      return;
    }
    setSalvando(true);
    try {
      // Gera ID temporário para o familiar (em produção use autenticação real)
      const familiarId = `familiar_${Date.now()}`;
      await salvarFamiliarId(familiarId);

      const perfil = await criarPerfilIdoso(
        nomeIdoso,
        familiarId,
        parseInt(checkinInicio),
        parseInt(checkinFim)
      );

      await salvarIdosoId(perfil.id);
      await salvarModo('FAMILIAR');
      await concluirOnboarding();
      onConcluir();
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível salvar. Verifique se o servidor está rodando.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <ScrollView>
      <View style={estilos.passoContainer}>
        <Text style={estilos.passoTitulo}>Configure o perfil</Text>
        <Text style={estilos.passoSubtitulo}>
          Informe os dados do seu familiar que usará o lyra
        </Text>

        <Text style={estilos.label}>Nome do idoso</Text>
        <TextInput
          style={estilos.input}
          placeholder="Ex: João da Silva"
          value={nomeIdoso}
          onChangeText={setNomeIdoso}
        />

        <Text style={estilos.label}>Janela de check-in (hora de início)</Text>
        <TextInput
          style={estilos.input}
          placeholder="Ex: 9"
          value={checkinInicio}
          onChangeText={setCheckinInicio}
          keyboardType="numeric"
        />

        <Text style={estilos.label}>Janela de check-in (hora de fim)</Text>
        <TextInput
          style={estilos.input}
          placeholder="Ex: 18"
          value={checkinFim}
          onChangeText={setCheckinFim}
          keyboardType="numeric"
        />

        <TouchableOpacity
          style={[estilos.botaoConfirmar, salvando && { opacity: 0.6 }]}
          onPress={handleSalvar}
          disabled={salvando}
        >
          <Text style={estilos.botaoConfirmarTexto}>
            {salvando ? 'Salvando...' : 'Criar perfil e entrar'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ── Tela principal de Onboarding ──────────────────────────────────────────────
export default function OnboardingScreen({ navigation }) {
  const [passo, setPasso] = useState(0); // 0=escolha, 1=config familiar

  const entrarComoIdoso = async () => {
    // Idoso entra direto — familiar já configurou o dispositivo
    await salvarModo('IDOSO');
    await concluirOnboarding();
    navigation.replace('Idoso');
  };

  if (passo === 0) {
    return (
      <SafeAreaView style={estilos.container}>
        <EscolhaModoPasso
          onFamiliar={() => setPasso(1)}
          onIdoso={entrarComoIdoso}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={estilos.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ConfiguracaoFamiliarPasso
          onConcluir={() => navigation.replace('Familiar')}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4FF' },
  passoContainer: { flex: 1, padding: 28, justifyContent: 'center' },

  logo: { fontSize: 48, textAlign: 'center', marginBottom: 8 },
  logoSubtitulo: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 48 },

  pergunta: { fontSize: 20, fontWeight: '600', color: '#1A1A2E', marginBottom: 24, textAlign: 'center' },

  botaoOpcao: {
    backgroundColor: '#1565C0', borderRadius: 16, padding: 20,
    flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16,
  },
  botaoOpcaoSecundario: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#1565C0' },
  botaoOpcaoIcone: { fontSize: 36 },
  botaoOpcaoTitulo: { fontSize: 16, fontWeight: '600', color: '#fff' },
  botaoOpcaoSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  passoTitulo: { fontSize: 26, fontWeight: 'bold', color: '#1A1A2E', marginBottom: 8 },
  passoSubtitulo: { fontSize: 15, color: '#666', marginBottom: 28 },

  label: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 12,
    padding: 14, fontSize: 16, backgroundColor: '#fff', marginBottom: 16,
  },

  botaoConfirmar: {
    backgroundColor: '#1565C0', borderRadius: 14,
    padding: 18, alignItems: 'center', marginTop: 8,
  },
  botaoConfirmarTexto: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
