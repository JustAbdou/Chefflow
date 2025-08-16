import { useState, useEffect } from 'react';
import { Dimensions } from 'react-native';
import { responsiveDimensions, scaleWidth, scaleHeight, scaleFont, scaleModerate, getAndroidTitleMargin } from '../utils/responsive';

/**
 * Hook for responsive design
 * @returns {object} Responsive utilities and screen info
 */
export const useResponsive = () => {
  const [screenData, setScreenData] = useState(responsiveDimensions);

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenData({
        screenWidth: window.width,
        screenHeight: window.height,
        isSmallDevice: window.width < 360,
        isTablet: window.width >= 768,
        scale: window.width / 390, // Base width
      });
    });

    return () => subscription?.remove();
  }, []);

  return {
    ...screenData,
    scaleWidth,
    scaleHeight,
    scaleFont,
    scaleModerate,
    getAndroidTitleMargin,
    isPhone: !screenData.isTablet,
    isLandscape: screenData.screenWidth > screenData.screenHeight,
    wp: (percentage) => (screenData.screenWidth * percentage) / 100,
    hp: (percentage) => (screenData.screenHeight * percentage) / 100,
  };
};

export default useResponsive;
