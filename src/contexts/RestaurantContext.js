import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, enableNetwork } from 'firebase/firestore';
import { db } from '../../firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeRestaurantName, RESTAURANT_NAMES, getRestaurantDisplayName } from '../utils/restaurantUtils';
import { preloadRecipesForRestaurant } from '../utils/offlineSync';
import { clearRecipeCache } from '../utils/recipeCache';

const CURRENT_RESTAURANT_ID_KEY = 'currentRestaurantId';

const RestaurantContext = createContext();

export const useRestaurant = () => {
  const context = useContext(RestaurantContext);
  if (!context) {
    throw new Error('useRestaurant must be used within a RestaurantProvider');
  }
  return context;
};

export const RestaurantProvider = ({ children }) => {
  const [activeRestaurantId, setActiveRestaurantId] = useState(null);
  const [primaryRestaurantId, setPrimaryRestaurantId] = useState(null);
  const [allowedRestaurantIds, setAllowedRestaurantIds] = useState([]);
  const [availableRestaurants, setAvailableRestaurants] = useState([]); // [{ id, name }]
  const [restaurantMetadata, setRestaurantMetadata] = useState({}); // { restaurantId: { name: string } }
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Helper to fetch restaurant metadata (name)
  const fetchRestaurantMetadata = async (restaurantIds) => {
    const metadata = {};
    for (const id of restaurantIds) {
      try {
        const restaurantDocRef = doc(db, 'restaurants', id);
        const restaurantDoc = await getDoc(restaurantDocRef);
        if (restaurantDoc.exists()) {
          const data = restaurantDoc.data();
          metadata[id] = {
            name: data.name || data.restaurantName || id,
          };
        } else {
          metadata[id] = { name: id }; // Fallback to ID if doc doesn't exist
        }
      } catch (error) {
        console.warn(`Failed to fetch metadata for restaurant ${id}:`, error);
        metadata[id] = { name: id };
      }
    }
    return metadata;
  };

  // Initialize restaurant context on login
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      console.log('Current user information:', currentUser);
      if (currentUser) {
        try {
          // Ensure Firestore network is enabled
          await enableNetwork(db);

          // Step 1: Fetch the user's default restaurantId from Firestore
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (!userDoc.exists()) {
            console.warn('No user document found.');
            setActiveRestaurantId(null);
            setAllowedRestaurantIds([]);
            setLoading(false);
            return;
          }

          const userData = userDoc.data();
          const primaryId = userData.restaurantId;
          setPrimaryRestaurantId(primaryId);
          console.log('Fetched primary restaurantId:', primaryId);

          // Step 2: Get allowed restaurant IDs from users/{uid}.restaurantIds
          // Fallback to [primaryRestaurantId] if restaurantIds is missing/empty
          let userRestaurantIds = userData.restaurantIds;
          if (!Array.isArray(userRestaurantIds) || userRestaurantIds.length === 0) {
            userRestaurantIds = primaryId ? [primaryId] : [];
            console.log('No restaurantIds array found, using primary restaurantId');
          } else {
            console.log('Fetched restaurantIds array:', userRestaurantIds);
          }

          // Step 3: Build allowedRestaurantIds ensuring primaryRestaurantId is included
          const combinedIds = primaryId 
            ? [primaryId, ...userRestaurantIds]
            : userRestaurantIds;
          const uniqueIds = [...new Set(combinedIds.filter(Boolean))]; // Remove null/undefined and dedupe
          setAllowedRestaurantIds(uniqueIds);
          console.log('Allowed restaurant IDs:', uniqueIds);

          if (uniqueIds.length === 0) {
            console.warn('No restaurant IDs available for the user.');
            setActiveRestaurantId(null);
            setAllowedRestaurantIds([]);
            setAvailableRestaurants([]);
            setLoading(false);
            return;
          }

          // Step 4: Fetch restaurant metadata for UI and build availableRestaurants
          const metadata = await fetchRestaurantMetadata(uniqueIds);
          setRestaurantMetadata(metadata);
          
          // Build availableRestaurants array: [{ id, name }]
          const restaurants = uniqueIds.map(id => ({
            id,
            name: metadata[id]?.name || id
          }));
          setAvailableRestaurants(restaurants);
          console.log('Available restaurants:', restaurants);

          // Step 5: Read AsyncStorage for active restaurant
          let selectedRestaurantId = primaryId;
          try {
            const savedRestaurantId = await AsyncStorage.getItem(CURRENT_RESTAURANT_ID_KEY);
            if (savedRestaurantId && uniqueIds.includes(savedRestaurantId)) {
              selectedRestaurantId = savedRestaurantId;
              console.log('Using saved restaurant ID from AsyncStorage:', selectedRestaurantId);
            } else {
              if (savedRestaurantId) {
                console.log('Saved restaurant ID is not in allowed list, using primary');
                // Overwrite AsyncStorage with primary
                if (primaryId) {
                  await AsyncStorage.setItem(CURRENT_RESTAURANT_ID_KEY, primaryId);
                }
              }
              console.log('Using primary restaurant ID:', selectedRestaurantId);
            }
          } catch (error) {
            console.warn('Error reading AsyncStorage, using primary:', error);
          }

          // Step 6: Verify restaurant exists and set active
          const restaurantDocRef = doc(db, 'restaurants', selectedRestaurantId);
          const restaurantDoc = await getDoc(restaurantDocRef);

          if (restaurantDoc.exists()) {
            setActiveRestaurantId(selectedRestaurantId);
            console.log(`User logged into restaurant: ${selectedRestaurantId}`);
            
            // Persist to AsyncStorage
            try {
              await AsyncStorage.setItem(CURRENT_RESTAURANT_ID_KEY, selectedRestaurantId);
            } catch (error) {
              console.warn('Error saving active restaurant to AsyncStorage:', error);
            }
            
            // Start background recipe preloading
            console.log('📚 Starting background recipe preload...');
            preloadRecipesForRestaurant(selectedRestaurantId)
              .then((result) => {
                if (result?.success) {
                  console.log(`📚 Recipe preload completed: ${result.totalRecipes} recipes in ${result.categories} categories`);
                } else {
                  console.log('📚 Recipe preload skipped or failed:', result?.error || 'Unknown reason');
                }
              })
              .catch((error) => {
                console.error('📚 Recipe preload error:', error);
              });
          } else {
            console.error('Restaurant ID does not exist.');
            setActiveRestaurantId(null);
          }
        } catch (error) {
          console.error('Error verifying restaurant ID:', error);
          setActiveRestaurantId(null);
        }
      } else {
        setActiveRestaurantId(null);
        setPrimaryRestaurantId(null);
        setAllowedRestaurantIds([]);
        setAvailableRestaurants([]);
        setRestaurantMetadata({});
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Function to switch restaurants
  const switchRestaurant = async (newRestaurantId) => {
    if (!allowedRestaurantIds.includes(newRestaurantId)) {
      console.error('Cannot switch to restaurant that is not in allowed list');
      return;
    }

    try {
      // Clear recipe cache when switching (since cache is now restaurant-aware)
      await clearRecipeCache();
      
      // Update state
      setActiveRestaurantId(newRestaurantId);
      
      // Persist to AsyncStorage
      await AsyncStorage.setItem(CURRENT_RESTAURANT_ID_KEY, newRestaurantId);
      console.log(`Switched to restaurant: ${newRestaurantId}`);
      
      // Preload recipes for new restaurant
      preloadRecipesForRestaurant(newRestaurantId)
        .then((result) => {
          if (result?.success) {
            console.log(`📚 Recipe preload completed for ${newRestaurantId}: ${result.totalRecipes} recipes`);
          }
        })
        .catch((error) => {
          console.error('📚 Recipe preload error:', error);
        });
    } catch (error) {
      console.error('Error switching restaurant:', error);
    }
  };

  // For backwards compatibility: restaurantId is an alias for activeRestaurantId
  const restaurantId = activeRestaurantId;

  const value = {
    // Primary API
    activeRestaurantId,
    primaryRestaurantId,
    allowedRestaurantIds,
    availableRestaurants, // [{ id, name }]
    restaurantMetadata,
    switchRestaurant,
    
    // Backwards compatibility
    restaurantId, // Alias for activeRestaurantId
    restaurantDisplayName: restaurantId ? getRestaurantDisplayName(restaurantId) : null,
    user,
    loading,
    setRestaurantId: switchRestaurant, // Alias for switchRestaurant for backwards compatibility
    
    // Legacy (kept for compatibility)
    normalizeRestaurantName,
  };

  // Console log for debugging
  console.log('Current Active Restaurant ID:', activeRestaurantId);
  console.log('Allowed Restaurant IDs:', allowedRestaurantIds);

  // Helper function to manually set restaurant ID (for testing)
  const changeRestaurantId = (newId) => {
    console.log('Changing restaurant ID to:', newId);
    switchRestaurant(newId);
  };

  // Make changeRestaurantId available globally for testing
  global.changeRestaurantId = changeRestaurantId;

  return (
    <RestaurantContext.Provider value={value}>
      {children}
    </RestaurantContext.Provider>
  );
};
