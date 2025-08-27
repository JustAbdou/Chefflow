import { storage } from '../../firebase';
import { ref as storageRef, uploadString, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as FileSystem from 'expo-file-system';

/**
 * Upload PDF to Firebase Storage with React Native compatibility
 * This function prioritizes Firebase Storage upload and falls back to local storage if needed
 * 
 * @param {string} localPdfPath - Path to the PDF file on device
 * @param {string} fileName - Name for the uploaded file
 * @param {string} restaurantId - Restaurant ID for folder organization
 * @param {string} type - Document type (handover, temperature, invoice, etc.)
 * @returns {Promise<string>} - Firebase Storage download URL or local file path
 */
export const uploadPdfToStorage = async (localPdfPath, fileName, restaurantId, type = 'documents') => {if (!localPdfPath || !fileName || !restaurantId) {
    throw new Error('Missing required parameters for PDF upload');
  }

  // Validate file exists
  const fileInfo = await FileSystem.getInfoAsync(localPdfPath);
if (!fileInfo.exists) {
    throw new Error('PDF file does not exist at path: ' + localPdfPath);
  }

  // Try Firebase Storage upload first (primary method)
  try {
    // For React Native/Expo, use a different approach
    // Convert the file to a Blob using the expo-file-system method
    // For React Native compatibility, we need to use fetch with the file URI
    const response = await fetch(localPdfPath);

    const blob = await response.blob();
    if (!blob || blob.size === 0) {
      throw new Error('Failed to convert PDF file to blob or file is empty');
    }

    // Create storage reference with restaurant-specific path
    const storagePath = `restaurants/${restaurantId}/${type}/${fileName}`;

    const fileRef = storageRef(storage, storagePath);
    
    // Upload using uploadBytes with the blob
    const snapshot = await uploadBytes(fileRef, blob, {
      contentType: 'application/pdf',
      customMetadata: {
        'originalName': fileName,
        'uploadedBy': 'ChefFlow',
        'restaurantId': restaurantId,
        'documentType': type,
        'uploadTimestamp': new Date().toISOString()
      }
    });
    
    // Get the download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    if (!downloadURL || downloadURL.length === 0) {
      throw new Error('Download URL is empty or invalid');
    }
    return downloadURL;

  } catch (firebaseError) {
    // Fall back to local storage as last resort
    try {
      const localStorageUrl = await uploadPdfToStorageTemporary(localPdfPath, fileName, restaurantId, type);
      return localStorageUrl;
    } catch (localError) {
      throw new Error(`Both Firebase Storage and local storage failed. Firebase: ${firebaseError.message}, Local: ${localError.message}`);
    }
  }
};

/**
 * Alternative Firebase upload method using uploadBytes (for troubleshooting)
 * Currently not used but kept for reference
 */
export const uploadPdfToStorageWithBytes = async (localPdfPath, fileName, restaurantId, type = 'documents') => {
  try {
    // Read file as Uint8Array
    const fileData = await FileSystem.readAsStringAsync(localPdfPath, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    // Convert base64 to Uint8Array
    const binaryString = atob(fileData);

    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const storagePath = `restaurants/${restaurantId}/${type}/${fileName}`;

    const fileRef = storageRef(storage, storagePath);

    
    const snapshot = await uploadBytes(fileRef, bytes, {
      contentType: 'application/pdf'
    });
    
    return await getDownloadURL(snapshot.ref);
  } catch (error) {throw error;
  }
};

/**
 * Local storage fallback solution: Save PDF locally and return a file path
 * This is used when Firebase Storage upload fails
 * 
 * @param {string} localPdfPath - Path to the source PDF file
 * @param {string} fileName - Name for the stored file
 * @param {string} restaurantId - Restaurant ID for folder organization
 * @param {string} type - Document type
 * @returns {Promise<string>} - Local file path
 */
export const uploadPdfToStorageTemporary = async (localPdfPath, fileName, restaurantId, type = 'documents') => {try {
    // Create a structured directory for local storage
    const documentsDir = `${FileSystem.documentDirectory}
    chefflow/${restaurantId}/${type}/`;
    
    // Ensure directory exists
    await FileSystem.makeDirectoryAsync(documentsDir, { intermediates: true });
    
    // Copy file to structured location
    const destinationPath = `${documentsDir}${fileName}`;

    await FileSystem.copyAsync({
      from: localPdfPath,
      to: destinationPath
    });return destinationPath;
    
  } catch (error) {throw new Error('Failed to save PDF to local storage: ' + error.message);
  }
};

/**
 * Helper function to clean up temporary files
 * Call this after successful upload to free up storage space
 */
export const cleanupTempFile = async (filePath) => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(filePath);

    if (fileInfo.exists) {
      await FileSystem.deleteAsync(filePath);}
  } catch (error) {
      // Error handling
    }
};

/**
 * Generate a standardized PDF filename with timestamp and date range
 * @param {string} type - Document type (handover, invoice, temperature, etc.)
 * @param {Date} startDate - Start date for the report (optional)
 * @param {Date} endDate - End date for the report (optional)
 * @returns {string} - Formatted filename with .pdf extension
 */
export const generatePdfFileName = (type, startDate = null, endDate = null) => {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');

  
  let fileName = `${type}
    _report_${timestamp}`;
  
  // Add date range if provided
  if (startDate && endDate) {
    const startStr = startDate.toISOString().slice(0, 10);

    const endStr = endDate.toISOString().slice(0, 10);
    fileName = `${type}
    _report_${startStr}
    _to_${endStr}
    _${timestamp}`;
  } else if (startDate) {
    const startStr = startDate.toISOString().slice(0, 10);
    fileName = `${type}
    _report_${startStr}
    _${timestamp}`;
  }
  
  return `${fileName}.pdf`;
};

/**
 * Check if Firebase Storage is available and properly configured
 * @returns {boolean} - True if Firebase Storage is ready
 */
export const checkFirebaseStorageHealth = async () => {
  try {
    // Try to create a reference - this will fail if Firebase isn't configured
    const testRef = storageRef(storage, 'health-check/test.txt');return true;
  } catch (error) {return false;
  }
};
