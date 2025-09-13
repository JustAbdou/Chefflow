import NetInfo from '@react-native-community/netinfo';
import { syncOfflineQueue } from './offlineSync';

let isOnline = true;
let networkListeners = [];
let currentRestaurantId = null;

// Initialize network monitoring
export const initializeNetworkMonitor = (restaurantId) => {
  currentRestaurantId = restaurantId;
  
  // Subscribe to network state updates
  const unsubscribe = NetInfo.addEventListener(state => {
    const wasOnline = isOnline;
    isOnline = state.isConnected && state.isInternetReachable;
    
    console.log(`🌐 Network status: ${isOnline ? 'Online' : 'Offline'}`);
    
    // Notify all listeners
    networkListeners.forEach(listener => {
      try {
        listener(isOnline);
      } catch (error) {
        console.error('❌ Error in network listener:', error);
      }
    });
    
    // If we just came back online, sync the offline queue
    if (!wasOnline && isOnline && currentRestaurantId) {
      console.log('🔄 Back online! Syncing offline operations...');
      syncOfflineQueue(currentRestaurantId);
    }
  });
  
  return unsubscribe;
};

// Add a network listener
export const addNetworkListener = (listener) => {
  if (typeof listener !== 'function') {
    console.error('❌ Network listener must be a function');
    return;
  }
  
  networkListeners.push(listener);
  
  // Immediately call with current status
  listener(isOnline);
  
  // Return a function to remove the listener
  return () => {
    networkListeners = networkListeners.filter(l => l !== listener);
  };
};

// Remove a network listener
export const removeNetworkListener = (listener) => {
  networkListeners = networkListeners.filter(l => l !== listener);
};

// Get current network status
export const getNetworkStatus = () => {
  return isOnline;
};

// Check network status once
export const checkNetworkStatus = async () => {
  try {
    const state = await NetInfo.fetch();
    isOnline = state.isConnected && state.isInternetReachable;
    return isOnline;
  } catch (error) {
    console.error('❌ Error checking network status:', error);
    return false;
  }
};
