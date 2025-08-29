import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Colors, Typography, Spacing } from '../../constants';
import { useRestaurant } from '../../contexts/RestaurantContext';

const RestaurantSelectionScreen = ({ navigation }) => {
  const { setRestaurantId } = useRestaurant();
  const [customId, setCustomId] = useState('');

  const predefinedRestaurants = [
    { id: 'restaurant-1', name: 'Main Branch' },
    { id: 'restaurant-2', name: 'Downtown Location' },
    { id: 'restaurant-3', name: 'Airport Branch' },
  ];

  const handleSelectRestaurant = (restaurantId) => {
    setRestaurantId(restaurantId);
    navigation.navigate('Main');
  };

  const handleCustomId = () => {
    if (customId.trim()) {
      setRestaurantId(customId.trim());
      navigation.navigate('Main');
    } else {
      Alert.alert('Please enter a restaurant ID');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Select Restaurant</Text>
        <Text style={styles.subtitle}>Choose your restaurant location</Text>
      </View>

      <View style={styles.content}>
        {/* Predefined Restaurants */}
        <Text style={styles.sectionTitle}>Quick Select</Text>
        {predefinedRestaurants.map((restaurant) => (
          <TouchableOpacity
            key={restaurant.id}
            style={styles.restaurantButton}
            onPress={() => handleSelectRestaurant(restaurant.id)}
          >
            <Text style={styles.restaurantName}>{restaurant.name}</Text>
            <Text style={styles.restaurantId}>{restaurant.id}</Text>
          </TouchableOpacity>
        ))}

        {/* Custom Restaurant ID */}
        <Text style={styles.sectionTitle}>Custom Restaurant ID</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter custom restaurant ID"
          value={customId}
          onChangeText={setCustomId}
          autoCapitalize="none"
        />
        
        <TouchableOpacity style={styles.customButton} onPress={handleCustomId}>
          <Text style={styles.customButtonText}>Use Custom ID</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: Spacing.lg,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: Typography.fontRegular,
    color: Colors.textSecondary,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: Typography.fontSemiBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
  },
  restaurantButton: {
    backgroundColor: Colors.backgroundSecondary,
    padding: Spacing.md,
    borderRadius: 8,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  restaurantName: {
    fontSize: 16,
    fontFamily: Typography.fontSemiBold,
    color: Colors.textPrimary,
  },
  restaurantId: {
    fontSize: 14,
    fontFamily: Typography.fontRegular,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: Spacing.md,
    fontSize: 16,
    backgroundColor: Colors.backgroundSecondary,
    marginBottom: Spacing.md,
  },
  customButton: {
    backgroundColor: Colors.primary,
    padding: Spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  customButtonText: {
    color: Colors.background,
    fontSize: 16,
    fontFamily: Typography.fontSemiBold,
  },
});

export default RestaurantSelectionScreen;
