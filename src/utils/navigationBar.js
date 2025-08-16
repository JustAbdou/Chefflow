import { Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';


export const navigationBarUtils = {


  hideNavigationBar: async () => {
    if (Platform.OS === 'android') {
      try {
        await NavigationBar.setVisibilityAsync('hidden');
        console.log('✅ Android navigation bar hidden');
      } catch (error) {
        console.error('❌ Error hiding navigation bar:', error);
      }
    }
  },


  showNavigationBar: async () => {
    if (Platform.OS === 'android') {
      try {
        await NavigationBar.setVisibilityAsync('visible');
        console.log('✅ Android navigation bar shown');
      } catch (error) {
        console.error('❌ Error showing navigation bar:', error);
      }
    }
  },


  setLeanBackMode: async () => {
    if (Platform.OS === 'android') {
      try {
        await NavigationBar.setVisibilityAsync('leanback');
        console.log('✅ Android navigation bar set to lean-back mode');
      } catch (error) {
        console.error('❌ Error setting lean-back mode:', error);
      }
    }
  },

  
  setNavigationBarColor: async (color = '#000000') => {
    if (Platform.OS === 'android') {
      try {
        await NavigationBar.setBackgroundColorAsync(color);
        console.log(`✅ Navigation bar color set to ${color}`);
      } catch (error) {
        console.error('❌ Error setting navigation bar color:', error);
      }
    }
  },


  initializeNavigationBar: async () => {
    if (Platform.OS === 'android') {
      try {
        await NavigationBar.setVisibilityAsync('hidden');
        await NavigationBar.setBackgroundColorAsync('#000000');
        console.log('✅ Navigation bar initialized for ChefFlow (hidden mode)');
      } catch (error) {
        console.error('❌ Error initializing navigation bar:', error);
      }
    }
  },


  isAvailable: () => {
    return Platform.OS === 'android' && NavigationBar;
  }
};
export default navigationBarUtils;
