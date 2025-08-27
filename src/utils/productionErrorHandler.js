/**
 * Production Error Handler
 * Provides better error reporting for production builds
 */

export const reportProductionError = (error, context = '') => {
  // In production, you might want to send this to a crash reporting service
  // like Sentry, Crashlytics, or Bugsnag
  
  const errorDetails = {
    message: error.message || 'Unknown error',
    stack: error.stack || 'No stack trace',
    context: context,
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'React Native',
  };

  // For now, we'll just log it
  console.error('Production Error:', errorDetails);
  
  // You could also store errors locally for later upload
  // AsyncStorage.setItem(`error_${Date.now()}`, JSON.stringify(errorDetails));
  
  return errorDetails;
};

export const validateEnvironment = () => {
  const requiredEnvVars = [
    'EXPO_PUBLIC_FIREBASE_API_KEY',
    'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
    'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'EXPO_PUBLIC_FIREBASE_APP_ID'
  ];

  const missing = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    const error = new Error(`Missing environment variables: ${missing.join(', ')}`);
    reportProductionError(error, 'Environment Validation');
    return false;
  }
  
  return true;
};
