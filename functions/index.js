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
    
    // 3. Reset Fridge Temp Logs (delete ALL)
    await deleteCollectionItems(restaurantId, 'fridgelogs', today, 'all');
    
    // 4. Reset Delivery Temp Logs (delete ALL)
    await deleteCollectionItems(restaurantId, 'deliverylogs', today, 'all');
    
    // 5. Reset Cleaning Checklist (delete DONE only)
    await deleteCollectionItems(restaurantId, 'cleaninglist', today, 'done-only');
    
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
