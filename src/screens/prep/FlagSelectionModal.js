import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { Typography } from '../../constants/Typography';
import { Spacing } from '../../constants/Spacing';

const FlagSelectionModal = ({ visible, onClose, onSelect, onDelete, currentFlag }) => {
  const flagOptions = [
    { id: null, label: 'No Flag', color: Colors.gray200 },
    { id: 'x85', label: 'Orange Flag (x85)', color: '#F7B801' },
    { id: 'x86', label: 'Red Flag (x86)', color: '#FF3B30' },
  ];

  const handleSelect = (flagId) => {
    onSelect(flagId);
    onClose();
  };

  const handleDelete = () => {
    onDelete();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <View style={styles.modal}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Select Flag Priority</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Flag Options */}
            <View style={styles.optionsContainer}>
              {flagOptions.map((option) => (
                <TouchableOpacity
                  key={option.id || 'none'}
                  style={[
                    styles.optionItem,
                    currentFlag === option.id && styles.selectedOption
                  ]}
                  onPress={() => handleSelect(option.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.optionLeft}>
                    <Text style={[styles.flagIcon, { color: option.color }]}>⚑</Text>
                    <Text style={styles.optionLabel}>{option.label}</Text>
                  </View>
                  {currentFlag === option.id && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}

              {/* Delete Option */}
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.deleteOption}
                onPress={handleDelete}
                activeOpacity={0.7}
              >
                <View style={styles.optionLeft}>
                  <Text style={styles.deleteIcon}>🗑️</Text>
                  <Text style={styles.deleteLabel}>Delete Item</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 34,
    minHeight: 300,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  title: {
    fontSize: Typography.xl,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  closeText: {
    fontSize: 20,
    color: Colors.textSecondary,
  },
  optionsContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    borderRadius: 12,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.gray50,
  },
  selectedOption: {
    backgroundColor: Colors.primary + '20', // 20% opacity
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flagIcon: {
    fontSize: 22,
    marginRight: Spacing.md,
  },
  optionLabel: {
    fontSize: Typography.lg,
    fontFamily: Typography.fontMedium,
    color: Colors.textPrimary,
  },
  checkmark: {
    fontSize: 18,
    color: Colors.primary,
    fontWeight: Typography.bold,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: Spacing.md,
  },
  deleteOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    borderRadius: 12,
    marginBottom: Spacing.sm,
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FFE5E5',
  },
  deleteIcon: {
    fontSize: 22,
    marginRight: Spacing.md,
  },
  deleteLabel: {
    fontSize: Typography.lg,
    fontFamily: Typography.fontMedium,
    color: '#FF3B30',
  },
});

export default FlagSelectionModal;
