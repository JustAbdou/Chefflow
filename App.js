import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { ActivityIndicator, View } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';

import LoginScreen from './src/screens/auth/LoginScreen';
import TabNavigator from './src/navigation/TabNavigator'; // <-- Make sure this exists and is default export
import { Colors } from './src/constants';
import { OrderListsScreen } from './src/screens/orders/OrderListsScreen';
import InvoiceUploadScreen from './src/screens/invoices/InvoiceUploadScreen';
import { RestaurantProvider } from './src/contexts/RestaurantContext';
import { setupFirestoreErrorHandling } from './src/utils/firestoreConnectionManager';
import { clearFirestoreCache, resetFirestoreConnection } from './firebase';
import navigationBarUtils from './src/utils/navigationBar';
import { initializeNetworkMonitor } from './src/utils/networkMonitor';
import InvoicesScreen from './src/screens/invoices/InvoicesScreen';
import InvoiceDetailScreen from './src/screens/invoices/InvoiceDetailScreen';
import RecipeDetailScreen from './src/screens/recipes/RecipeDetailScreen';
import PrepListsScreen from './src/screens/prep/PrepListsScreen';
import InvoicesDownloadsScreen from './src/screens/invoices/InvoicesDownloadsScreen';
import AddRecipeScreen from './src/screens/recipes/AddRecipeScreen';
import EditRecipeScreen from './src/screens/recipes/EditRecipeScreen';
import FridgeTempLogsScreen from './src/screens/fridge/FridgeTempLogsScreen';
import CleaningChecklistScreen from './src/screens/cleaning/CleaningChecklistScreen';
import OpeningChecklistScreen from './src/screens/opening/OpeningChecklistScreen';
import DeliveryTempLogsScreen from "./src/screens/delivery/DeliveryTempLogsScreen";
import CoolingAndReheatingScreen from './src/screens/temperature/CoolingAndReheatingScreen';
import CoolingScreen from './src/screens/temperature/CoolingScreen';
import SousVideScreen from './src/screens/temperature/SousVideScreen';
import HotHoldingScreen from './src/screens/temperature/HotHoldingScreen';
import FoodSafetyMonitoringScreen from './src/screens/foodsafety/FoodSafetyMonitoringScreen';
import ShellfishRecordingScreen from './src/screens/foodsafety/ShellfishRecordingScreen';
import MaintenanceIssuesScreen from './src/screens/maintenance/MaintenanceIssuesScreen';
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
  // ...other items
];

export default function App() {
  const [isUserLoggedIn, setIsUserLoggedIn] = React.useState(null); // null = checking, true = logged in, false = not logged in
  const [servicesInitialized, setServicesInitialized] = React.useState(false);
  
  let [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Check authentication state on app start
  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('🔐 Auth state changed:', user ? 'User logged in' : 'User not logged in');
      setIsUserLoggedIn(!!user); // Convert to boolean, null becomes false
    });

    return unsubscribe;
  }, []);

  // Initialize Firestore error handling and connection setup
  React.useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('🚀 Initializing ChefFlow app...');
        
        // NOTE: Cache clearing is now manual - uncomment if needed for debugging
        // await clearFirestoreCache();
        
        
        // Reset the connection to ensure fresh start
        await resetFirestoreConnection();
        
        // Setup error handling
        setupFirestoreErrorHandling();
        
        // Initialize Android navigation bar (hide bottom buttons)
        await navigationBarUtils.initializeNavigationBar();
        
        // Initialize network monitoring (will be configured per restaurant in screens)
        console.log('🌐 Network monitor ready for initialization');
        
        setServicesInitialized(true);
        console.log('✅ ChefFlow app initialization complete');
      } catch (error) {
        console.error('❌ Error during app initialization:', error);
        setServicesInitialized(true); // Continue anyway
      }
    };

    initializeApp();
  }, []);

  // Show loading screen while checking auth or loading fonts
  if (!fontsLoaded || isUserLoggedIn === null || !servicesInitialized) {
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
          initialRouteName={isUserLoggedIn ? "Main" : "Login"}
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
          <Stack.Screen name="InvoiceDetail" component={InvoiceDetailScreen} />
          <Stack.Screen name="InvoicesDownloads" component={InvoicesDownloadsScreen} />
          <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} />
          <Stack.Screen name="AddRecipe" component={AddRecipeScreen} />
          <Stack.Screen name="EditRecipe" component={EditRecipeScreen} />
          <Stack.Screen name="FridgeTempLogs" component={FridgeTempLogsScreen} />
          <Stack.Screen name="OpeningChecklist" component={OpeningChecklistScreen} />
          <Stack.Screen name="CleaningChecklist" component={CleaningChecklistScreen} />
          <Stack.Screen name="DeliveryTempLogs" component={DeliveryTempLogsScreen} />
          <Stack.Screen name="CoolingAndReheating" component={CoolingAndReheatingScreen} />
          <Stack.Screen name="Cooling" component={CoolingScreen} />
          <Stack.Screen name="SousVide" component={SousVideScreen} />
          <Stack.Screen name="HotHolding" component={HotHoldingScreen} />
          <Stack.Screen name="FoodSafetyMonitoring" component={FoodSafetyMonitoringScreen} />
          <Stack.Screen name="ShellfishRecording" component={ShellfishRecordingScreen} />
          <Stack.Screen name="MaintenanceIssues" component={MaintenanceIssuesScreen} />
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