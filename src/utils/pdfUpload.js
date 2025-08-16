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
export const uploadPdfToStorage = async (localPdfPath, fileName, restaurantId, type = 'documents') => {
  console.log('📄 Starting PDF upload process...');
  console.log('Input params:', { localPdfPath, fileName, restaurantId, type });
  
  if (!localPdfPath || !fileName || !restaurantId) {
    throw new Error('Missing required parameters for PDF upload');
  }

  // Validate file exists
  const fileInfo = await FileSystem.getInfoAsync(localPdfPath);
  console.log('📂 File info:', fileInfo);
  
  if (!fileInfo.exists) {
    throw new Error('PDF file does not exist at path: ' + localPdfPath);
  }

  // Try Firebase Storage upload first (primary method)
  console.log('☁️ Attempting Firebase Storage upload...');
  
  try {
    // For React Native/Expo, use a different approach
    // Convert the file to a Blob using the expo-file-system method
    console.log('📖 Reading file as URI...');
    
    // For React Native compatibility, we need to use fetch with the file URI
    console.log('� Converting file to blob for React Native...');
    const response = await fetch(localPdfPath);
    const blob = await response.blob();
    
    console.log('📄 File converted to blob, size:', blob.size);

    if (!blob || blob.size === 0) {
      throw new Error('Failed to convert PDF file to blob or file is empty');
    }

    // Create storage reference with restaurant-specific path
    const storagePath = `restaurants/${restaurantId}/${type}/${fileName}`;
    const fileRef = storageRef(storage, storagePath);

    console.log('📁 Uploading to Firebase Storage path:', storagePath);

    // Upload using uploadBytes with the blob
    console.log('⬆️ Starting Firebase Storage upload with blob...');
    
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

    console.log('✅ File uploaded successfully to Firebase Storage');
    console.log('Upload snapshot details:', {
      ref: snapshot.ref.fullPath,
      metadata: {
        contentType: snapshot.metadata.contentType,
        size: snapshot.metadata.size,
        timeCreated: snapshot.metadata.timeCreated
      }
    });

    // Get the download URL
    console.log('🔗 Getting Firebase Storage download URL...');
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log('🔗 Firebase Storage download URL obtained:', downloadURL);

    if (!downloadURL || downloadURL.length === 0) {
      throw new Error('Download URL is empty or invalid');
    }

    console.log('🎉 PDF upload to Firebase Storage completed successfully!');
    return downloadURL;

  } catch (firebaseError) {
    console.error('❌ Firebase Storage upload failed:', firebaseError);
    console.error('Firebase error details:', {
      message: firebaseError.message,
      code: firebaseError.code,
      stack: firebaseError.stack
    });
    
    // Fall back to local storage as last resort
    console.warn('⚠️ Firebase upload failed, falling back to local storage...');
    
    try {
      const localStorageUrl = await uploadPdfToStorageTemporary(localPdfPath, fileName, restaurantId, type);
      console.log('✅ PDF saved successfully to local storage (fallback):', localStorageUrl);
      return localStorageUrl;
    } catch (localError) {
      console.error('❌ Local storage fallback also failed:', localError);
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
  } catch (error) {
    console.error('uploadBytes method failed:', error);
    throw error;
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
export const uploadPdfToStorageTemporary = async (localPdfPath, fileName, restaurantId, type = 'documents') => {
  console.log('💾 Using local storage fallback...');
  
  try {
    // Create a structured directory for local storage
    const documentsDir = `${FileSystem.documentDirectory}chefflow/${restaurantId}/${type}/`;
    
    // Ensure directory exists
    await FileSystem.makeDirectoryAsync(documentsDir, { intermediates: true });
    
    // Copy file to structured location
    const destinationPath = `${documentsDir}${fileName}`;
    await FileSystem.copyAsync({
      from: localPdfPath,
      to: destinationPath
    });
    
    console.log('📂 PDF saved to local storage:', destinationPath);
    return destinationPath;
    
  } catch (error) {
    console.error('❌ Local storage failed:', error);
    throw new Error('Failed to save PDF to local storage: ' + error.message);
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
      await FileSystem.deleteAsync(filePath);
      console.log('🗑️ Cleaned up temporary file:', filePath);
    }
  } catch (error) {
    console.warn('⚠️ Failed to cleanup temp file:', error.message);
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
  
  let fileName = `${type}_report_${timestamp}`;
  
  // Add date range if provided
  if (startDate && endDate) {
    const startStr = startDate.toISOString().slice(0, 10);
    const endStr = endDate.toISOString().slice(0, 10);
    fileName = `${type}_report_${startStr}_to_${endStr}_${timestamp}`;
  } else if (startDate) {
    const startStr = startDate.toISOString().slice(0, 10);
    fileName = `${type}_report_${startStr}_${timestamp}`;
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
    const testRef = storageRef(storage, 'health-check/test.txt');
    console.log('✅ Firebase Storage is available');
    return true;
  } catch (error) {
    console.error('❌ Firebase Storage not available:', error);
    return false;
  }
};
