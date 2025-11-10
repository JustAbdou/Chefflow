import { storage } from '../../firebase';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

/**
 * Upload an image file to Firebase Storage and return the download URL
 * @param {string} imageUri - Local file URI of the image
 * @param {string} restaurantId - Restaurant ID for organizing files
 * @param {string} recipeId - Recipe ID (optional, for organizing recipe images)
 * @returns {Promise<string>} - Download URL of the uploaded image
 */
export const uploadImageToStorage = async (imageUri, restaurantId, recipeId = null) => {
  try {
    console.log('📤 Starting image upload to Firebase Storage...');
    console.log('Image URI:', imageUri);
    console.log('Restaurant ID:', restaurantId);

    // Validate inputs
    if (!imageUri || !restaurantId) {
      throw new Error('Missing required parameters for image upload');
    }

    // Check if image is already a URL (from Firebase Storage)
    if (imageUri.startsWith('http://') || imageUri.startsWith('https://')) {
      console.log('✅ Image is already a URL, skipping upload');
      return imageUri;
    }

    // Image is already compressed by ImagePicker with quality: 0.5
    // No additional compression needed - using existing libraries only

    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 11);
    // Try to get extension from URI, default to jpg
    let fileExtension = 'jpg';
    try {
      const uriParts = imageUri.split('.');
      if (uriParts.length > 1) {
        fileExtension = uriParts[uriParts.length - 1].split('?')[0].split('/')[0];
        // Ensure it's a valid image extension
        if (!['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(fileExtension.toLowerCase())) {
          fileExtension = 'jpg';
        }
      }
    } catch (e) {
      console.warn('Could not determine file extension, using jpg');
    }
    const fileName = recipeId 
      ? `${recipeId}_${timestamp}_${randomString}.${fileExtension}`
      : `${timestamp}_${randomString}.${fileExtension}`;

    // Create storage reference with restaurant-specific path
    const storagePath = recipeId
      ? `restaurants/${restaurantId}/recipes/${recipeId}/${fileName}`
      : `restaurants/${restaurantId}/recipes/${fileName}`;
    const fileRef = storageRef(storage, storagePath);

    console.log('📁 Uploading to path:', storagePath);

    // Read the image file as blob (already compressed by ImagePicker)
    const response = await fetch(imageUri);
    if (!response.ok) {
      throw new Error(`Failed to read image: ${response.status} ${response.statusText}`);
    }

    const blob = await response.blob();
    console.log('🗂️ Image blob created, size:', blob.size, 'bytes, type:', blob.type);

    if (blob.size === 0) {
      throw new Error('Image is empty or could not be read');
    }

    // Determine content type from blob or file extension
    let contentType = blob.type || 'image/jpeg';
    // If blob type is not set or is generic, use file extension
    if (!blob.type || blob.type === 'application/octet-stream') {
      if (fileExtension.toLowerCase() === 'png') {
        contentType = 'image/png';
      } else if (fileExtension.toLowerCase() === 'webp') {
        contentType = 'image/webp';
      } else if (fileExtension.toLowerCase() === 'gif') {
        contentType = 'image/gif';
      } else {
        contentType = 'image/jpeg';
      }
    }
    console.log('📋 Using content type:', contentType);

    const metadata = {
      contentType: contentType,
      customMetadata: {
        restaurantId: restaurantId,
        uploadedAt: new Date().toISOString(),
        ...(recipeId && { recipeId: recipeId }),
      }
    };

    console.log('☁️ Starting Firebase Storage upload...');

    // Use uploadBytesResumable for better progress tracking and error handling
    const uploadTask = uploadBytesResumable(fileRef, blob, metadata);

    // Return a promise that resolves when upload completes
    const downloadURL = await new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // Progress tracking
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log(`⏳ Image upload progress: ${progress.toFixed(1)}%`);
        },
        (error) => {
          console.error('❌ Error uploading image:', error);
          reject(error);
        },
        async () => {
          // Upload completed successfully
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            console.log('✅ Image uploaded successfully:', url);
            resolve(url);
          } catch (error) {
            console.error('❌ Error getting download URL:', error);
            reject(error);
          }
        }
      );
    });

    return downloadURL;

  } catch (error) {
    console.error('❌ Error uploading image to Firebase Storage:', error);
    
    // Provide helpful error messages
    if (error.code === 'storage/unauthorized') {
      throw new Error('Upload failed: Insufficient permissions to access Firebase Storage');
    } else if (error.code === 'storage/canceled') {
      throw new Error('Upload was canceled');
    } else if (error.code === 'storage/unknown') {
      throw new Error('Upload failed: Firebase Storage error - check internet connection and Firebase configuration');
    } else if (error.code === 'storage/invalid-format') {
      throw new Error('Upload failed: Invalid image format');
    } else if (error.code === 'storage/quota-exceeded') {
      throw new Error('Upload failed: Storage quota exceeded');
    } else if (error.code === 'storage/retry-limit-exceeded') {
      throw new Error('Upload failed: Maximum retry limit exceeded. Please check your internet connection.');
    }
    
    throw new Error('Failed to upload image to cloud storage: ' + error.message);
  }
};

