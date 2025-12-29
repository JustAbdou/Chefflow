import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Text,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Spacing';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

function FullscreenImageViewer({ visible, images, initialIndex = 0, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const scrollViewRef = useRef(null);
  const imageScrollRefs = useRef({});

  // Update current index when initialIndex or visible changes
  useEffect(() => {
    if (visible && scrollViewRef.current) {
      setCurrentIndex(initialIndex);
      // Scroll to the initial image
      setTimeout(() => {
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({
            x: initialIndex * SCREEN_WIDTH,
            animated: false,
          });
        }
      }, 100);
    }
  }, [visible, initialIndex]);

  // Handle horizontal scroll (swipe between images)
  const handleScroll = (event) => {
    const slideWidth = SCREEN_WIDTH;
    const currentIndex = Math.round(event.nativeEvent.contentOffset.x / slideWidth);
    setCurrentIndex(currentIndex);
  };

  // Navigate to specific image
  const goToImage = (index) => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        x: index * SCREEN_WIDTH,
        animated: true,
      });
    }
    setCurrentIndex(index);
  };

  // Reset zoom when changing images
  const handleImageChange = (index) => {
    // Reset zoom for the previous image
    const prevRef = imageScrollRefs.current[currentIndex];
    if (prevRef) {
      prevRef.scrollTo({ x: 0, y: 0, animated: false });
    }
  };

  // Update current index and reset zoom
  const handleScrollEnd = (event) => {
    const slideWidth = SCREEN_WIDTH;
    const newIndex = Math.round(event.nativeEvent.contentOffset.x / slideWidth);
    if (newIndex !== currentIndex) {
      handleImageChange(newIndex);
      setCurrentIndex(newIndex);
    }
  };

  if (!images || images.length === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <StatusBar hidden={true} />
      <View style={styles.container}>
        {/* Close Button */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={32} color={Colors.white} />
        </TouchableOpacity>

        {/* Image Counter */}
        {images.length > 1 && (
          <View style={styles.counterContainer}>
            <Text style={styles.counterText}>
              {currentIndex + 1} / {images.length}
            </Text>
          </View>
        )}

        {/* Horizontal ScrollView for multiple images */}
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          onMomentumScrollEnd={handleScrollEnd}
          scrollEventThrottle={16}
          style={styles.horizontalScrollView}
        >
          {images.map((imageUri, index) => (
            <ScrollView
              key={index}
              ref={(ref) => (imageScrollRefs.current[index] = ref)}
              style={styles.imageContainer}
              contentContainerStyle={styles.imageContentContainer}
              maximumZoomScale={3}
              minimumZoomScale={1}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              bouncesZoom={true}
              scrollEnabled={true}
            >
              <Image
                source={{ uri: imageUri }}
                style={styles.fullscreenImage}
                resizeMode="contain"
              />
            </ScrollView>
          ))}
        </ScrollView>

        {/* Pagination Dots */}
        {images.length > 1 && (
          <View style={styles.paginationContainer}>
            {images.map((_, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.paginationDot,
                  index === currentIndex && styles.paginationDotActive,
                ]}
                onPress={() => goToImage(index)}
                activeOpacity={0.7}
              />
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: Spacing.lg + 20,
    right: Spacing.lg,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: Spacing.sm,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterContainer: {
    position: 'absolute',
    top: Spacing.lg + 20,
    left: Spacing.lg,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  counterText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  horizontalScrollView: {
    flex: 1,
    width: SCREEN_WIDTH,
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  imageContentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: SCREEN_WIDTH,
    minHeight: SCREEN_HEIGHT,
  },
  fullscreenImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    maxWidth: SCREEN_WIDTH,
    maxHeight: SCREEN_HEIGHT,
  },
  paginationContainer: {
    position: 'absolute',
    bottom: Spacing.xl + 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: Colors.white,
    width: 24,
  },
});

export default FullscreenImageViewer;

