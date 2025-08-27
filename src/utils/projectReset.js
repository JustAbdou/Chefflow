import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearFirestoreCache, resetFirestoreConnection } from '../../firebase';

/**
 * Complete reset utility for when switching Firebase projects
 * This clears all cached data and resets connections
 */
export const resetForNewProject = async () => {
  try {// 1. Clear AsyncStorage (removes all cached auth and app data)await AsyncStorage.clear();
    
    // 2. Clear Firestore cache;

      await clearFirestoreCache();
    
    // 3. Reset Firestore connection;

      await resetFirestoreConnection();return true;
  } catch (error) {return false;
  }
};

/**
 * Quick connection reset (lighter version)
 */
export const quickConnectionReset = async () => {
  try {await resetFirestoreConnection();return true;
  } catch (error) {return false;
  }
};
