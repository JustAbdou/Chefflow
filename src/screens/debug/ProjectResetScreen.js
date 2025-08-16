import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { resetForNewProject, quickConnectionReset } from '../utils/projectReset';
import { Colors, Spacing, Typography } from '../constants';
const ProjectResetScreen = () => {
  const [isResetting, setIsResetting] = useState(false);
  const handleFullReset = async () => {
    Alert.alert(
      'Full Project Reset',
      'This will clear all cached data and reset the connection. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setIsResetting(true);
            const success = await resetForNewProject();
            setIsResetting(false);
            Alert.alert(
              success ? 'Success' : 'Error',
              success
                ? 'Project reset complete! Please restart the app.'
                : 'Reset failed. Check console for details.'
            );
          }
        }
      ]
    );
  };
  const handleQuickReset = async () => {
    setIsResetting(true);
    const success = await quickConnectionReset();
    setIsResetting(false);
    Alert.alert(
      success ? 'Success' : 'Error',
      success
        ? 'Connection reset complete!'
        : 'Reset failed. Check console for details.'
    );
  };
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Firebase Project Reset</Text>
      <Text style={styles.subtitle}>
        Use these tools to resolve connection issues after changing Firebase projects
      </Text>
      <TouchableOpacity
        style={[styles.button, styles.quickButton]}
        onPress={handleQuickReset}
        disabled={isResetting}
      >
        <Text style={styles.buttonText}>Quick Connection Reset</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, styles.fullButton]}
        onPress={handleFullReset}
        disabled={isResetting}
      >
        <Text style={styles.buttonText}>Full Project Reset</Text>
      </TouchableOpacity>
      {isResetting && (
        <Text style={styles.status}>Resetting...</Text>
      )}
      <View style={styles.info}>
        <Text style={styles.infoTitle}>What each button does:</Text>
        <Text style={styles.infoText}>
          • Quick Reset: Resets Firestore connection only
        </Text>
        <Text style={styles.infoText}>
          • Full Reset: Clears all cache and resets everything
        </Text>
      </View>
    </View>
  );
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.large,
    backgroundColor: Colors.backgroundPrimary,
  },
  title: {
    ...Typography.h1,
    color: Colors.textPrimary,
    marginBottom: Spacing.small,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.large,
  },
  button: {
    padding: Spacing.medium,
    borderRadius: 8,
    marginBottom: Spacing.medium,
    alignItems: 'center',
  },
  quickButton: {
    backgroundColor: Colors.primary,
  },
  fullButton: {
    backgroundColor: Colors.error,
  },
  buttonText: {
    ...Typography.buttonText,
    color: Colors.white,
  },
  status: {
    ...Typography.body,
    color: Colors.primary,
    textAlign: 'center',
    marginTop: Spacing.medium,
  },
  info: {
    marginTop: Spacing.large,
    padding: Spacing.medium,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 8,
  },
  infoTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: Spacing.small,
  },
  infoText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.small,
  },
});
export default ProjectResetScreen;
