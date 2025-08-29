import { useEffect } from 'react';
import { Platform } from 'react-native';
import navigationBarUtils from '../utils/navigationBar';

/**
 * React Hook for Android Navigation Bar Control
 * Provides easy access to navigation bar utilities in React components
 */

export const useNavigationBar = () => {
  /**
   * Hide navigation bar when component mounts
   * @param {boolean} autoHide - Whether to automatically hide on mount
   */
  const useAutoHide = (autoHide = true) => {
    useEffect(() => {
      if (autoHide && Platform.OS === 'android') {
        navigationBarUtils.hideNavigationBar();
      }

      // Optional: Show navigation bar when component unmounts
      return () => {
        // Uncomment if you want to restore navigation bar on unmount
        // navigationBarUtils.showNavigationBar();
      };
    }, [autoHide]);
  };

  /**
   * Hide navigation bar completely when component mounts
   * Navigation bar will be completely hidden for immersive experience
   */
  const useLeanBack = () => {
    useEffect(() => {
      if (Platform.OS === 'android') {
        navigationBarUtils.hideNavigationBar();
      }
    }, []);
  };

  /**
   * Set navigation bar to full hide mode when component mounts
   * More aggressive hiding than lean-back mode
   */
  const useHidden = () => {
    useEffect(() => {
      if (Platform.OS === 'android') {
        navigationBarUtils.hideNavigationBar();
      }
    }, []);
  };

  /**
   * Set navigation bar color when component mounts
   * @param {string} color - Hex color code
   */
  const useNavigationBarColor = (color) => {
    useEffect(() => {
      if (color && Platform.OS === 'android') {
        navigationBarUtils.setNavigationBarColor(color);
      }
    }, [color]);
  };

  return {
    // Direct utility access
    hide: navigationBarUtils.hideNavigationBar,
    show: navigationBarUtils.showNavigationBar,
    setLeanBack: navigationBarUtils.setLeanBackMode,
    setColor: navigationBarUtils.setNavigationBarColor,
    
    // React hooks for automatic behavior
    useAutoHide,
    useLeanBack,
    useHidden,
    useNavigationBarColor,
    
    // Utility checks
    isAvailable: navigationBarUtils.isAvailable(),
    isAndroid: Platform.OS === 'android'
  };
};

export default useNavigationBar;
