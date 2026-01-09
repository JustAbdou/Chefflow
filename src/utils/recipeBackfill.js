import { getDocs, updateDoc, query, where } from 'firebase/firestore';
import { getRestaurantSubCollection, getRestaurantSubDoc } from './firestoreHelpers';
import { fetchAllCategories } from './categoryHelpers';

/**
 * Backfill restaurantId field to existing recipe documents
 * This is a one-time migration utility
 */
export const backfillRecipeRestaurantIds = async (restaurantId) => {
  if (!restaurantId) {
    console.error('❌ Restaurant ID is required for backfill');
    return { success: false, error: 'Restaurant ID required' };
  }

  try {
    console.log(`🔄 Starting restaurantId backfill for restaurant: ${restaurantId}`);
    
    // Get all categories
    const allCategories = await fetchAllCategories(restaurantId);
    console.log(`📦 Found ${allCategories.length} categories to process`);
    
    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    const errors = [];
    
    // Process each category
    for (const categoryInfo of allCategories) {
      const categoryName = categoryInfo.name;
      
      try {
        // Get all recipes in this category
        const categoryCollectionRef = getRestaurantSubCollection(
          restaurantId, 
          "recipes", 
          "categories", 
          categoryName
        );
        
        // Get all recipes (can't query for missing fields directly)
        const snapshot = await getDocs(categoryCollectionRef);
        const recipesWithoutRestaurantId = snapshot.docs.filter(doc => {
          const data = doc.data();
          return !data.restaurantId || data.restaurantId !== restaurantId;
        });
        
        console.log(`📝 Category "${categoryName}": ${recipesWithoutRestaurantId.length} recipes need restaurantId`);
        
        // Update each recipe
        for (const recipeDoc of recipesWithoutRestaurantId) {
          try {
            const recipeRef = getRestaurantSubDoc(
              restaurantId,
              "recipes",
              "categories",
              categoryName,
              recipeDoc.id
            );
            
            await updateDoc(recipeRef, {
              restaurantId: restaurantId
            });
            
            totalUpdated++;
          } catch (updateError) {
            console.error(`❌ Error updating recipe ${recipeDoc.id}:`, updateError);
            errors.push({ recipeId: recipeDoc.id, category: categoryName, error: updateError.message });
          }
        }
        
        totalProcessed += snapshot.docs.length;
        totalSkipped += (snapshot.docs.length - recipesWithoutRestaurantId.length);
        
      } catch (categoryError) {
        console.error(`❌ Error processing category ${categoryName}:`, categoryError);
        errors.push({ category: categoryName, error: categoryError.message });
      }
    }
    
    console.log(`✅ Backfill complete:`);
    console.log(`   - Total recipes processed: ${totalProcessed}`);
    console.log(`   - Updated: ${totalUpdated}`);
    console.log(`   - Already had restaurantId: ${totalSkipped}`);
    console.log(`   - Errors: ${errors.length}`);
    
    return {
      success: true,
      totalProcessed,
      totalUpdated,
      totalSkipped,
      errors: errors.length > 0 ? errors : undefined
    };
    
  } catch (error) {
    console.error('❌ Error during backfill:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Check if backfill is needed (count recipes without restaurantId)
 */
export const checkBackfillNeeded = async (restaurantId) => {
  if (!restaurantId) return { needed: false, count: 0 };
  
  try {
    const allCategories = await fetchAllCategories(restaurantId);
    let totalNeedingBackfill = 0;
    
    for (const categoryInfo of allCategories) {
      const categoryName = categoryInfo.name;
      const categoryCollectionRef = getRestaurantSubCollection(
        restaurantId,
        "recipes",
        "categories",
        categoryName
      );
      
      const snapshot = await getDocs(categoryCollectionRef);
      const needingBackfill = snapshot.docs.filter(doc => {
        const data = doc.data();
        return !data.restaurantId || data.restaurantId !== restaurantId;
      });
      
      totalNeedingBackfill += needingBackfill.length;
    }
    
    return {
      needed: totalNeedingBackfill > 0,
      count: totalNeedingBackfill
    };
  } catch (error) {
    console.error('❌ Error checking backfill status:', error);
    return { needed: false, count: 0, error: error.message };
  }
};

