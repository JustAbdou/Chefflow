import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
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
  onDeleteRestaurant,
  deletingRestaurantId,
}) {
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
            <Text style={styles.modalTitle}>My Restaurants</Text>
            <TouchableOpacity 
              onPress={onClose}
              style={styles.modalCloseButton}
            >
              <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalSubtitle}>
            Tap a restaurant to switch. Delete removes it from your account only — you can be re-added later.
          </Text>
          
          <ScrollView style={styles.restaurantList}>
            {availableRestaurants.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="store" size={32} color={Colors.gray400} />
                <Text style={styles.emptyStateTitle}>No restaurants</Text>
                <Text style={styles.emptyStateText}>
                  Contact your administrator to be assigned to a restaurant.
                </Text>
              </View>
            ) : (
              availableRestaurants.map((restaurant) => {
                const isActive = restaurant.id === activeRestaurantId;
                const isDeleting = deletingRestaurantId === restaurant.id;
                
                return (
                  <View
                    key={restaurant.id}
                    style={[
                      styles.restaurantItem,
                      isActive && styles.restaurantItemActive
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.restaurantItemMain}
                      onPress={() => onSelectRestaurant(restaurant.id)}
                      activeOpacity={0.7}
                      disabled={!!deletingRestaurantId}
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

                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => onDeleteRestaurant(restaurant)}
                      activeOpacity={0.7}
                      disabled={!!deletingRestaurantId}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      {isDeleting ? (
                        <ActivityIndicator size="small" color={Colors.danger} />
                      ) : (
                        <MaterialIcons name="delete-outline" size={22} color={Colors.danger} />
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
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
    paddingBottom: Spacing.sm,
  },
  modalTitle: {
    fontSize: scaleFont(20),
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
  },
  modalCloseButton: {
    padding: scaleWidth(4),
  },
  modalSubtitle: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontRegular,
    color: Colors.textSecondary,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    lineHeight: scaleFont(18),
  },
  restaurantList: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  restaurantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  restaurantItemActive: {
    backgroundColor: Colors.gray50,
  },
  restaurantItemMain: {
    flex: 1,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
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
    marginRight: Spacing.sm,
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
  deleteButton: {
    padding: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: scaleWidth(44),
    minHeight: scaleWidth(44),
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  emptyStateTitle: {
    fontSize: Typography.lg,
    fontFamily: Typography.fontSemibold,
    color: Colors.textPrimary,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  emptyStateText: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontRegular,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: scaleFont(20),
  },
});
