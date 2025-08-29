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
  getAuth
} from "firebase/auth";
import { 
  getStorage, 
  ref as storageRef, 
  uploadBytes, 
  getDownloadURL 
} from "firebase/storage";
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "replace-with-your-api-key",
  authDomain: "replace-with-your-auth-domain",
  projectId: "replace-with-your-project-id",
  storageBucket: "replace-with-your-storage-bucket",
  messagingSenderId: "replace-with-your-messaging-sender-id",
  appId: "replace-with-your-app-id",
  measurementId: "replace-with-your-measurement-id"
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);

// Initialize Firestore with specific settings to resolve connection issues
export const db = getFirestore(app);

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