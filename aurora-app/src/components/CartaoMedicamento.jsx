import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function CartaoMedicamento({ medicamento, confirmado, onConfirmar }) {
  return (
    <View style={[estilos.cartao, confirmado && estilos.cartaoConfirmado]}>
      <View style={estilos.info}>
        <Text style={estilos.nome}>{medicamento.nome}</Text>
        <Text style={estilos.detalhe}>{medicamento.dosagem}</Text>
        <Text style={estilos.horario}>
          ⏰ {medicamento.horarios?.join(' • ')}
        </Text>
      </View>

      {confirmado ? (
        <View style={estilos.confirmadoBadge}>
          <Text style={estilos.confirmadoTexto}>✅ Tomei!</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={estilos.botao}
          onPress={() => onConfirmar(medicamento.horarios?.[0] || '')}
          activeOpacity={0.8}
        >
          <Text style={estilos.botaoTexto}>Tomei!</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: {
    backgroundColor: '#fff',
    borderRadius: 16, padding: 18,
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
  },
  cartaoConfirmado: { backgroundColor: '#E8F5E9' },
  info: { flex: 1 },
  nome: { fontSize: 20, fontWeight: 'bold', color: '#1A1A2E' },
  detalhe: { fontSize: 15, color: '#555', marginTop: 2 },
  horario: { fontSize: 14, color: '#888', marginTop: 4 },
  botao: {
    backgroundColor: '#1565C0', borderRadius: 12,
    paddingHorizontal: 18, paddingVertical: 12,
  },
  botaoTexto: { color: '#fff', fontSize: 16, fontWeight: '700' },
  confirmadoBadge: { padding: 8 },
  confirmadoTexto: { fontSize: 16, color: '#2E7D32', fontWeight: '600' },
});
