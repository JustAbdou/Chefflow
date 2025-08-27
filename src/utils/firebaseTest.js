import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { checkFirebaseStorageHealth } from './pdfUpload';

/**
 * Test Firebase Storage configuration and upload capabilities
 * Call this function on app startup or in a debug screen to verify Firebase is working
 */
export const testFirebaseStorageSetup = async () => {try {
    // Check if Firebase Storage is available
    const isHealthy = await checkFirebaseStorageHealth();

    
    if (isHealthy) {return {
        success: true,
        message: 'Firebase Storage is ready for use',
        details: {
          storageAvailable: true,
          configurationValid: true
        }
      };
    } else {return {
        success: false,
        message: 'Firebase Storage is not properly configured',
        details: {
          storageAvailable: false,
          configurationValid: false
        }
      };
    }
  } catch (error) {return {
      success: false,
      message: 'Firebase Storage test failed',
      error: error.message,
      details: {
        storageAvailable: false,
        configurationValid: false,
        errorCode: error.code || 'unknown'
      }
    };
  }
};

/**
 * Get diagnostics about the current Firebase and app environment
 */
export const getFirebaseDiagnostics = () => {
  try {
    return {
      environment: __DEV__ ? 'development' : 'production',
      timestamp: new Date().toISOString(),
      platform: Platform.OS,
      expoVersion: Constants.expoVersion || 'unknown',
      appVersion: Constants.nativeAppVersion || 'unknown'
    };
  } catch (error) {return {
      error: error.message
    };
  }
};
