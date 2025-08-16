import React from 'react';
import { View, Button, Alert } from 'react-native';
import { migrateToRestaurantStructure } from '../utils/dataMigration';
const MigrationTestScreen = () => {
  const handleMigration = async () => {
    try {
      Alert.alert('Migration Started', 'Check console for progress...');
      await migrateToRestaurantStructure();
      Alert.alert('Migration Complete', 'Check Firestore dashboard for new structure!');
    } catch (error) {
      Alert.alert('Migration Failed', error.message);
    }
  };
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
      <Button
        title="Run Data Migration"
        onPress={handleMigration}
      />
    </View>
  );
};
export default MigrationTestScreen;
