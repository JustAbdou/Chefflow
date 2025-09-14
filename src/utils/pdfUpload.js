import { storage } from '../../firebase';
import { ref as storageRef, uploadBytes, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import * as FileSystem from 'expo-file-system';

/**
 * Upload a PDF file to Firebase Storage and return the download URL
 * @param {string} localPdfPath - Local file path of the PDF
 * @param {string} fileName - Name for the file in storage
 * @param {string} restaurantId - Restaurant ID for organizing files
 * @param {string} type - Type of document ('temperature', 'invoices', 'handovers', etc.)
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

    // Create storage reference with restaurant-specific path
    const storagePath = `restaurants/${restaurantId}/${type}/${fileName}`;
    const fileRef = storageRef(storage, storagePath);

    console.log('📁 Uploading to path:', storagePath);

    // Read the file as bytes using expo-file-system URI
    console.log('📄 Reading file as binary...');
    const fileUri = localPdfPath;
    
    // Use fetch to get the file as a blob directly from the file URI
    const response = await fetch(fileUri);
    if (!response.ok) {
      throw new Error(`Failed to read file: ${response.status} ${response.statusText}`);
    }
    
    const fileBlob = await response.blob();
    console.log('🗂️ File blob created, size:', fileBlob.size, 'type:', fileBlob.type);

    if (fileBlob.size === 0) {
      throw new Error('File is empty or could not be read');
    }

    // Ensure correct content type for PDF
    const metadata = {
      contentType: 'application/pdf',
      customMetadata: {
        restaurantId: restaurantId,
        type: type,
        uploadedAt: new Date().toISOString()
      }
    };

    console.log('☁️ Starting Firebase Storage upload...');

    // Use uploadBytesResumable for better progress tracking and error handling
    const uploadTask = uploadBytesResumable(fileRef, fileBlob, metadata);

    // Return a promise that resolves when upload completes
    const snapshot = await new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // Progress tracking
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log(`⏳ Upload progress: ${progress.toFixed(1)}%`);
        },
        (error) => {
          // Handle upload errors
          console.error('❌ Upload failed:', error);
          reject(error);
        },
        () => {
          // Upload completed successfully
          console.log('✅ Upload completed successfully');
          resolve(uploadTask.snapshot);
        }
      );
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
      stack: error.stack
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
    } else if (error.code === 'storage/retry-limit-exceeded') {
      throw new Error('Upload failed: Maximum retry attempts exceeded - check your network connection');
    } else if (error.message && error.message.includes('Network request failed')) {
      throw new Error('Upload failed: Network connection error - please check your internet connection');
    } else {
      throw new Error('Failed to upload PDF to cloud storage: ' + error.message);
    }
  }
};

/**
 * Enhanced local storage: Save PDF locally and return a local URL
 * This provides a robust fallback when Firebase Storage is unavailable
 * @param {string} localPdfPath - Local file path of the PDF
 * @param {string} fileName - Name for the file in storage
 * @param {string} restaurantId - Restaurant ID for organizing files
 * @param {string} type - Type of document ('temperature', 'invoices', 'handovers', etc.)
 * @returns {Promise<string>} - Local file path
 */
export const uploadPdfToStorageTemporary = async (localPdfPath, fileName, restaurantId, type = 'documents') => {
  try {
    console.log('📤 Using local PDF storage solution...');
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

    // Create organized directory structure: /restaurant_id/type/
    const baseDir = FileSystem.documentDirectory + 'chefflow_pdfs/';
    const restaurantDir = baseDir + restaurantId + '/';
    const typeDir = restaurantDir + type + '/';
    
    // Create directory structure if it doesn't exist
    await FileSystem.makeDirectoryAsync(typeDir, { intermediates: true });
    console.log('📁 Created directory structure:', typeDir);

    // Create the permanent location for the PDF
    const permanentPath = typeDir + fileName;

    // Copy the file to the permanent location
    await FileSystem.copyAsync({
      from: localPdfPath,
      to: permanentPath,
    });

    console.log('📄 PDF saved to permanent location:', permanentPath);

    // Return the permanent path
    return permanentPath;
  } catch (error) {
    console.error('❌ Error saving PDF (local storage method):', error);
    throw new Error('Failed to save PDF locally: ' + error.message);
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

/**
 * List all locally stored PDFs for a restaurant and type
 * @param {string} restaurantId - Restaurant ID
 * @param {string} type - Type of document ('temperature', 'invoices', 'handovers', etc.)
 * @returns {Promise<Array>} - Array of local PDF file info
 */
export const listLocalPdfs = async (restaurantId, type = 'documents') => {
  try {
    const typeDir = FileSystem.documentDirectory + `chefflow_pdfs/${restaurantId}/${type}/`;
    
    // Check if directory exists
    const dirInfo = await FileSystem.getInfoAsync(typeDir);
    if (!dirInfo.exists) {
      return [];
    }
    
    // Read directory contents
    const files = await FileSystem.readDirectoryAsync(typeDir);
    const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));
    
    // Get file info for each PDF
    const fileInfoPromises = pdfFiles.map(async (fileName) => {
      const filePath = typeDir + fileName;
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      return {
        name: fileName,
        path: filePath,
        size: fileInfo.size,
        modificationTime: new Date(fileInfo.modificationTime * 1000),
      };
    });
    
    const fileInfos = await Promise.all(fileInfoPromises);
    return fileInfos.sort((a, b) => b.modificationTime - a.modificationTime); // Newest first
  } catch (error) {
    console.error('❌ Error listing local PDFs:', error);
    return [];
  }
};

/**
 * Clean up old local PDF files (optional utility)
 * @param {string} restaurantId - Restaurant ID
 * @param {string} type - Type of document 
 * @param {number} maxAge - Maximum age in milliseconds (default: 30 days)
 * @returns {Promise<number>} - Number of files cleaned up
 */
export const cleanupOldLocalPdfs = async (restaurantId, type = 'documents', maxAge = 30 * 24 * 60 * 60 * 1000) => {
  try {
    const localFiles = await listLocalPdfs(restaurantId, type);
    const cutoffDate = new Date(Date.now() - maxAge);
    let cleanedCount = 0;
    
    for (const file of localFiles) {
      if (file.modificationTime < cutoffDate) {
        try {
          await FileSystem.deleteAsync(file.path, { idempotent: true });
          cleanedCount++;
          console.log(`🗑️ Cleaned up old PDF: ${file.name}`);
        } catch (deleteError) {
          console.warn(`⚠️ Could not delete file ${file.name}:`, deleteError);
        }
      }
    }
    
    return cleanedCount;
  } catch (error) {
    console.error('❌ Error cleaning up local PDFs:', error);
    return 0;
  }
};
