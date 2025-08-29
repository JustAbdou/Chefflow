import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useRestaurant } from '../../contexts/RestaurantContext';
import { Colors, Typography, Spacing } from '../../constants';

const RestaurantSelectorScreen = () => {
  const { restaurantId, restaurantDisplayName, setRestaurantId, availableRestaurants, normalizeRestaurantName } = useRestaurant();
  const [customName, setCustomName] = useState('');

  const handleSelectRestaurant = (selectedId) => {
    Alert.alert(
      'Change Restaurant',
      `Switch to ${selectedId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Switch', 
          onPress: () => {
            setRestaurantId(selectedId);
            Alert.alert('Success', 'Restaurant changed successfully!');
          }
        }
      ]
    );
  };

  const handleCustomName = () => {
    if (!customName.trim()) {
      Alert.alert('Error', 'Please enter a restaurant name');
      return;
    }

    const normalizedName = normalizeRestaurantName(customName);
    Alert.alert(
      'Create Custom Restaurant',
      `Create restaurant "${customName}" with ID "${normalizedName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: () => {
            setRestaurantId(normalizedName);
            setCustomName('');
            Alert.alert('Success', 'Custom restaurant created successfully!');
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Restaurant Selector</Text>
      
      <View style={styles.currentSection}>
        <Text style={styles.sectionTitle}>Current Restaurant</Text>
        <View style={styles.currentRestaurant}>
          <Text style={styles.currentName}>{restaurantDisplayName}</Text>
          <Text style={styles.currentId}>ID: {restaurantId}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Predefined Restaurants</Text>
        {Object.entries(availableRestaurants).map(([key, id]) => (
          <TouchableOpacity
            key={id}
            style={[
              styles.restaurantOption,
              restaurantId === id && styles.selectedOption
            ]}
            onPress={() => handleSelectRestaurant(id)}
          >
            <Text style={[
              styles.optionText,
              restaurantId === id && styles.selectedText
            ]}>
              {id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </Text>
            <Text style={styles.optionId}>ID: {id}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Create Custom Restaurant</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter restaurant name (e.g., 'Mario's Pizza & Grill')"
          value={customName}
          onChangeText={setCustomName}
        />
        <Text style={styles.previewText}>
          Will create ID: {normalizeRestaurantName(customName) || 'enter-name-above'}
        </Text>
        <TouchableOpacity style={styles.createButton} onPress={handleCustomName}>
          <Text style={styles.createButtonText}>Create Custom Restaurant</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>How it works:</Text>
        <Text style={styles.infoText}>
          • Restaurant data is stored at: restaurants/{restaurantId}/{`collections`}{'\n'}
          • Document ID must be valid for Firestore{'\n'}
          • Special characters are automatically normalized{'\n'}
          • Changes take effect immediately
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.medium,
  },
  title: {
    ...Typography.title,
    textAlign: 'center',
    marginBottom: Spacing.large,
  },
  section: {
    marginBottom: Spacing.large,
  },
  sectionTitle: {
    ...Typography.subtitle,
    marginBottom: Spacing.medium,
    color: Colors.primary,
  },
  currentSection: {
    backgroundColor: Colors.primary + '10',
    padding: Spacing.medium,
    borderRadius: 8,
    marginBottom: Spacing.large,
  },
  currentRestaurant: {
    alignItems: 'center',
  },
  currentName: {
    ...Typography.subtitle,
    fontWeight: 'bold',
  },
  currentId: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: Spacing.small,
  },
  restaurantOption: {
    backgroundColor: Colors.white,
    padding: Spacing.medium,
    borderRadius: 8,
    marginBottom: Spacing.small,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  selectedOption: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  optionText: {
    ...Typography.body,
    fontWeight: '500',
  },
  selectedText: {
    color: Colors.white,
  },
  optionId: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  input: {
    backgroundColor: Colors.white,
    padding: Spacing.medium,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.small,
    ...Typography.body,
  },
  previewText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.medium,
    fontStyle: 'italic',
  },
  createButton: {
    backgroundColor: Colors.primary,
    padding: Spacing.medium,
    borderRadius: 8,
    alignItems: 'center',
  },
  createButtonText: {
    color: Colors.white,
    fontWeight: 'bold',
    ...Typography.body,
  },
  infoSection: {
    backgroundColor: Colors.warning + '10',
    padding: Spacing.medium,
    borderRadius: 8,
    marginTop: Spacing.medium,
  },
  infoTitle: {
    ...Typography.subtitle,
    marginBottom: Spacing.small,
    color: Colors.warning,
  },
  infoText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
});

export default RestaurantSelectorScreen;
