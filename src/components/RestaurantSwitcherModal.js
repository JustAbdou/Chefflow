import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { Typography } from '../constants/Typography';
import { Spacing } from '../constants/Spacing';
import { scaleFont, scaleWidth, scaleHeight } from '../utils/responsive';

export default function RestaurantSwitcherModal({
  visible,
  onClose,
  availableRestaurants,
  activeRestaurantId,
  onSelectRestaurant,
}) {
  if (availableRestaurants.length <= 1) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable 
        style={styles.modalOverlay}
        onPress={onClose}
      >
        <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Switch Restaurant</Text>
            <TouchableOpacity 
              onPress={onClose}
              style={styles.modalCloseButton}
            >
              <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.restaurantList}>
            {availableRestaurants.map((restaurant) => {
              const isActive = restaurant.id === activeRestaurantId;
              
              return (
                <TouchableOpacity
                  key={restaurant.id}
                  style={[
                    styles.restaurantItem,
                    isActive && styles.restaurantItemActive
                  ]}
                  onPress={() => onSelectRestaurant(restaurant.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.restaurantItemContent}>
                    <Text style={[
                      styles.restaurantItemName,
                      isActive && styles.restaurantItemNameActive
                    ]}>
                      {restaurant.name}
                    </Text>
                    {isActive && (
                      <MaterialIcons 
                        name="check-circle" 
                        size={20} 
                        color={Colors.primary} 
                      />
                    )}
                  </View>
                  {!isActive && (
                    <Text style={styles.restaurantItemId}>{restaurant.id}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: Spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: scaleFont(20),
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
  },
  modalCloseButton: {
    padding: scaleWidth(4),
  },
  restaurantList: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  restaurantItem: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  restaurantItemActive: {
    backgroundColor: Colors.gray50,
  },
  restaurantItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  restaurantItemName: {
    fontSize: Typography.base,
    fontFamily: Typography.fontMedium,
    color: Colors.textPrimary,
    flex: 1,
  },
  restaurantItemNameActive: {
    color: Colors.primary,
    fontFamily: Typography.fontSemibold,
  },
  restaurantItemId: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontRegular,
    color: Colors.textSecondary,
    marginTop: scaleHeight(4),
  },
});
