// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  connectFirestoreEmulator,
  enableNetwork,
  disableNetwork,
  clearIndexedDbPersistence,
  initializeFirestore,
  doc,
  setDoc
} from "firebase/firestore";
import { 
  initializeAuth,
  getReactNativePersistence
} from "firebase/auth";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  getStorage, 
  ref as storageRef, 
  uploadBytes, 
  getDownloadURL 
} from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBYv2mXBoG331ihDQobE4JGv6hqCZxFd84",
  authDomain: "chefflow-c8581.firebaseapp.com",
  projectId: "chefflow-c8581",
  storageBucket: "chefflow-c8581.firebasestorage.app",
  messagingSenderId: "461434725803",
  appId: "1:461434725803:web:b18a455453fd8343cadeee",
  measurementId: "G-Q3B29F6JN3"
};



// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication with AsyncStorage persistence
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// Initialize Firestore with specific settings to resolve connection issues
export const db = getFirestore(app);
console.log('✅ Firestore initialized:', db ? 'Success' : 'Failed');
console.log('📊 Firestore app:', db?.app?.name, db?.type);

// Initialize Firebase Storage
export const storage = getStorage(app);

// Function to reset Firestore connection
export const resetFirestoreConnection = async () => {
  try {
    console.log('🔄 Resetting Firestore connection...');
    await disableNetwork(db);
    await enableNetwork(db);
    console.log('✅ Firestore connection reset successfully');
  } catch (error) {
    console.error('❌ Error resetting Firestore connection:', error);
  }
};

// Clear any cached data from previous project
export const clearFirestoreCache = async () => {
  try {
    console.log('🧹 Clearing Firestore cache...');
    // Note: clearIndexedDbPersistence is for web only and may not work properly in React Native
    // await clearIndexedDbPersistence(db);
    console.log('✅ Firestore cache cleared successfully');
  } catch (error) {
    console.warn('⚠️ Could not clear Firestore cache (this is normal if no cache exists):', error.message);
  }
};

// Note: Automatic cache clearing on module load is disabled to prevent initialization issues
// Call clearFirestoreCache() manually if needed for debugging
// clearFirestoreCache();

// Test Firebase initialization and connectivity
export const testFirebaseConnection = async () => {
  try {
    console.log('🔍 Testing Firebase connection...');

    // Log Firebase project details
    console.log('📊 Firebase Project ID:', firebaseConfig.projectId);
    console.log('🪣 Firebase Storage Bucket:', firebaseConfig.storageBucket);

    // Test Firestore connection
    const testDoc = doc(db, 'test-connection', 'test');
    await setDoc(testDoc, { timestamp: new Date().toISOString() });
    console.log('✅ Firestore connection test successful');

    // Test Storage connection - try to get a reference
    const testStorageRef = storageRef(storage, 'test-connection/test.txt');
    console.log('✅ Storage reference created successfully');

    // Test Authentication
    const user = auth.currentUser;
    if (user) {
      console.log('👤 Authenticated user:', user.email);
    } else {
      console.log('👤 No authenticated user');
    }

    console.log('🎉 Firebase connection test completed successfully');
  } catch (error) {
    console.error('❌ Firebase connection test failed:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
  }
};

// Add error handling and connection settings
const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production';
if (isDev) {
  // Enable network logging in development
  console.log('🔥 Firebase initialized in development mode');
  console.log('📊 Project ID:', firebaseConfig.projectId);
}