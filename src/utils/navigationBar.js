import { Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';

/**
 * Android Navigation Bar Utility
 * Handles hiding/showing the Android navigation bar (home, back, recent apps buttons)
 */

export const navigationBarUtils = {
  /**
   * Hide the Android navigation bar completely
   * Creates an immersive full-screen experience
   */
  hideNavigationBar: async () => {
    if (Platform.OS === 'android') {
      try {
        // Hide the navigation bar with immersive mode
        await NavigationBar.setVisibilityAsync('hidden');
        console.log('✅ Android navigation bar hidden');
      } catch (error) {
        console.error('❌ Error hiding navigation bar:', error);
      }
    }
  },

  /**
   * Show the Android navigation bar
   * Restores normal navigation behavior
   */
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

  /**
   * Set navigation bar to lean-back mode
   * Hides navigation bar but shows it on user interaction
   */
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

  /**
   * Set navigation bar background color
   * @param {string} color - Hex color code (e.g., '#000000')
   */
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

  /**
   * Initialize navigation bar settings for the app
   * Call this in your main App component
   */
  initializeNavigationBar: async () => {
    if (Platform.OS === 'android') {
      try {
        // Hide the navigation bar completely for full immersive experience
        await NavigationBar.setVisibilityAsync('hidden');
        
        // Set a dark background color that matches your app
        await NavigationBar.setBackgroundColorAsync('#000000');
        
        console.log('✅ Navigation bar initialized for ChefFlow (hidden mode)');
      } catch (error) {
        console.error('❌ Error initializing navigation bar:', error);
      }
    }
  },

  /**
   * Check if navigation bar APIs are available
   */
  isAvailable: () => {
    return Platform.OS === 'android' && NavigationBar;
  }
};

export default navigationBarUtils;
