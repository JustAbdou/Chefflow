import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '../../constants';
import Button from '../../components/ui/Button';
import { getFormattedTodayDate } from '../../utils/dateUtils';
import { addDoc, serverTimestamp } from "firebase/firestore";
import { useRestaurant } from "../../contexts/RestaurantContext";
import { getRestaurantCollection, getRestaurantDoc } from "../../utils/firestoreHelpers";
import DateTimePickerModal from "react-native-modal-datetime-picker";

const InvoiceUploadScreen = ({ navigation }) => {
  const { restaurantId } = useRestaurant();
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Invoice details state
  const [invoiceNumber, setInvoiceNumber] = useState('#INV-2025-0421');
  const [date, setDate] = useState(new Date());
  const [amount, setAmount] = useState('0'); // <-- Set default amount to 0
  const [supplier, setSupplier] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [editField, setEditField] = useState(null);



  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaType.IMAGE, // <-- updated line
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleUpload = async () => {
    if (!restaurantId) return;
    
    setUploading(true);
    try {
      await addDoc(getRestaurantCollection(restaurantId, "invoices"), {
        invoiceNumber,
        date: formatDate(date),
        amount: parseFloat(amount.replace(/[£,]/g, "")),
        supplier,
        createdAt: serverTimestamp(),
        image: image || null,
      });
      setUploading(false);
      navigation.goBack();
    } catch (error) {
      setUploading(false);
      console.error(error);
    }
  };

  const handleRetake = () => {
    setImage(null);
  };

  // Helper to format date as YYYY-MM-DD
  const formatDate = (dateObj) => {
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const year = dateObj.getFullYear();
    return `${year}-${month}-${day}`;
  };

  // Update invoice number when date changes
  useEffect(() => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    setInvoiceNumber(`#INV-${year}-${month}${day}`);
  }, [date]);

  // Date picker handler
  const handleDateConfirm = (selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Text style={styles.backArrow}>‹</Text>
            </TouchableOpacity>
            <View>
              <Text style={styles.title}>Invoice Upload</Text>
              <Text style={styles.date}>{formatDate(date)}</Text>
            </View>
            <View style={{ width: 28 }} />
          </View>

          {/* Upload Box */}
          {/* <TouchableOpacity style={styles.uploadBox} onPress={pickImage}>
            {image ? (
              <Image source={{ uri: image }} style={styles.preview} />
            ) : (
              <View style={styles.uploadPlaceholder}>
                <Ionicons name="camera-outline" size={48} color={Colors.gray300} />
                <Text style={styles.uploadText}>Tap to scan or upload invoice</Text>
              </View>
            )}
          </TouchableOpacity> */}

          {/* Invoice Details */}
          <Text style={styles.sectionTitle}>Invoice Details</Text>
          <View style={styles.form}>
            {/* Invoice Number */}
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Invoice Number</Text>
              <View style={styles.inputWithIcon}>
                <TextInput
                  style={styles.input}
                  value={invoiceNumber}
                  editable={false} // Make it read-only
                  selectTextOnFocus={false}
                />
              </View>
            </View>
            {/* Date */}
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Date</Text>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar-outline" size={18} color={Colors.gray400} style={{ marginRight: 8 }} />
                <Text style={styles.dateInputText}>
                  {date ? formatDate(date) : 'Select date'}
                </Text>
              </TouchableOpacity>
              <DateTimePickerModal
                isVisible={showDatePicker}
                mode="date"
                onConfirm={(selectedDate) => {
                  setDate(selectedDate);
                  setShowDatePicker(false);
                }}
                onCancel={() => setShowDatePicker(false)}
                themeVariant="light"
              />
            </View>
            {/* Amount */}
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Amount</Text>
              <View style={styles.inputWithIcon}>
                <Text style={styles.currencySymbol}>£</Text>
                <TextInput
                  style={[styles.input, { marginLeft: 0 }]}
                  value={amount.replace(/^£/, '')}
                  onChangeText={setAmount}
                  selectTextOnFocus
                  keyboardType="decimal-pad"
                  editable
                  placeholder="0.00"
                />
              </View>
            </View>
            {/* Supplier */}
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Supplier</Text>
              <View style={styles.inputWithIcon}>
                <TextInput
                  style={styles.input}
                  value={supplier}
                  onChangeText={setSupplier}
                  placeholder="Enter supplier name"
                  placeholderTextColor={Colors.gray400}
                  selectTextOnFocus
                />
              </View>
            </View>
          </View>

          {/* Buttons */}
          <Button
            onPress={handleUpload}
            style={styles.saveButton}
            disabled={uploading}
            loading={uploading}
          >
            Confirm & Save
          </Button>
          <View style={styles.buttonRowCentered}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundPrimary,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  backButton: {
    marginRight: Spacing.md,
    padding: Spacing.xs,
  },
  backArrow: {
    fontSize: 35,
    color: Colors.textPrimary,
    fontWeight: "300",
  },
  title: {
    fontSize: 22,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
  },
  date: {
    fontSize: Typography.md,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  uploadBox: {
    width: '100%',
    aspectRatio: 1.6,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.gray200,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  uploadPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: {
    marginTop: Spacing.md,
    color: Colors.gray400,
    ...Typography.body,
    textAlign: 'center',
  },
  preview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  sectionTitle: {
    fontFamily: Typography.fontBold,
    fontSize: Typography.xl,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
  },
  form: {
    marginBottom: Spacing.lg,
  },
  inputRow: {
    backgroundColor: Colors.gray100,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  inputLabel: {
    ...Typography.body,
    color: Colors.gray400,
    marginBottom: 2,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  input: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
    paddingVertical: 0,
    marginRight: Spacing.md,
    backgroundColor: 'transparent',
  },
  currencySymbol: {
    ...Typography.body,
    color: Colors.textPrimary,
    marginRight: 4,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  dateInputText: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
  },
  saveButton: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  buttonRowCentered: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  retakeButton: {
    borderWidth: 1,
    borderColor: Colors.gray200,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: Colors.backgroundPrimary,
  },
  retakeText: {
    color: Colors.gray500,
    ...Typography.body,
  },

});

export default InvoiceUploadScreen;