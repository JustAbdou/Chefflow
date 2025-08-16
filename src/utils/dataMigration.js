
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
const RESTAURANT_NAME = 'Mario\'s Pizzeria';
const RESTAURANT_ID = normalizeRestaurantName(RESTAURANT_NAME);
const COLLECTIONS_TO_MIGRATE = [
  'cleaninglist',
  'deliverylogs',
  'invoices',
  'orderlist',
  'preplist',
  'suppliers'
];


async function migrateCollection(collectionName) {
  console.log(`Migrating ${collectionName}...`);
  try {
    const oldCollectionRef = collection(db, collectionName);
    const snapshot = await getDocs(oldCollectionRef);
    const batch = writeBatch(db);
    let count = 0;
    snapshot.docs.forEach((docSnapshot) => {
      const newDocRef = doc(db, 'restaurants', RESTAURANT_ID, collectionName, docSnapshot.id);
      batch.set(newDocRef, docSnapshot.data());
      count++;
    });
    await batch.commit();
    console.log(`✅ Migrated ${count} documents from ${collectionName}`);
  } catch (error) {
    console.error(`❌ Error migrating ${collectionName}:`, error);
  }
}


async function migrateRecipes() {
  console.log('Migrating recipes...');
  try {
    const categoriesDoc = await getDocs(collection(db, 'recipes'));
    const categoriesData = categoriesDoc.docs.find(doc => doc.id === 'categories');
    if (categoriesData) {
      const newCategoriesRef = doc(db, 'restaurants', RESTAURANT_ID, 'recipes', 'categories');
      await setDoc(newCategoriesRef, categoriesData.data());
      console.log('✅ Migrated recipes categories document');
    }
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
      await batch.commit();
      console.log(`✅ Migrated ${count} recipes from ${categoryName} category`);
    }
  } catch (error) {
    console.error('❌ Error migrating recipes:', error);
  }
}


async function migrateFridge() {
  console.log('Migrating fridge data...');
  try {
    const fridgeNames = ['walk-in fridge', 'prep fridge'];
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
      await batch.commit();
      console.log(`✅ Migrated ${count} documents from ${fridgeName}`);
    }
  } catch (error) {
    console.error('❌ Error migrating fridge data:', error);
  }
}


async function migrateDownloads() {
  console.log('Migrating downloads...');
  try {
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
    await batch.commit();
    console.log(`✅ Migrated ${count} download records`);
  } catch (error) {
    console.error('❌ Error migrating downloads:', error);
  }
}



export async function migrateToRestaurantStructure() {
  console.log('🚀 Starting migration to restaurant-based structure...');
  console.log(`Restaurant ID: ${RESTAURANT_ID}`);
  if (!RESTAURANT_ID || RESTAURANT_ID === 'your-restaurant-id') {
    console.error('❌ Please set a valid RESTAURANT_ID before running migration');
    return;
  }
  try {
    for (const collectionName of COLLECTIONS_TO_MIGRATE) {
      await migrateCollection(collectionName);
    }
    await migrateRecipes();
    await migrateFridge();
    await migrateDownloads();
    console.log('✅ Migration completed successfully!');
    console.log('⚠️  Remember to verify the migrated data and delete old collections if everything looks good.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}



export async function cleanupOldCollections() {
  console.log('🧹 Cleaning up old collections...');
  const collections = [
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
      await batch.commit();
      console.log(`✅ Deleted old ${collectionName} collection`);
    }
    console.log('✅ Cleanup completed!');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}



export async function migrateToRestaurant(restaurantName) {
  if (!restaurantName) {
    console.error('❌ Restaurant name is required');
    return false;
  }
  const restaurantId = normalizeRestaurantName(restaurantName);
  console.log(`🔄 Starting migration to restaurant: "${restaurantName}" (ID: ${restaurantId})`);
  try {
    for (const collectionName of COLLECTIONS_TO_MIGRATE) {
      await migrateCollectionToRestaurant(collectionName, restaurantId);
    }
    await migrateRecipesToRestaurant(restaurantId);
    console.log(`✅ Migration completed successfully for restaurant: ${restaurantName}`);
    return true;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return false;
  }
}



async function migrateCollectionToRestaurant(collectionName, restaurantId) {
  console.log(`Migrating ${collectionName} to restaurant ${restaurantId}...`);
  try {
    const oldCollectionRef = collection(db, collectionName);
    const snapshot = await getDocs(oldCollectionRef);
    const batch = writeBatch(db);
    let count = 0;
    snapshot.docs.forEach((docSnapshot) => {
      const newDocRef = doc(db, 'restaurants', restaurantId, collectionName, docSnapshot.id);
      batch.set(newDocRef, docSnapshot.data());
      count++;
    });
    await batch.commit();
    console.log(`✅ Migrated ${count} documents from ${collectionName} to ${restaurantId}`);
  } catch (error) {
    console.error(`❌ Error migrating ${collectionName} to ${restaurantId}:`, error);
  }
}



async function migrateRecipesToRestaurant(restaurantId) {
  console.log(`Migrating recipes to restaurant ${restaurantId}...`);
  try {
    const recipesRef = collection(db, 'recipes');
    const recipesSnapshot = await getDocs(recipesRef);
    let totalRecipes = 0;
    let totalIngredients = 0;
    for (const recipeDoc of recipesSnapshot.docs) {
      const newRecipeRef = doc(db, 'restaurants', restaurantId, 'recipes', recipeDoc.id);
      await setDoc(newRecipeRef, recipeDoc.data());
      totalRecipes++;
      const ingredientsRef = collection(db, 'recipes', recipeDoc.id, 'ingredients');
      const ingredientsSnapshot = await getDocs(ingredientsRef);
      for (const ingredientDoc of ingredientsSnapshot.docs) {
        const newIngredientRef = doc(db, 'restaurants', restaurantId, 'recipes', recipeDoc.id, 'ingredients', ingredientDoc.id);
        await setDoc(newIngredientRef, ingredientDoc.data());
        totalIngredients++;
      }
    }
    console.log(`✅ Migrated ${totalRecipes} recipes and ${totalIngredients} ingredients to ${restaurantId}`);
  } catch (error) {
    console.error(`❌ Error migrating recipes to ${restaurantId}:`, error);
  }
}
