import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const CORES = {
  CRITICO: { fundo: '#FFEBEE', borda: '#D32F2F', texto: '#B71C1C', icone: '🚨' },
  MEDIO:   { fundo: '#FFF8E1', borda: '#F57F17', texto: '#E65100', icone: '⚠️' },
  LEVE:    { fundo: '#F3F4F6', borda: '#9E9E9E', texto: '#424242', icone: '💊' },
};

export default function CartaoAlerta({ alerta, onVisualizar }) {
  const cor = CORES[alerta.tipo] || CORES.LEVE;
  const data = new Date(alerta.criado_em);
  const dataFormatada = data.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <TouchableOpacity
      style={[
        estilos.cartao,
        { backgroundColor: cor.fundo, borderLeftColor: cor.borda },
        !alerta.visualizado && estilos.naoVisto,
      ]}
      onPress={!alerta.visualizado ? onVisualizar : undefined}
      activeOpacity={alerta.visualizado ? 1 : 0.7}
    >
      <Text style={estilos.icone}>{cor.icone}</Text>
      <View style={estilos.corpo}>
        <Text style={[estilos.mensagem, { color: cor.texto }]}>
          {alerta.mensagem}
        </Text>
        <Text style={estilos.data}>{dataFormatada}</Text>
      </View>
      {!alerta.visualizado && (
        <View style={estilos.bolinha} />
      )}
    </TouchableOpacity>
  );
}

const estilos = StyleSheet.create({
  cartao: {
    borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center',
    borderLeftWidth: 4, marginBottom: 10,
  },
  naoVisto: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
  },
  icone: { fontSize: 24, marginRight: 12 },
  corpo: { flex: 1 },
  mensagem: { fontSize: 14, fontWeight: '500', lineHeight: 20 },
  data: { fontSize: 12, color: '#999', marginTop: 4 },
  bolinha: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#1565C0', marginLeft: 8,
  },
});
