const {onSchedule} = require('firebase-functions/v2/scheduler');
const {onRequest} = require('firebase-functions/v2/https');
const {initializeApp} = require('firebase-admin/app');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

/**
 * Scheduled function that runs daily at 3 AM London time to delete daily collections
 * Schedule: "0 3 * * *" = At 03:00 (3 AM) every day in Europe/London timezone
 * Items are permanently deleted - no archiving is performed
 */
exports.dailyReset = onSchedule({
  schedule: '0 3 * * *',
  timeZone: 'Europe/London'
}, async (event) => {
  console.log('🕒 Daily reset started at 3 AM London time');
  
  try {
    // Get all restaurants
    const restaurantsSnapshot = await db.collection('restaurants').get();
    
    if (restaurantsSnapshot.empty) {
      console.log('No restaurants found');
      return null;
    }

    const resetPromises = [];
    
    // Process each restaurant
    restaurantsSnapshot.forEach(restaurantDoc => {
      const restaurantId = restaurantDoc.id;
      console.log(`📍 Processing restaurant: ${restaurantId}`);
      
      resetPromises.push(resetRestaurantData(restaurantId));
    });

    // Wait for all restaurants to be processed
    await Promise.all(resetPromises);
    
    console.log('✅ Daily reset completed successfully');
    return null;
    
  } catch (error) {
    console.error('❌ Daily reset failed:', error);
    throw error;
  }
});

/**
 * Reset data for a specific restaurant
 */
async function resetRestaurantData(restaurantId) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  
  try {
    // 1. Reset Order Lists (delete ALL)
    await deleteCollectionItems(restaurantId, 'orders', today, 'all');
    
    // 2. Reset Prep Lists (delete DONE only)
    await deleteCollectionItems(restaurantId, 'preplist', today, 'done-only');
    
    // 3. Reset Fridge Temp Logs (reset AM/PM temperatures and set done: false)
    await resetFridgeTemperatures(restaurantId);
    
    // 4. Reset Delivery Temp Logs (reset chilled/frozen temperatures and set done: false)
    await resetDeliveryTemperatures(restaurantId);
    
    // 5. Reset Closing Checklist (set done: false)
    await resetClosingChecklist(restaurantId);
    
    console.log(`✅ Restaurant ${restaurantId} reset completed`);
    
  } catch (error) {
    console.error(`❌ Error resetting restaurant ${restaurantId}:`, error);
    throw error;
  }
}

/**
 * Delete documents from a collection (no archiving)
 * @param {string} restaurantId - Restaurant ID
 * @param {string} collectionName - Collection to process
 * @param {string} date - Date string for logging purposes
 * @param {string} mode - 'all' or 'done-only'
 */
async function deleteCollectionItems(restaurantId, collectionName, date, mode) {
  try {
    console.log(`�️ Deleting ${collectionName} for restaurant ${restaurantId} (mode: ${mode})`);
    
    // Get the collection reference
    const collectionRef = db.collection('restaurants').doc(restaurantId).collection(collectionName);
    
    // Query based on mode
    let query = collectionRef;
    if (mode === 'done-only') {
      query = collectionRef.where('done', '==', true);
    }
    
    const snapshot = await query.get();
    
    if (snapshot.empty) {
      console.log(`No documents to process in ${collectionName}`);
      return;
    }
    
    console.log(`Found ${snapshot.size} documents to delete in ${collectionName}`);
    
    // Use batch operations for efficiency
    const batch = db.batch();
    
    snapshot.forEach(doc => {
      // Mark for deletion from original collection (no archiving)
      batch.delete(doc.ref);
    });
    
    // Execute delete operation
    await batch.commit();
    console.log(`🗑️ Deleted ${snapshot.size} documents from ${collectionName}`);
    
  } catch (error) {
    console.error(`❌ Error processing ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Reset fridge temperature logs (clear AM/PM temperatures and set done: false)
 * @param {string} restaurantId - Restaurant ID
 */
async function resetFridgeTemperatures(restaurantId) {
  try {
    console.log(`🧊 Resetting fridge temperatures for restaurant ${restaurantId}`);
    
    const collectionRef = db.collection('restaurants').doc(restaurantId).collection('fridgelogs');
    const snapshot = await collectionRef.get();
    
    if (snapshot.empty) {
      console.log('No fridge logs to reset');
      return;
    }
    
    console.log(`Found ${snapshot.size} fridge logs to reset`);
    
    const batch = db.batch();
    
    snapshot.forEach(doc => {
      batch.update(doc.ref, {
        temperatureAM: '',
        temperaturePM: '',
        done: false
      });
    });
    
    await batch.commit();
    console.log(`🧊 Reset ${snapshot.size} fridge temperature logs`);
    
  } catch (error) {
    console.error('❌ Error resetting fridge temperatures:', error);
    throw error;
  }
}

/**
 * Reset delivery temperature logs (clear chilled/frozen temperatures and set done: false)
 * @param {string} restaurantId - Restaurant ID
 */
async function resetDeliveryTemperatures(restaurantId) {
  try {
    console.log(`🚚 Resetting delivery temperatures for restaurant ${restaurantId}`);
    
    const collectionRef = db.collection('restaurants').doc(restaurantId).collection('deliverylogs');
    const snapshot = await collectionRef.get();
    
    if (snapshot.empty) {
      console.log('No delivery logs to reset');
      return;
    }
    
    console.log(`Found ${snapshot.size} delivery logs to reset`);
    
    const batch = db.batch();
    
    snapshot.forEach(doc => {
      batch.update(doc.ref, {
        chilled: '',
        frozen: '',
        done: false
      });
    });
    
    await batch.commit();
    console.log(`🚚 Reset ${snapshot.size} delivery temperature logs`);
    
  } catch (error) {
    console.error('❌ Error resetting delivery temperatures:', error);
    throw error;
  }
}

/**
 * Reset closing checklist (set done: false for all items)
 * @param {string} restaurantId - Restaurant ID
 */
async function resetClosingChecklist(restaurantId) {
  try {
    console.log(`🧹 Resetting closing checklist for restaurant ${restaurantId}`);
    
    const collectionRef = db.collection('restaurants').doc(restaurantId).collection('cleaninglist');
    const snapshot = await collectionRef.get();
    
    if (snapshot.empty) {
      console.log('No cleaning checklist items to reset');
      return;
    }
    
    console.log(`Found ${snapshot.size} checklist items to reset`);
    
    const batch = db.batch();
    
    snapshot.forEach(doc => {
      batch.update(doc.ref, {
        done: false
      });
    });
    
    await batch.commit();
    console.log(`🧹 Reset ${snapshot.size} cleaning checklist items`);
    
  } catch (error) {
    console.error('❌ Error resetting closing checklist:', error);
    throw error;
  }
}

/**
 * Manual trigger function for testing (can be called via HTTP)
 * Remove this in production or add authentication
 */
exports.manualReset = onRequest(async (req, res) => {
  try {
    console.log('🔧 Manual reset triggered');
    
    // Get restaurant ID from query parameter
    const restaurantId = req.query.restaurantId;
    
    if (!restaurantId) {
      res.status(400).send('Missing restaurantId parameter');
      return;
    }
    
    await resetRestaurantData(restaurantId);
    
    res.status(200).send(`✅ Manual reset completed for restaurant: ${restaurantId}`);
    
  } catch (error) {
    console.error('❌ Manual reset failed:', error);
    res.status(500).send('Manual reset failed: ' + error.message);
  }
});
