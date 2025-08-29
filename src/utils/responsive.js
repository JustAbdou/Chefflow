import { Dimensions, PixelRatio, Platform } from 'react-native';

// Get device dimensions
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Base dimensions (iPhone 12 Pro dimensions as reference)
const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

/**
 * Scale size based on screen width
 * @param {number} size - The size to scale
 * @returns {number} - Scaled size
 */
export const scaleWidth = (size) => {
  const scale = SCREEN_WIDTH / BASE_WIDTH;
  return Math.round(PixelRatio.roundToNearestPixel(size * scale));
};

/**
 * Scale size based on screen height
 * @param {number} size - The size to scale
 * @returns {number} - Scaled size
 */
export const scaleHeight = (size) => {
  const scale = SCREEN_HEIGHT / BASE_HEIGHT;
  return Math.round(PixelRatio.roundToNearestPixel(size * scale));
};

/**
 * Scale font size with min/max bounds
 * @param {number} size - The font size to scale
 * @param {number} minScale - Minimum scale factor (default: 0.8)
 * @param {number} maxScale - Maximum scale factor (default: 1.3)
 * @returns {number} - Scaled font size
 */
export const scaleFont = (size, minScale = 0.8, maxScale = 1.3) => {
  const scale = Math.min(SCREEN_WIDTH / BASE_WIDTH, SCREEN_HEIGHT / BASE_HEIGHT);
  const clampedScale = Math.max(minScale, Math.min(maxScale, scale));
  return Math.round(PixelRatio.roundToNearestPixel(size * clampedScale));
};

/**
 * Scale size moderately (less aggressive scaling)
 * @param {number} size - The size to scale
 * @param {number} factor - Scale factor (default: 0.5)
 * @returns {number} - Moderately scaled size
 */
export const scaleModerate = (size, factor = 0.5) => {
  const scale = SCREEN_WIDTH / BASE_WIDTH;
  return Math.round(PixelRatio.roundToNearestPixel(size + (scale - 1) * size * factor));
};

/**
 * Get Android-specific top margin for titles
 * @param {number} baseMargin - Base margin for iOS (default: 0)
 * @returns {number} - Platform-specific top margin
 */
export const getAndroidTitleMargin = (baseMargin = 0) => {
  if (Platform.OS === 'android') {
    return baseMargin + scaleHeight(16); // Add extra margin for Android
  }
  return baseMargin;
};

/**
 * Get responsive dimensions
 */
export const responsiveDimensions = {
  screenWidth: SCREEN_WIDTH,
  screenHeight: SCREEN_HEIGHT,
  isSmallDevice: SCREEN_WIDTH < 360,
  isTablet: SCREEN_WIDTH >= 768,
  scale: SCREEN_WIDTH / BASE_WIDTH,
  isAndroid: Platform.OS === 'android',
  isIOS: Platform.OS === 'ios',
};

/**
 * Responsive spacing utility
 */
export const responsiveSpacing = {
  xs: scaleModerate(4),
  sm: scaleModerate(8),
  md: scaleModerate(16),
  lg: scaleModerate(24),
  xl: scaleModerate(32),
  '2xl': scaleModerate(48),
  '3xl': scaleModerate(64),
};

/**
 * Responsive typography utility
 */
export const responsiveTypography = {
  // Font sizes
  xs: scaleFont(12),
  sm: scaleFont(14),
  base: scaleFont(16),
  lg: scaleFont(18),
  xl: scaleFont(20),
  xxl: scaleFont(24),
  '3xl': scaleFont(30),
  '4xl': scaleFont(36),
};

export default {
  scaleWidth,
  scaleHeight,
  scaleFont,
  scaleModerate,
  getAndroidTitleMargin,
  responsiveDimensions,
  responsiveSpacing,
  responsiveTypography,
};
