import { Dimensions, PixelRatio, Platform } from 'react-native';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;


export const scaleWidth = (size) => {
  const scale = SCREEN_WIDTH / BASE_WIDTH;
  return Math.round(PixelRatio.roundToNearestPixel(size * scale));
};


export const scaleHeight = (size) => {
  const scale = SCREEN_HEIGHT / BASE_HEIGHT;
  return Math.round(PixelRatio.roundToNearestPixel(size * scale));
};


export const scaleFont = (size, minScale = 0.8, maxScale = 1.3) => {
  const scale = Math.min(SCREEN_WIDTH / BASE_WIDTH, SCREEN_HEIGHT / BASE_HEIGHT);
  const clampedScale = Math.max(minScale, Math.min(maxScale, scale));
  return Math.round(PixelRatio.roundToNearestPixel(size * clampedScale));
};


export const scaleModerate = (size, factor = 0.5) => {
  const scale = SCREEN_WIDTH / BASE_WIDTH;
  return Math.round(PixelRatio.roundToNearestPixel(size + (scale - 1) * size * factor));
};


export const getAndroidTitleMargin = (baseMargin = 0) => {
  if (Platform.OS === 'android') {
    return baseMargin + scaleHeight(16);
  }
  return baseMargin;
};


export const responsiveDimensions = {
  screenWidth: SCREEN_WIDTH,
  screenHeight: SCREEN_HEIGHT,
  isSmallDevice: SCREEN_WIDTH < 360,
  isTablet: SCREEN_WIDTH >= 768,
  scale: SCREEN_WIDTH / BASE_WIDTH,
  isAndroid: Platform.OS === 'android',
  isIOS: Platform.OS === 'ios',
};


export const responsiveSpacing = {
  xs: scaleModerate(4),
  sm: scaleModerate(8),
  md: scaleModerate(16),
  lg: scaleModerate(24),
  xl: scaleModerate(32),
  '2xl': scaleModerate(48),
  '3xl': scaleModerate(64),
};


export const responsiveTypography = {
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
