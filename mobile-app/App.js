import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import HomeScreen from './src/screens/HomeScreen';
import ScanScreen from './src/screens/ScanScreen';
import PasskeyScreen from './src/screens/PasskeyScreen';
import PurchaseScreen from './src/screens/PurchaseScreen';
import SystemDataScreen from './src/screens/SystemDataScreen';
import TransactionHistoryScreen from './src/screens/TransactionHistoryScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import DayDetailsScreen from './src/screens/DayDetailsScreen';

import dailyReportService from './src/services/dailyReportService';

import LoginScreen from './src/screens/LoginScreen';

const Stack = createStackNavigator();

export default function App() {
  useEffect(() => {
    // Start the daily report auto-save service
    dailyReportService.start();

    // Cleanup on unmount
    return () => {
      dailyReportService.stop();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Login">
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Scan" component={ScanScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Passkey" component={PasskeyScreen} options={{ title: 'Verify Identity' }} />
          <Stack.Screen name="Purchase" component={PurchaseScreen} options={{ title: 'Canteen POS' }} />
          <Stack.Screen name="SystemData" component={SystemDataScreen} options={{ title: 'System Data' }} />
          <Stack.Screen name="Users" component={TransactionHistoryScreen} options={{ title: "Student Users" }} />
          <Stack.Screen name="Reports" component={ReportsScreen} options={{ title: 'Historical Reports' }} />
          <Stack.Screen name="DayDetails" component={DayDetailsScreen} options={{ title: 'Day Details' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
