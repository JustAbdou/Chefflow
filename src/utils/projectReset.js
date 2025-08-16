import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearFirestoreCache, resetFirestoreConnection } from '../../firebase';


export const resetForNewProject = async () => {
  try {
    console.log('🔄 Starting complete project reset...');
    console.log('🧹 Clearing AsyncStorage...');
    await AsyncStorage.clear();
    console.log('🧹 Clearing Firestore cache...');
    await clearFirestoreCache();
    console.log('🔄 Resetting Firestore connection...');
    await resetFirestoreConnection();
    console.log('✅ Project reset complete! App should work with new Firebase project.');
    return true;
  } catch (error) {
    console.error('❌ Error during project reset:', error);
    return false;
  }
};

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
