// SECURE Firebase Configuration - Uses Environment Variables
// This file is safe to commit to Git as it doesn't contain sensitive data

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
  getAuth, 
  initializeAuth, 
  getReactNativePersistence 
} from "firebase/auth";
import { 
  getStorage, 
  ref as storageRef, 
  uploadBytes, 
  getDownloadURL 
} from "firebase/storage";
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

// Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Validate that all required environment variables are present
const requiredEnvVars = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID'
];

const missingEnvVars = requiredEnvVars.filter(
  varName => !process.env[varName]
);

if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(', ')}\n` +
    'Please create a .env file based on .env.example and fill in your Firebase configuration.'
  );
}

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize Auth with persistence
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});

// Initialize Firestore with specific settings to resolve connection issues
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true, // Use long polling instead of WebSocket
  cache: {
    sizeBytes: 40 * 1024 * 1024, // 40MB cache
  }
});

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
    await clearIndexedDbPersistence(db);
    console.log('✅ Firestore cache cleared successfully');
  } catch (error) {
    console.warn('⚠️ Could not clear Firestore cache (this is normal if no cache exists):', error.message);
  }
};

// Call this function to reset Firestore cache
clearFirestoreCache();

// Test Firebase initialization and connectivity
export const testFirebaseConnection = async () => {
  try {
    console.log('🔍 Testing Firebase connection...');

    // Log Firebase project details (safe to log, no sensitive data)
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
if (__DEV__) {
  // Enable network logging in development
  console.log('🔥 Firebase initialized in development mode');
  console.log('📊 Project ID:', firebaseConfig.projectId);
}
