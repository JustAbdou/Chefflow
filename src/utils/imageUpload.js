import { storage } from '../../firebase';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Upload an image file to Firebase Storage and return both full-size and thumbnail URLs
 * @param {string} imageUri - Local file URI of the image
 * @param {string} restaurantId - Restaurant ID for organizing files
 * @param {string} recipeId - Recipe ID (optional, for organizing recipe images)
 * @returns {Promise<{fullUrl: string, thumbUrl: string}>} - Object with full-size and thumbnail download URLs
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
      // Return both URLs as the same (no thumbnail generation for existing URLs)
      return { fullUrl: imageUri, thumbUrl: imageUri };
    }

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

    // Generate thumbnail first (~300px wide, JPEG, lower quality)
    console.log('🖼️ Generating thumbnail...');
    let thumbUri;
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 300 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
      );
      thumbUri = manipResult.uri;
      console.log('✅ Thumbnail generated:', thumbUri);
    } catch (thumbError) {
      console.warn('⚠️ Failed to generate thumbnail, using original:', thumbError);
      thumbUri = imageUri; // Fallback to original if thumbnail generation fails
    }

    // Upload full-size image
    const fullStoragePath = recipeId
      ? `restaurants/${restaurantId}/recipes/${recipeId}/${fileName}`
      : `restaurants/${restaurantId}/recipes/${fileName}`;
    const fullFileRef = storageRef(storage, fullStoragePath);
    console.log('📁 Uploading full-size image to path:', fullStoragePath);

    const fullResponse = await fetch(imageUri);
    if (!fullResponse.ok) {
      throw new Error(`Failed to read image: ${fullResponse.status} ${fullResponse.statusText}`);
    }

    const fullBlob = await fullResponse.blob();
    console.log('🗂️ Full image blob created, size:', fullBlob.size, 'bytes');

    if (fullBlob.size === 0) {
      throw new Error('Image is empty or could not be read');
    }

    // Determine content type
    let contentType = fullBlob.type || 'image/jpeg';
    if (!fullBlob.type || fullBlob.type === 'application/octet-stream') {
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

    const fullMetadata = {
      contentType: contentType,
      customMetadata: {
        restaurantId: restaurantId,
        uploadedAt: new Date().toISOString(),
        ...(recipeId && { recipeId: recipeId }),
      }
    };

    // Upload full-size image
    const fullUploadTask = uploadBytesResumable(fullFileRef, fullBlob, fullMetadata);
    const fullUrl = await new Promise((resolve, reject) => {
      fullUploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log(`⏳ Full image upload progress: ${progress.toFixed(1)}%`);
        },
        (error) => {
          console.error('❌ Error uploading full image:', error);
          reject(error);
        },
        async () => {
          try {
            const url = await getDownloadURL(fullUploadTask.snapshot.ref);
            console.log('✅ Full image uploaded successfully:', url);
            resolve(url);
          } catch (error) {
            console.error('❌ Error getting full image download URL:', error);
            reject(error);
          }
        }
      );
    });

    // Upload thumbnail image
    const thumbFileName = `thumb_${fileName}`;
    const thumbStoragePath = recipeId
      ? `restaurants/${restaurantId}/recipes/${recipeId}/${thumbFileName}`
      : `restaurants/${restaurantId}/recipes/${thumbFileName}`;
    const thumbFileRef = storageRef(storage, thumbStoragePath);
    console.log('📁 Uploading thumbnail to path:', thumbStoragePath);

    const thumbResponse = await fetch(thumbUri);
    if (!thumbResponse.ok) {
      throw new Error(`Failed to read thumbnail: ${thumbResponse.status} ${thumbResponse.statusText}`);
    }

    const thumbBlob = await thumbResponse.blob();
    console.log('🗂️ Thumbnail blob created, size:', thumbBlob.size, 'bytes');

    const thumbMetadata = {
      contentType: 'image/jpeg',
      customMetadata: {
        restaurantId: restaurantId,
        uploadedAt: new Date().toISOString(),
        isThumbnail: 'true',
        ...(recipeId && { recipeId: recipeId }),
      }
    };

    const thumbUploadTask = uploadBytesResumable(thumbFileRef, thumbBlob, thumbMetadata);
    const thumbUrl = await new Promise((resolve, reject) => {
      thumbUploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log(`⏳ Thumbnail upload progress: ${progress.toFixed(1)}%`);
        },
        (error) => {
          console.error('❌ Error uploading thumbnail:', error);
          // Don't fail the whole upload if thumbnail fails, just use full URL as fallback
          console.warn('⚠️ Using full image URL as thumbnail fallback');
          resolve(fullUrl);
        },
        async () => {
          try {
            const url = await getDownloadURL(thumbUploadTask.snapshot.ref);
            console.log('✅ Thumbnail uploaded successfully:', url);
            resolve(url);
          } catch (error) {
            console.error('❌ Error getting thumbnail download URL:', error);
            // Fallback to full URL if thumbnail URL fetch fails
            resolve(fullUrl);
          }
        }
      );
    });

    return { fullUrl, thumbUrl };

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

/**
 * Legacy function for backward compatibility - returns just the full URL
 * @deprecated Use uploadImageToStorage() which returns {fullUrl, thumbUrl}
 */
export const uploadImageToStorageLegacy = async (imageUri, restaurantId, recipeId = null) => {
  const result = await uploadImageToStorage(imageUri, restaurantId, recipeId);
  // If result is already a string (from the early return), return it
  if (typeof result === 'string') {
    return result;
  }
  return result.fullUrl;
};

