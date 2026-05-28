import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

export default function VozIndicador({ ativa }) {
  const pulso = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (ativa) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulso, { toValue: 1.3, duration: 600, useNativeDriver: true }),
          Animated.timing(pulso, { toValue: 1.0, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulso.setValue(1);
    }
  }, [ativa]);

  return (
    <View style={estilos.container}>
      <Animated.View
        style={[
          estilos.bolinha,
          ativa ? estilos.bolinhaAtiva : estilos.bolinhaInativa,
          { transform: [{ scale: pulso }] },
        ]}
      />
      <Text style={[estilos.texto, ativa && estilos.textoAtivo]}>
        {ativa ? 'Ouvindo...' : 'Aurora pausada'}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  bolinha: { width: 10, height: 10, borderRadius: 5 },
  bolinhaAtiva: { backgroundColor: '#4CAF50' },
  bolinhaInativa: { backgroundColor: '#BDBDBD' },
  texto: { fontSize: 13, color: '#999' },
  textoAtivo: { color: '#4CAF50', fontWeight: '500' },
});
