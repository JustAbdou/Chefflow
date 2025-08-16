import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { ActivityIndicator, View } from 'react-native';

import LoginScreen from './src/screens/auth/LoginScreen';
import TabNavigator from './src/navigation/TabNavigator'; // <-- Make sure this exists and is default export
import { Colors } from './src/constants';
import { OrderListsScreen } from './src/screens/orders/OrderListsScreen';
import InvoiceUploadScreen from './src/screens/invoices/InvoiceUploadScreen';
import { RestaurantProvider } from './src/contexts/RestaurantContext';
import { setupFirestoreErrorHandling } from './src/utils/firestoreConnectionManager';
import { clearFirestoreCache, resetFirestoreConnection } from './firebase';
import navigationBarUtils from './src/utils/navigationBar';
import InvoicesScreen from './src/screens/invoices/InvoicesScreen';
import RecipeDetailScreen from './src/screens/recipes/RecipeDetailScreen';
import PrepListsScreen from './src/screens/prep/PrepListsScreen';
import InvoicesDownloadsScreen from './src/screens/invoices/InvoicesDownloadsScreen';
import AddRecipeScreen from './src/screens/recipes/AddRecipeScreen';
import FridgeTempLogsScreen from './src/screens/fridge/FridgeTempLogsScreen';
import CleaningChecklistScreen from './src/screens/cleaning/CleaningChecklistScreen';
import DeliveryTempLogsScreen from "./src/screens/delivery/DeliveryTempLogsScreen";
import HandoverScreen from './src/screens/handover/HandoverScreen';
import HandoverCompletionScreen from './src/screens/handover/HandoverCompletionScreen';
import PreviousHandoversScreen from './src/screens/handover/PreviousHandoversScreen';
import TemperatureRecordsScreen from './src/screens/temperature/TemperatureRecordsScreen';
import TemperatureDownloadsScreen from './src/screens/temperature/TemperatureDownloadsScreen';

const Stack = createStackNavigator();

const downloadables = [
  {
    title: 'Invoices',
    icon: 'document-outline',
    iconColor: Colors.textPrimary,
    iconType: 'ionicon'
  },
];

export default function App() {
  let [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  React.useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('🚀 Initializing ChefFlow app...');
        
        await clearFirestoreCache();
        
        await resetFirestoreConnection();
        
        setupFirestoreErrorHandling();
        
        await navigationBarUtils.initializeNavigationBar();
        
        console.log('✅ ChefFlow app initialization complete');
      } catch (error) {
        console.error('❌ Error during app initialization:', error);
      }
    };

    initializeApp();
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: Colors.backgroundSecondary 
      }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <RestaurantProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Login"
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Main" component={TabNavigator} />
          <Stack.Screen name="OrderLists" component={OrderListsScreen} />
          <Stack.Screen name="PrepLists" component={PrepListsScreen} />
          <Stack.Screen name="InvoiceUpload" component={InvoiceUploadScreen} />
          <Stack.Screen name="Invoices" component={InvoicesScreen} />
          <Stack.Screen name="InvoicesDownloads" component={InvoicesDownloadsScreen} />
          <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} />
          <Stack.Screen name="AddRecipe" component={AddRecipeScreen} />
          <Stack.Screen name="FridgeTempLogs" component={FridgeTempLogsScreen} />
          <Stack.Screen name="CleaningChecklist" component={CleaningChecklistScreen} />
          <Stack.Screen name="DeliveryTempLogs" component={DeliveryTempLogsScreen} />
          <Stack.Screen name="Handover" component={HandoverScreen} />
          <Stack.Screen name="HandoverCompletion" component={HandoverCompletionScreen} />
          <Stack.Screen name="PreviousHandovers" component={PreviousHandoversScreen} />
          <Stack.Screen name="TemperatureRecords" component={TemperatureRecordsScreen} />
          <Stack.Screen name="TemperatureDownloads" component={TemperatureDownloadsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </RestaurantProvider>
  );
}