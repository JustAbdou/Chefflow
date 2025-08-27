/**
 * Utility functions for seeding sample data in Firestore
 */

import { doc, setDoc } from 'firebase/firestore';
import { getRestaurantDoc } from './firestoreHelpers';

/**
 * Seed suppliers data for a restaurant
 * @param {string} restaurantId - The restaurant ID
 */
export async function seedSuppliers(restaurantId) {const sampleSuppliers = [
    "Fresh Foods Co.",
    "Prime Meat Supply",
    "Ocean Fresh Seafood",
    "Garden Vegetables Ltd",
    "Daily Dairy Products",
    "Global Spices Inc",
    "Baker's Best Bakery",
    "Beverage Distributors",
    "Restaurant Supply Co.",
    "Chef's Choice Imports"
  ];
  
  try {
    const suppliersDocRef = getRestaurantDoc(restaurantId, "suppliers", "suppliers");

    await setDoc(suppliersDocRef, {
      array: sampleSuppliers,
      updatedAt: new Date(),
      createdAt: new Date()
    });return true;
  } catch (error) {return false;
  }
}

/**
 * Seed fridge names for a restaurant
 * @param {string} restaurantId - The restaurant ID
 */
export async function seedFridges(restaurantId) {const sampleFridges = [
    "Walk-in Fridge",
    "Prep Fridge",
    "Dessert Fridge",
    "Beverage Cooler"
  ];
  
  try {
    const fridgesDocRef = getRestaurantDoc(restaurantId, "fridges", "fridges");

    await setDoc(fridgesDocRef, {
      array: sampleFridges,
      updatedAt: new Date(),
      createdAt: new Date()
    });return true;
  } catch (error) {return false;
  }
}

/**
 * Seed all sample data for a restaurant
 * @param {string} restaurantId - The restaurant ID
 */
export async function seedAllData(restaurantId) {try {
    await seedSuppliers(restaurantId);

    await seedFridges(restaurantId);return true;
  } catch (error) {return false;
  }
}
