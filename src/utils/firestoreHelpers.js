import { collection, doc } from 'firebase/firestore';
import { db } from '../../firebase';


export const getRestaurantCollection = (restaurantId, collectionName) => {
  if (!restaurantId) {
    throw new Error('Restaurant ID is required');
  }
  return collection(db, 'restaurants', restaurantId, collectionName);
};


export const getRestaurantDoc = (restaurantId, collectionName, docId) => {
  if (!restaurantId) {
    throw new Error('Restaurant ID is required');
  }
  return doc(db, 'restaurants', restaurantId, collectionName, docId);
};


export const getRestaurantSubCollection = (restaurantId, collectionName, docId, subCollectionName) => {
  if (!restaurantId) {
    throw new Error('Restaurant ID is required');
  }
  return collection(db, 'restaurants', restaurantId, collectionName, docId, subCollectionName);
};


export const getRestaurantSubDoc = (restaurantId, collectionName, docId, subCollectionName, subDocId) => {
  if (!restaurantId) {
    throw new Error('Restaurant ID is required');
  }
  return doc(db, 'restaurants', restaurantId, collectionName, docId, subCollectionName, subDocId);
};


export const getRestaurantNestedCollection = (restaurantId, ...pathSegments) => {
  if (!restaurantId) {
    throw new Error('Restaurant ID is required');
  }
  const fullPath = ['restaurants', restaurantId, ...pathSegments];
  return collection(db, ...fullPath);
};


export const getRestaurantNestedDoc = (restaurantId, ...pathSegments) => {
  if (!restaurantId) {
    throw new Error('Restaurant ID is required');
  }
  const fullPath = ['restaurants', restaurantId, ...pathSegments];
  return doc(db, ...fullPath);
};
