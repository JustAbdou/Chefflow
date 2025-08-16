import React, { useState, useRef, useEffect } from 'react';
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
  Modal,
  FlatList,
  Animated,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '../../constants';
import Button from '../../components/ui/Button';
import { getFormattedTodayDate } from '../../utils/dateUtils';
import { addDoc, serverTimestamp, getDocs, getDoc } from "firebase/firestore";
import { useRestaurant } from "../../contexts/RestaurantContext";
import { getRestaurantCollection, getRestaurantDoc } from "../../utils/firestoreHelpers";
import DateTimePickerModal from "react-native-modal-datetime-picker";
const InvoiceUploadScreen = ({ navigation }) => {
  const { restaurantId } = useRestaurant();
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('#INV-2025-0421');
  const [date, setDate] = useState(new Date());
  const [amount, setAmount] = useState('0');
  const [supplier, setSupplier] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editField, setEditField] = useState(null);
  const [supplierModalVisible, setSupplierModalVisible] = useState(false);
  const [supplierList, setSupplierList] = useState([]);
  const animatedListHeight = useRef(new Animated.Value(0)).current;
  const animatedOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (supplierModalVisible) {
      Animated.parallel([
        Animated.timing(animatedListHeight, {
          toValue: 160,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(animatedOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(animatedListHeight, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(animatedOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [supplierModalVisible]);
  useEffect(() => {
    const fetchSuppliers = async () => {
      if (!restaurantId) return;
      try {
        console.log('Fetching suppliers for restaurant:', restaurantId);
        const suppliersDocRef = getRestaurantDoc(restaurantId, 'suppliers', 'suppliers');
        const suppliersDoc = await getDoc(suppliersDocRef);
        if (suppliersDoc.exists()) {
          const data = suppliersDoc.data();
          const suppliersArray = data.names || [];
          console.log('Fetched suppliers:', suppliersArray);
          setSupplierList(suppliersArray);
          if (!supplier && suppliersArray.length > 0) {
            setSupplier(suppliersArray[0]);
          }
        } else {
          console.log('Suppliers document not found, no suppliers available');
          setSupplierList([]);
        }
      } catch (error) {
        console.error('Error fetching suppliers:', error);
        setSupplierList([]);
      }
    };
    fetchSuppliers();
  }, [restaurantId]);
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaType.IMAGE,
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
  const formatDate = (dateObj) => {
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const year = dateObj.getFullYear();
    return `${year}-${month}-${day}`;
  };
  useEffect(() => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    setInvoiceNumber(`#INV-${year}-${month}${day}`);
  }, [date]);
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
          <Text style={styles.sectionTitle}>Invoice Details</Text>
          <View style={styles.form}>
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Invoice Number</Text>
              <View style={styles.inputWithIcon}>
                <TextInput
                  style={styles.input}
                  value={invoiceNumber}
                  editable={false}
                  selectTextOnFocus={false}
                />
              </View>
            </View>
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
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Supplier</Text>
              <TouchableOpacity
                style={[styles.inputWithIcon, { paddingVertical: 0 }]}
                onPress={() => setSupplierModalVisible(!supplierModalVisible)}
                activeOpacity={0.8}
              >
                <Text style={[styles.input, { color: supplier ? Colors.textPrimary : Colors.gray400 }]}>
                  {supplier || 'Select supplier'}
                </Text>
                <Ionicons name={supplierModalVisible ? "chevron-up" : "chevron-down"} size={18} color={Colors.gray400} />
              </TouchableOpacity>
              <Animated.View style={[styles.inlineList, { height: animatedListHeight, opacity: animatedOpacity }]}>
                {supplierModalVisible &&
                  supplierList.map(item => (
                    <TouchableOpacity
                      key={item}
                      style={styles.supplierItem}
                      onPress={() => {
                        setSupplier(item);
                        setSupplierModalVisible(false);
                      }}
                    >
                      <Text style={styles.supplierText}>{item}</Text>
                    </TouchableOpacity>
                  ))}
              </Animated.View>
            </View>
          </View>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: Colors.backgroundPrimary,
    borderRadius: 16,
    padding: Spacing.lg,
    elevation: 4,
  },
  modalTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  supplierItem: {
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
  },
  supplierText: {
    ...Typography.body,
    color: Colors.textPrimary,
  },
  inlineList: {
    backgroundColor: Colors.gray100,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: Spacing.sm,
    elevation: 2,
  },
});
export default InvoiceUploadScreen;