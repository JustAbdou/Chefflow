import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearFirestoreCache, resetFirestoreConnection } from '../../firebase';

/**
 * Complete reset utility for when switching Firebase projects
 * This clears all cached data and resets connections
 */
export const resetForNewProject = async () => {
  try {
    console.log('🔄 Starting complete project reset...');
    
    // 1. Clear AsyncStorage (removes all cached auth and app data)
    console.log('🧹 Clearing AsyncStorage...');
    await AsyncStorage.clear();
    
    // 2. Clear Firestore cache
    console.log('🧹 Clearing Firestore cache...');
    await clearFirestoreCache();
    
    // 3. Reset Firestore connection
    console.log('🔄 Resetting Firestore connection...');
    await resetFirestoreConnection();
    
    console.log('✅ Project reset complete! App should work with new Firebase project.');
    
    return true;
  } catch (error) {
    console.error('❌ Error during project reset:', error);
    return false;
  }
};

/**
 * Quick connection reset (lighter version)
 */
export const quickConnectionReset = async () => {
  try {
    console.log('⚡ Quick connection reset...');
    await resetFirestoreConnection();
    console.log('✅ Connection reset complete');
    return true;
  } catch (error) {
    console.error('❌ Error during quick reset:', error);
    return false;
  }
};
