import { enableNetwork, disableNetwork } from 'firebase/firestore';
import { db } from '../../firebase';

export class FirestoreConnectionManager {
  static async checkConnection() {
    try {
      // Disable and re-enable network to force reconnection
      await disableNetwork(db);

      await enableNetwork(db);return true;
    } catch (error) {return false;
    }
  }

  static async retryConnection(maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      
      const success = await this.checkConnection();

      if (success) {
        return true;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
    }
    return false;
  }

  static handleConnectionError(error, context = '') {// Check if it's a network-related error
    if (error.code === 'unavailable' || error.message.includes('transport errored')) {this.retryConnection();
    }
  }
}

// Global error handler for Firestore
export const setupFirestoreErrorHandling = () => {
  // Listen for app state changes and reconnect when app becomes active
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('online', () => {FirestoreConnectionManager.checkConnection();
    });
    
    window.addEventListener('offline', () => {});
  }
};
