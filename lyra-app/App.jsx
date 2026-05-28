import 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import OnboardingScreen from './src/screens/OnboardingScreen';
import FamiliarScreen from './src/screens/FamiliarScreen';
import IdosoScreen from './src/screens/IdosoScreen';
import { lerModo, lerOnboarding } from './src/services/armazenamento';

const Stack = createStackNavigator();

export default function App() {
  const [telaInicial, setTelaInicial] = useState(null); // null = carregando
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    determinarTelaInicial();
  }, []);

  const determinarTelaInicial = async () => {
    try {
      const onboardingConcluido = await lerOnboarding();
      if (!onboardingConcluido) {
        setTelaInicial('Onboarding');
        return;
      }

      const modo = await lerModo();
      setTelaInicial(modo === 'IDOSO' ? 'Idoso' : 'Familiar');
    } catch (e) {
      setTelaInicial('Onboarding');
    } finally {
      setCarregando(false);
    }
  };

  // Tela de carregamento inicial
  if (carregando || !telaInicial) {
    return (
      <View style={estilos.loading}>
        <ActivityIndicator size="large" color="#1565C0" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={telaInicial}
          screenOptions={{ headerShown: false }} // sem barra de título padrão
        >
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="Familiar" component={FamiliarScreen} />
          <Stack.Screen name="Idoso" component={IdosoScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const estilos = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F4FF',
  },
});
