import { collection, doc } from 'firebase/firestore';
import { db } from '../../firebase';

/**
 * Get a collection reference for a specific restaurant
 * @param {string} restaurantId - The restaurant ID
 * @param {string} collectionName - The collection name
 * @returns {CollectionReference}
 */
export const getRestaurantCollection = (restaurantId, collectionName) => {
  if (!restaurantId) {
    throw new Error('Restaurant ID is required');
  }
  return collection(db, 'restaurants', restaurantId, collectionName);
};

/**
 * Get a document reference for a specific restaurant collection
 * @param {string} restaurantId - The restaurant ID
 * @param {string} collectionName - The collection name
 * @param {string} docId - The document ID
 * @returns {DocumentReference}
 */
export const getRestaurantDoc = (restaurantId, collectionName, docId) => {
  if (!restaurantId) {
    throw new Error('Restaurant ID is required');
  }
  return doc(db, 'restaurants', restaurantId, collectionName, docId);
};

/**
 * Get a nested collection reference for a specific restaurant
 * @param {string} restaurantId - The restaurant ID
 * @param {string} collectionName - The parent collection name
 * @param {string} docId - The parent document ID
 * @param {string} subCollectionName - The subcollection name
 * @returns {CollectionReference}
 */
export const getRestaurantSubCollection = (restaurantId, collectionName, docId, subCollectionName) => {
  if (!restaurantId) {
    throw new Error('Restaurant ID is required');
  }
  return collection(db, 'restaurants', restaurantId, collectionName, docId, subCollectionName);
};

/**
 * Get a nested document reference for a specific restaurant
 * @param {string} restaurantId - The Restaurant ID
 * @param {string} collectionName - The parent collection name
 * @param {string} docId - The parent document ID
 * @param {string} subCollectionName - The subcollection name
 * @param {string} subDocId - The subcollection document ID
 * @returns {DocumentReference}
 */
export const getRestaurantSubDoc = (restaurantId, collectionName, docId, subCollectionName, subDocId) => {
  if (!restaurantId) {
    throw new Error('Restaurant ID is required');
  }
  return doc(db, 'restaurants', restaurantId, collectionName, docId, subCollectionName, subDocId);
};

/**
 * Get a deeply nested collection reference for a specific restaurant
 * @param {string} restaurantId - The restaurant ID
 * @param {...string} pathSegments - The path segments (collection, doc, collection, doc, etc.)
 * @returns {CollectionReference}
 */
export const getRestaurantNestedCollection = (restaurantId, ...pathSegments) => {
  if (!restaurantId) {
    throw new Error('Restaurant ID is required');
  }
  const fullPath = ['restaurants', restaurantId, ...pathSegments];
  return collection(db, ...fullPath);
};

/**
 * Get a deeply nested document reference for a specific restaurant
 * @param {string} restaurantId - The restaurant ID
 * @param {...string} pathSegments - The path segments (collection, doc, collection, doc, etc.)
 * @returns {DocumentReference}
 */
export const getRestaurantNestedDoc = (restaurantId, ...pathSegments) => {
  if (!restaurantId) {
    throw new Error('Restaurant ID is required');
  }
  const fullPath = ['restaurants', restaurantId, ...pathSegments];
  return doc(db, ...fullPath);
};
