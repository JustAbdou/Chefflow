import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, enableNetwork } from 'firebase/firestore';
import { db } from '../../firebase';
import { normalizeRestaurantName, RESTAURANT_NAMES, getRestaurantDisplayName } from '../utils/restaurantUtils';

const RestaurantContext = createContext();

export const useRestaurant = () => {
  const context = useContext(RestaurantContext);
  if (!context) {
    throw new Error('useRestaurant must be used within a RestaurantProvider');
  }
  return context;
};

export const RestaurantProvider = ({ children }) => {
  const [restaurantId, setRestaurantId] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      console.log('Current user information:', currentUser);
      if (currentUser) {
        try {
          await enableNetwork(db);

          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);

          console.log('Fetched user document:', userDoc.data());

          if (userDoc.exists()) {
            console.log('User information:', userDoc.data());
            const fetchedRestaurantId = userDoc.data().restaurantId;
            console.log('Fetched restaurantId:', fetchedRestaurantId);

            const restaurantDocRef = doc(db, 'restaurants', fetchedRestaurantId);
            const restaurantDoc = await getDoc(restaurantDocRef);

            if (restaurantDoc.exists()) {
              setRestaurantId(fetchedRestaurantId);
              console.log(`User logged into restaurant: ${fetchedRestaurantId}`);
            } else {
              console.error('Restaurant ID does not exist.');
              setRestaurantId(null);
            }
          } else {
            console.warn('No restaurant ID found for the user.');
            setRestaurantId(null);
          }
        } catch (error) {
          console.error('Error verifying restaurant ID:', error);
          setRestaurantId(null);
        }
      } else {
        setRestaurantId(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    restaurantId,
    restaurantDisplayName: restaurantId ? getRestaurantDisplayName(restaurantId) : null,
    user,
    loading,
    setRestaurantId, // Allow manual setting if needed
    availableRestaurants: RESTAURANT_NAMES, // Available restaurant options
    normalizeRestaurantName, // Utility function for custom names
  };

  console.log('Current Restaurant ID:', restaurantId);

  const changeRestaurantId = (newId) => {
    console.log('Changing restaurant ID to:', newId);
    setRestaurantId(newId);
  };

  global.changeRestaurantId = changeRestaurantId;

  return (
    <RestaurantContext.Provider value={value}>
      {children}
    </RestaurantContext.Provider>
  );
};
