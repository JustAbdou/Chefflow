import { storage } from '../../firebase';
import { ref as storageRef, uploadBytes, getDownloadURL, uploadString } from 'firebase/storage';
import * as FileSystem from 'expo-file-system';


export const uploadPdfToStorage = async (localPdfPath, fileName, restaurantId, type = 'documents') => {
  try {
    console.log('📤 Starting PDF upload to Firebase Storage...');
    console.log('Local path:', localPdfPath);
    console.log('File name:', fileName);
    console.log('Restaurant ID:', restaurantId);
    console.log('Type:', type);
    if (!localPdfPath || !fileName || !restaurantId) {
      throw new Error('Missing required parameters for PDF upload');
    }
    const fileInfo = await FileSystem.getInfoAsync(localPdfPath);
    if (!fileInfo.exists) {
      throw new Error('PDF file does not exist at the specified path');
    }
    console.log('📄 File exists, size:', fileInfo.size);
    const fileBase64 = await FileSystem.readAsStringAsync(localPdfPath, {
      encoding: FileSystem.EncodingType.Base64,
    });
    console.log('📄 File read as base64, length:', fileBase64.length);
    if (!fileBase64 || fileBase64.length === 0) {
      throw new Error('Failed to read PDF file or file is empty');
    }
    const storagePath = `restaurants/${restaurantId}/${type}/${fileName}`;
    const fileRef = storageRef(storage, storagePath);
    console.log('📁 Uploading to path:', storagePath);
    const dataUri = `data:application/pdf;base64,${fileBase64}`;
    console.log('🔄 Converting to blob...');
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


export const uploadPdfToStorageTemporary = async (localPdfPath, fileName, restaurantId, type = 'documents') => {
  try {
    console.log('📤 Using temporary PDF storage solution...');
    console.log('Local path:', localPdfPath);
    console.log('File name:', fileName);
    if (!localPdfPath || !fileName || !restaurantId) {
      throw new Error('Missing required parameters for PDF upload');
    }
    const fileInfo = await FileSystem.getInfoAsync(localPdfPath);
    if (!fileInfo.exists) {
      throw new Error('PDF file does not exist at the specified path');
    }
    console.log('📄 File exists, size:', fileInfo.size);
    const permanentPath = FileSystem.documentDirectory + 'pdfs/' + fileName;
    const pdfDir = FileSystem.documentDirectory + 'pdfs/';
    const dirInfo = await FileSystem.getInfoAsync(pdfDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(pdfDir, { intermediates: true });
      console.log('� Created PDFs directory');
    }
    await FileSystem.copyAsync({
      from: localPdfPath,
      to: permanentPath,
    });
    console.log('📄 PDF saved to permanent location:', permanentPath);
    return permanentPath;
  } catch (error) {
    console.error('❌ Error saving PDF (temporary method):', error);
    throw new Error('Failed to save PDF: ' + error.message);
  }
};


export const generatePdfFileName = (type, startDate, endDate) => {
  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const start = formatDate(startDate);
  const end = formatDate(endDate);
  return `${type}_${start}_to_${end}_${timestamp}.pdf`;
};


export const testStorageConnection = async (restaurantId) => {
  try {
    console.log('🧪 Testing Firebase Storage connection...');
    const testContent = 'This is a test file for Firebase Storage connectivity';
    const testFileName = `test_${Date.now()}.txt`;
    const testPath = `restaurants/${restaurantId}/test/${testFileName}`;
    console.log('📝 Creating test file...');
    const blob = new Blob([testContent], { type: 'text/plain' });
    const fileRef = storageRef(storage, testPath);
    console.log('☁️ Uploading test file to:', testPath);
    const snapshot = await uploadBytes(fileRef, blob);
    console.log('✅ Test file uploaded successfully');
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
