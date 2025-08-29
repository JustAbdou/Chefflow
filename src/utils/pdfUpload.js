import { storage } from '../../firebase';
import { ref as storageRef, uploadBytes, getDownloadURL, uploadString } from 'firebase/storage';
import * as FileSystem from 'expo-file-system';

/**
 * Upload a PDF file to Firebase Storage and return the download URL
 * @param {string} localPdfPath - Local file path of the PDF
 * @param {string} fileName - Name for the file in storage
 * @param {string} restaurantId - Restaurant ID for organizing files
 * @param {string} type - Type of document ('temperature' or 'invoice')
 * @returns {Promise<string>} - Download URL of the uploaded file
 */
export const uploadPdfToStorage = async (localPdfPath, fileName, restaurantId, type = 'documents') => {
  try {
    console.log('📤 Starting PDF upload to Firebase Storage...');
    console.log('Local path:', localPdfPath);
    console.log('File name:', fileName);
    console.log('Restaurant ID:', restaurantId);
    console.log('Type:', type);

    // Validate inputs
    if (!localPdfPath || !fileName || !restaurantId) {
      throw new Error('Missing required parameters for PDF upload');
    }

    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(localPdfPath);
    if (!fileInfo.exists) {
      throw new Error('PDF file does not exist at the specified path');
    }
    
    console.log('📄 File exists, size:', fileInfo.size);

    // Read the file as base64
    const fileBase64 = await FileSystem.readAsStringAsync(localPdfPath, {
      encoding: FileSystem.EncodingType.Base64,
    });

    console.log('📄 File read as base64, length:', fileBase64.length);

    if (!fileBase64 || fileBase64.length === 0) {
      throw new Error('Failed to read PDF file or file is empty');
    }

    // Create storage reference with restaurant-specific path
    const storagePath = `restaurants/${restaurantId}/${type}/${fileName}`;
    const fileRef = storageRef(storage, storagePath);

    console.log('📁 Uploading to path:', storagePath);

    // For React Native, we need to use the base64 string directly with data URI format
    const dataUri = `data:application/pdf;base64,${fileBase64}`;
    
    console.log('🔄 Converting to blob...');
    
    // Convert data URI to blob for upload
    const response = await fetch(dataUri);
    if (!response.ok) {
      throw new Error(`Failed to create blob from data URI: ${response.status}`);
    }
    
    const blob = await response.blob();
    console.log('🗂️ Blob created, size:', blob.size, 'type:', blob.type);

    if (blob.size === 0) {
      throw new Error('Blob is empty - PDF conversion failed');
    }

    console.log('☁️ Starting Firebase Storage upload...');

    // Upload the blob
    const snapshot = await uploadBytes(fileRef, blob, {
      contentType: 'application/pdf',
    });

    console.log('✅ File uploaded successfully');
    console.log('Upload snapshot:', {
      ref: snapshot.ref.fullPath,
      metadata: {
        contentType: snapshot.metadata.contentType,
        size: snapshot.metadata.size,
        timeCreated: snapshot.metadata.timeCreated
      }
    });

    // Get the download URL
    console.log('🔗 Getting download URL...');
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log('🔗 Download URL obtained:', downloadURL);

    return downloadURL;
  } catch (error) {
    console.error('❌ Error uploading PDF to Firebase Storage:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack,
      serverResponse: error.serverResponse
    });
    
    // Provide more specific error messages based on error type
    if (error.code === 'storage/unauthorized') {
      throw new Error('Upload failed: Insufficient permissions to access Firebase Storage');
    } else if (error.code === 'storage/canceled') {
      throw new Error('Upload was canceled');
    } else if (error.code === 'storage/unknown') {
      throw new Error('Upload failed: Firebase Storage error - check internet connection and Firebase configuration');
    } else if (error.code === 'storage/invalid-format') {
      throw new Error('Upload failed: Invalid file format');
    } else if (error.code === 'storage/quota-exceeded') {
      throw new Error('Upload failed: Storage quota exceeded');
    } else {
      throw new Error('Failed to upload PDF to cloud storage: ' + error.message);
    }
  }
};

/**
 * Temporary solution: Save PDF locally and return a placeholder URL
 * This avoids Firebase Storage upload issues while maintaining functionality
 * @param {string} localPdfPath - Local file path of the PDF
 * @param {string} fileName - Name for the file in storage
 * @param {string} restaurantId - Restaurant ID for organizing files
 * @param {string} type - Type of document ('temperature' or 'invoice')
 * @returns {Promise<string>} - Local file path (temporary solution)
 */
export const uploadPdfToStorageTemporary = async (localPdfPath, fileName, restaurantId, type = 'documents') => {
  try {
    console.log('📤 Using temporary PDF storage solution...');
    console.log('Local path:', localPdfPath);
    console.log('File name:', fileName);

    // Validate inputs
    if (!localPdfPath || !fileName || !restaurantId) {
      throw new Error('Missing required parameters for PDF upload');
    }

    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(localPdfPath);
    if (!fileInfo.exists) {
      throw new Error('PDF file does not exist at the specified path');
    }
    
    console.log('📄 File exists, size:', fileInfo.size);

    // Create a permanent location for the PDF in the app's document directory
    const permanentPath = FileSystem.documentDirectory + 'pdfs/' + fileName;
    
    // Create pdfs directory if it doesn't exist
    const pdfDir = FileSystem.documentDirectory + 'pdfs/';
    const dirInfo = await FileSystem.getInfoAsync(pdfDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(pdfDir, { intermediates: true });
      console.log('� Created PDFs directory');
    }

    // Copy the file to a permanent location
    await FileSystem.copyAsync({
      from: localPdfPath,
      to: permanentPath,
    });

    console.log('📄 PDF saved to permanent location:', permanentPath);

    // Return the permanent path (temporary solution until Firebase Storage is fixed)
    return permanentPath;
  } catch (error) {
    console.error('❌ Error saving PDF (temporary method):', error);
    throw new Error('Failed to save PDF: ' + error.message);
  }
};

/**
 * Generate a unique filename for the PDF
 * @param {string} type - Type of document ('temperature' or 'invoice')
 * @param {Date} startDate - Start date for the report
 * @param {Date} endDate - End date for the report
 * @returns {string} - Unique filename
 */
export const generatePdfFileName = (type, startDate, endDate) => {
  const formatDate = (date) => {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  };
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const start = formatDate(startDate);
  const end = formatDate(endDate);
  
  return `${type}_${start}_to_${end}_${timestamp}.pdf`;
};

/**
 * Test Firebase Storage connectivity by uploading a small test file
 * @param {string} restaurantId - Restaurant ID for organizing files
 * @returns {Promise<string>} - Test result message
 */
export const testStorageConnection = async (restaurantId) => {
  try {
    console.log('🧪 Testing Firebase Storage connection...');
    
    // Create a simple test file
    const testContent = 'This is a test file for Firebase Storage connectivity';
    const testFileName = `test_${Date.now()}.txt`;
    const testPath = `restaurants/${restaurantId}/test/${testFileName}`;
    
    console.log('📝 Creating test file...');
    
    // Create a blob from text
    const blob = new Blob([testContent], { type: 'text/plain' });
    const fileRef = storageRef(storage, testPath);
    
    console.log('☁️ Uploading test file to:', testPath);
    
    // Upload the test file
    const snapshot = await uploadBytes(fileRef, blob);
    console.log('✅ Test file uploaded successfully');
    
    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log('🔗 Test file download URL:', downloadURL);
    
    return 'Firebase Storage connection test successful!';
  } catch (error) {
    console.error('❌ Firebase Storage connection test failed:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
};
