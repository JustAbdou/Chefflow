/**
 * Data Migration Script for Restaurant-based Structure
 * 
 * This script helps migrate existing Firestore data from the flat structure
 * to the new restaurants/{restaurantId} based structure.
 * 
 * Run this script once to migrate your existing data.
 */

import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc,
  writeBatch 
} from 'firebase/firestore';
import { db } from '../../firebase';
import { normalizeRestaurantName } from './restaurantUtils';

// Set your restaurant name here - it will be normalized automatically
const RESTAURANT_NAME = 'Mario\'s Pizzeria'; // Change this to your restaurant name
const RESTAURANT_ID = normalizeRestaurantName(RESTAURANT_NAME);

// Collections to migrate
const COLLECTIONS_TO_MIGRATE = [
  'cleaninglist',
  'deliverylogs', 
  'invoices',
  'orderlist',
  'preplist',
  'suppliers'
];

/**
 * Migrate a simple collection
 */
async function migrateCollection(collectionName) {try {
    // Get all documents from the old collection
    const oldCollectionRef = collection(db, collectionName);

    const snapshot = await getDocs(oldCollectionRef);

    
    const batch = writeBatch(db);

    let count = 0;
    
    snapshot.docs.forEach((docSnapshot) => {
      // Create new document in restaurant-based structure
      const newDocRef = doc(db, 'restaurants', RESTAURANT_ID, collectionName, docSnapshot.id);
      batch.set(newDocRef, docSnapshot.data());
      count++;
    });
    
    // Commit the batch
    await batch.commit();} catch (error) {
      // Error handling
    }
}

/**
 * Migrate the recipes collection (more complex due to subcollections)
 */
async function migrateRecipes() {try {
    // First, migrate the categories document
    const categoriesDoc = await getDocs(collection(db, 'recipes'));

    const categoriesData = categoriesDoc.docs.find(doc => doc.id === 'categories');

    
    if (categoriesData) {
      const newCategoriesRef = doc(db, 'restaurants', RESTAURANT_ID, 'recipes', 'categories');

      await setDoc(newCategoriesRef, categoriesData.data());}
    
    // Then migrate each category's recipes
    const categoryNames = categoriesData?.data()?.names || [];

    
    for (const categoryName of categoryNames) {
      const recipesSnapshot = await getDocs(collection(db, 'recipes', 'categories', categoryName));

      const batch = writeBatch(db);

      let count = 0;
      
      recipesSnapshot.docs.forEach((recipeDoc) => {
        const newRecipeRef = doc(
          db, 
          'restaurants', 
          RESTAURANT_ID, 
          'recipes', 
          'categories', 
          categoryName, 
          recipeDoc.id
        );
        batch.set(newRecipeRef, recipeDoc.data());
        count++;
      });

      
      await batch.commit();}
    
  } catch (error) {
      // Error handling
    }
}

/**
 * Migrate the fridge collection (subcollections structure)
 */
async function migrateFridge() {try {
    const fridgeNames = ['walk-in fridge', 'prep fridge']; // Add your fridge names
    
    for (const fridgeName of fridgeNames) {
      const fridgeSnapshot = await getDocs(collection(db, 'fridge', 'fridges', fridgeName));

      const batch = writeBatch(db);

      let count = 0;
      
      fridgeSnapshot.docs.forEach((fridgeDoc) => {
        const newFridgeRef = doc(
          db,
          'restaurants',
          RESTAURANT_ID,
          'fridge',
          'fridges',
          fridgeName,
          fridgeDoc.id
        );
        batch.set(newFridgeRef, fridgeDoc.data());
        count++;
      });

      
      await batch.commit();}
    
  } catch (error) {
      // Error handling
    }
}

/**
 * Migrate the downloads collection (nested structure)
 */
async function migrateDownloads() {try {
    const downloadsSnapshot = await getDocs(collection(db, 'downloads', 'invoices', 'recent_downloads'));

    const batch = writeBatch(db);

    let count = 0;
    
    downloadsSnapshot.docs.forEach((downloadDoc) => {
      const newDownloadRef = doc(
        db,
        'restaurants',
        RESTAURANT_ID,
        'downloads',
        'invoices',
        'recent_downloads',
        downloadDoc.id
      );
      batch.set(newDownloadRef, downloadDoc.data());
      count++;
    });

    
    await batch.commit();} catch (error) {
      // Error handling
    }
}

/**
 * Main migration function
 */
export async function migrateToRestaurantStructure() {if (!RESTAURANT_ID || RESTAURANT_ID === 'your-restaurant-id') {return;
  }
  
  try {
    // Migrate simple collections
    for (const collectionName of COLLECTIONS_TO_MIGRATE) {
      await migrateCollection(collectionName);
    }
    
    // Migrate complex collections
    await migrateRecipes();

    await migrateFridge();

    await migrateDownloads();} catch (error) {
      // Error handling
    }
}

/**
 * Function to delete old collections after successful migration
 * WARNING: Only run this after verifying the migration was successful!
 */
export async function cleanupOldCollections() {const collections = [
    ...COLLECTIONS_TO_MIGRATE,
    'recipes',
    'fridge', 
    'downloads'
  ];
  
  try {
    for (const collectionName of collections) {
      const snapshot = await getDocs(collection(db, collectionName));

      const batch = writeBatch(db);
      
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      
      await batch.commit();}} catch (error) {
      // Error handling
    }
}

/**
 * Migrate data to a specific restaurant name
 * @param {string} restaurantName - The human-readable restaurant name
 */
export async function migrateToRestaurant(restaurantName) {
  if (!restaurantName) {return false;
  }

  const restaurantId = normalizeRestaurantName(restaurantName);`);

  try {
    // Migrate all collections
    for (const collectionName of COLLECTIONS_TO_MIGRATE) {
      await migrateCollectionToRestaurant(collectionName, restaurantId);
    }
    
    // Migrate recipes with special handling
    await migrateRecipesToRestaurant(restaurantId);return true;
  } catch (error) {return false;
  }
}

/**
 * Migrate a single collection to a specific restaurant
 */
async function migrateCollectionToRestaurant(collectionName, restaurantId) {try {
    // Get all documents from the old collection
    const oldCollectionRef = collection(db, collectionName);

    const snapshot = await getDocs(oldCollectionRef);

    
    const batch = writeBatch(db);

    let count = 0;
    
    snapshot.docs.forEach((docSnapshot) => {
      // Create new document in restaurant-based structure
      const newDocRef = doc(db, 'restaurants', restaurantId, collectionName, docSnapshot.id);
      batch.set(newDocRef, docSnapshot.data());
      count++;
    });
    
    // Commit the batch
    await batch.commit();} catch (error) {
      // Error handling
    }
}

/**
 * Migrate recipes to a specific restaurant
 */
async function migrateRecipesToRestaurant(restaurantId) {try {
    // Get all recipe documents
    const recipesRef = collection(db, 'recipes');

    const recipesSnapshot = await getDocs(recipesRef);

    
    let totalRecipes = 0;

    let totalIngredients = 0;

    
    for (const recipeDoc of recipesSnapshot.docs) {
      // Create recipe in new structure
      const newRecipeRef = doc(db, 'restaurants', restaurantId, 'recipes', recipeDoc.id);

      await setDoc(newRecipeRef, recipeDoc.data());
      totalRecipes++;
      
      // Migrate ingredients subcollection
      const ingredientsRef = collection(db, 'recipes', recipeDoc.id, 'ingredients');

      const ingredientsSnapshot = await getDocs(ingredientsRef);

      
      for (const ingredientDoc of ingredientsSnapshot.docs) {
        const newIngredientRef = doc(db, 'restaurants', restaurantId, 'recipes', recipeDoc.id, 'ingredients', ingredientDoc.id);

        await setDoc(newIngredientRef, ingredientDoc.data());
        totalIngredients++;
      }
    }} catch (error) {
      // Error handling
    }
}

// Example usage (uncomment to run):
// migrateToRestaurantStructure();
