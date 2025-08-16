/**
 * Utility functions for seeding sample data in Firestore
 */

import { doc, setDoc } from 'firebase/firestore';
import { getRestaurantDoc } from './firestoreHelpers';

/**
 * Seed suppliers data for a restaurant
 * @param {string} restaurantId - The restaurant ID
 */
export async function seedSuppliers(restaurantId) {
  console.log(`Seeding suppliers for restaurant: ${restaurantId}`);
  
  const sampleSuppliers = [
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
    });
    
    console.log(`✅ Successfully seeded ${sampleSuppliers.length} suppliers`);
    return true;
  } catch (error) {
    console.error("❌ Error seeding suppliers:", error);
    return false;
  }
}

/**
 * Seed fridge names for a restaurant
 * @param {string} restaurantId - The restaurant ID
 */
export async function seedFridges(restaurantId) {
  console.log(`Seeding fridges for restaurant: ${restaurantId}`);
  
  const sampleFridges = [
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
    });
    
    console.log(`✅ Successfully seeded ${sampleFridges.length} fridges`);
    return true;
  } catch (error) {
    console.error("❌ Error seeding fridges:", error);
    return false;
  }
}

/**
 * Seed all sample data for a restaurant
 * @param {string} restaurantId - The restaurant ID
 */
export async function seedAllData(restaurantId) {
  console.log(`🌱 Seeding all sample data for restaurant: ${restaurantId}`);
  
  try {
    await seedSuppliers(restaurantId);
    await seedFridges(restaurantId);
    
    console.log("✅ All sample data seeded successfully!");
    return true;
  } catch (error) {
    console.error("❌ Error seeding sample data:", error);
    return false;
  }
}
