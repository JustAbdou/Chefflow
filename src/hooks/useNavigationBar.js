import { useEffect } from 'react';
import { Platform } from 'react-native';
import navigationBarUtils from '../utils/navigationBar';

export const useNavigationBar = () => {

  const useAutoHide = (autoHide = true) => {
    useEffect(() => {
      if (autoHide && Platform.OS === 'android') {
        navigationBarUtils.hideNavigationBar();
      }
      return () => {
      };
    }, [autoHide]);
  };

  const useLeanBack = () => {
    useEffect(() => {
      if (Platform.OS === 'android') {
        navigationBarUtils.hideNavigationBar();
      }
    }, []);
  };

  const useHidden = () => {
    useEffect(() => {
      if (Platform.OS === 'android') {
        navigationBarUtils.hideNavigationBar();
      }
    }, []);
  };

  const useNavigationBarColor = (color) => {
    useEffect(() => {
      if (color && Platform.OS === 'android') {
        navigationBarUtils.setNavigationBarColor(color);
      }
    }, [color]);
  };
  return {
    hide: navigationBarUtils.hideNavigationBar,
    show: navigationBarUtils.showNavigationBar,
    setLeanBack: navigationBarUtils.setLeanBackMode,
    setColor: navigationBarUtils.setNavigationBarColor,
    useAutoHide,
    useLeanBack,
    useHidden,
    useNavigationBarColor,
    isAvailable: navigationBarUtils.isAvailable(),
    isAndroid: Platform.OS === 'android'
  };
};
export default useNavigationBar;
