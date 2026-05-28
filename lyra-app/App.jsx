import 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CORES } from './src/theme';
import { lerModo } from './src/services/armazenamento';
import OnboardingScreen from './src/screens/OnboardingScreen';
import FamiliarScreen from './src/screens/FamiliarScreen';
import IdosoScreen from './src/screens/IdosoScreen';

const Stack = createStackNavigator();

export default function App() {
  const [telaInicial, setTelaInicial] = useState(null);

  useEffect(() => {
    determinarTela();
  }, []);

  const determinarTela = async () => {
    try {
      const modo = await lerModo();
      if (modo === 'IDOSO') setTelaInicial('Idoso');
      else if (modo === 'FAMILIAR') setTelaInicial('Familiar');
      else setTelaInicial('Onboarding');
    } catch {
      setTelaInicial('Onboarding');
    }
  };

  if (!telaInicial) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: CORES.secundaria }}>
        <ActivityIndicator size="large" color={CORES.primaria} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName={telaInicial} screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="Familiar" component={FamiliarScreen} />
          <Stack.Screen name="Idoso" component={IdosoScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
