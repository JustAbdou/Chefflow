import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDoc, updateDoc, deleteDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { getRestaurantCollection, getRestaurantDoc } from './firestoreHelpers';

// Keys for storing offline data
const OFFLINE_PREP_ITEMS_KEY = 'offline_prep_items';
const OFFLINE_ORDER_ITEMS_KEY = 'offline_order_items';
const OFFLINE_FRIDGE_LOGS_KEY = 'offline_fridge_logs';
const OFFLINE_QUEUE_KEY = 'offline_queue';

// Initialize offline sync system
export const initializeOfflineSync = async (restaurantId) => {
  try {
    console.log('🔄 Initializing offline sync for restaurant:', restaurantId);
    // Clear any stale offline data
    await clearOfflineData();
    return true;
  } catch (error) {
    console.error('❌ Error initializing offline sync:', error);
    return false;
  }
};

// Store prep items offline
export const cachePrepItemsOffline = async (items) => {
  try {
    await AsyncStorage.setItem(OFFLINE_PREP_ITEMS_KEY, JSON.stringify(items));
    console.log(`💾 Cached ${items.length} prep items offline`);
  } catch (error) {
    console.error('❌ Error caching prep items offline:', error);
  }
};

// Get cached prep items
export const getCachedPrepItems = async () => {
  try {
    const cached = await AsyncStorage.getItem(OFFLINE_PREP_ITEMS_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch (error) {
    console.error('❌ Error getting cached prep items:', error);
    return [];
  }
};

// Store order items offline
export const cacheOrderItemsOffline = async (items) => {
  try {
    await AsyncStorage.setItem(OFFLINE_ORDER_ITEMS_KEY, JSON.stringify(items));
    console.log(`💾 Cached ${items.length} order items offline`);
  } catch (error) {
    console.error('❌ Error caching order items offline:', error);
  }
};

// Get cached order items
export const getCachedOrderItems = async () => {
  try {
    const cached = await AsyncStorage.getItem(OFFLINE_ORDER_ITEMS_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch (error) {
    console.error('❌ Error getting cached order items:', error);
    return [];
  }
};

// Store fridge logs offline
export const cacheFridgeLogsOffline = async (logs) => {
  try {
    await AsyncStorage.setItem(OFFLINE_FRIDGE_LOGS_KEY, JSON.stringify(logs));
    console.log(`💾 Cached ${logs.length} fridge logs offline`);
  } catch (error) {
    console.error('❌ Error caching fridge logs offline:', error);
  }
};

// Get cached fridge logs
export const getCachedFridgeLogs = async () => {
  try {
    const cached = await AsyncStorage.getItem(OFFLINE_FRIDGE_LOGS_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch (error) {
    console.error('❌ Error getting cached fridge logs:', error);
    return [];
  }
};

// Add fridge log offline (for offline mode)
export const addFridgeLogOffline = async (restaurantId, logData) => {
  try {
    const offlineId = `offline_fridge_${Date.now()}_${Math.random()}`;
    await addToOfflineQueue({
      type: 'create',
      collection: 'fridgelogs',
      data: logData,
      offlineId
    });
    return { id: offlineId, ...logData, isOffline: true };
  } catch (error) {
    console.error('❌ Error adding fridge log offline:', error);
    throw error;
  }
};

// Add item to offline queue
const addToOfflineQueue = async (operation) => {
  try {
    const queue = await getOfflineQueue();
    queue.push({
      ...operation,
      timestamp: Date.now(),
      id: `offline_${Date.now()}_${Math.random()}`
    });
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('❌ Error adding to offline queue:', error);
  }
};

// Get offline queue
const getOfflineQueue = async () => {
  try {
    const queue = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    return queue ? JSON.parse(queue) : [];
  } catch (error) {
    console.error('❌ Error getting offline queue:', error);
    return [];
  }
};

// Clear offline queue
const clearOfflineQueue = async () => {
  try {
    await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
  } catch (error) {
    console.error('❌ Error clearing offline queue:', error);
  }
};

// Clear all offline data
export const clearOfflineData = async () => {
  try {
    await AsyncStorage.multiRemove([OFFLINE_PREP_ITEMS_KEY, OFFLINE_ORDER_ITEMS_KEY, OFFLINE_FRIDGE_LOGS_KEY, OFFLINE_QUEUE_KEY]);
    console.log('🧹 Cleared all offline data');
  } catch (error) {
    console.error('❌ Error clearing offline data:', error);
  }
};

// Offline-capable create operation
export const offlineCapableCreate = async (restaurantId, collection, data, isOnline = true) => {
  if (isOnline) {
    try {
      const docRef = await addDoc(getRestaurantCollection(restaurantId, collection), data);
      return { id: docRef.id, ...data };
    } catch (error) {
      console.error('❌ Error creating document online:', error);
      // Fall back to offline
      return await offlineCapableCreate(restaurantId, collection, data, false);
    }
  } else {
    // Store in offline queue
    const offlineId = `offline_${Date.now()}_${Math.random()}`;
    await addToOfflineQueue({
      type: 'create',
      collection,
      data,
      offlineId
    });
    return { id: offlineId, ...data, isOffline: true };
  }
};

// Offline-capable update operation
export const offlineCapableUpdate = async (restaurantId, collection, id, data, isOnline = true) => {
  if (isOnline && !id.startsWith('offline_')) {
    try {
      const docRef = getRestaurantDoc(restaurantId, collection, id);
      await updateDoc(docRef, data);
      return true;
    } catch (error) {
      console.error('❌ Error updating document online:', error);
      // Fall back to offline
      return await offlineCapableUpdate(restaurantId, collection, id, data, false);
    }
  } else {
    // Store in offline queue
    await addToOfflineQueue({
      type: 'update',
      collection,
      id,
      data
    });
    return true;
  }
};

// Offline-capable delete operation
export const offlineCapableDelete = async (restaurantId, collection, id, isOnline = true) => {
  if (isOnline && !id.startsWith('offline_')) {
    try {
      const docRef = getRestaurantDoc(restaurantId, collection, id);
      await deleteDoc(docRef);
      return true;
    } catch (error) {
      console.error('❌ Error deleting document online:', error);
      // Fall back to offline
      return await offlineCapableDelete(restaurantId, collection, id, false);
    }
  } else {
    // Store in offline queue
    await addToOfflineQueue({
      type: 'delete',
      collection,
      id
    });
    return true;
  }
};

// Sync offline queue when back online
export const syncOfflineQueue = async (restaurantId) => {
  try {
    const queue = await getOfflineQueue();
    if (queue.length === 0) return { success: true, synced: 0 };

    console.log(`🔄 Syncing ${queue.length} offline operations...`);
    
    let syncedCount = 0;
    for (const operation of queue) {
      try {
        switch (operation.type) {
          case 'create':
            await addDoc(getRestaurantCollection(restaurantId, operation.collection), operation.data);
            syncedCount++;
            break;
          case 'update':
            if (!operation.id.startsWith('offline_')) {
              const docRef = getRestaurantDoc(restaurantId, operation.collection, operation.id);
              await updateDoc(docRef, operation.data);
              syncedCount++;
            }
            break;
          case 'delete':
            if (!operation.id.startsWith('offline_')) {
              const docRef = getRestaurantDoc(restaurantId, operation.collection, operation.id);
              await deleteDoc(docRef);
              syncedCount++;
            }
            break;
        }
      } catch (error) {
        console.error(`❌ Error syncing operation ${operation.type}:`, error);
      }
    }

    // Clear the queue after successful sync
    await clearOfflineQueue();
    console.log(`✅ Offline queue synced successfully (${syncedCount}/${queue.length} operations)`);
    return { success: true, synced: syncedCount, total: queue.length };
  } catch (error) {
    console.error('❌ Error syncing offline queue:', error);
    return { success: false, error };
  }
};

// Fetch fresh data from server and update cache
export const refreshDataFromServer = async (restaurantId, collection) => {
  try {
    const q = query(getRestaurantCollection(restaurantId, collection), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Update the appropriate cache
    if (collection === 'preplist') {
      await cachePrepItemsOffline(items);
    } else if (collection === 'orderlist') {
      await cacheOrderItemsOffline(items);
    }

    return items;
  } catch (error) {
    console.error(`❌ Error refreshing ${collection} data from server:`, error);
    throw error;
  }
};
