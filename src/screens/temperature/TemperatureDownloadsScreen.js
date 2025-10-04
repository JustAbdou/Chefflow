import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Linking,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '../../constants';
import { getFormattedTodayDate } from '../../utils/dateUtils';
import { getAndroidTitleMargin } from '../../utils/responsive';
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { query, where, getDocs, Timestamp, orderBy, addDoc, serverTimestamp } from "firebase/firestore";
import { useRestaurant } from "../../contexts/RestaurantContext";
import { getRestaurantCollection, getRestaurantSubCollection } from "../../utils/firestoreHelpers";
import { uploadPdfToStorage, uploadPdfToStorageTemporary, generatePdfFileName } from "../../utils/pdfUpload";
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

const TemperatureDownloadsScreen = ({ navigation }) => {
  const { restaurantId } = useRestaurant();
  const [selectedRange, setSelectedRange] = useState(null); // Changed from '7' to null - range buttons gray by default
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [fridgeLogs, setFridgeLogs] = useState([]);
  const [deliveryLogs, setDeliveryLogs] = useState([]);
  const [coolingReheatingLogs, setCoolingReheatingLogs] = useState([]);
  const [coolingLogs, setCoolingLogs] = useState([]);
  const [sousVideLogs, setSousVideLogs] = useState([]);
  const [hotHoldingLogs, setHotHoldingLogs] = useState([]);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [recentDownloads, setRecentDownloads] = useState([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');
  const today = getFormattedTodayDate();

  useEffect(() => {
    const fetchTemperatureRecordsInRange = async () => {
      if (!restaurantId || !startDate || !endDate) return;
      
      const start = Timestamp.fromDate(new Date(startDate.setHours(0,0,0,0)));
      const end = Timestamp.fromDate(new Date(endDate.setHours(23,59,59,999)));
      
      // Fetch fridge logs
      const fridgeQuery = query(
        getRestaurantCollection(restaurantId, "fridgelogs"),
        where("createdAt", ">=", start),
        where("createdAt", "<=", end),
        orderBy("createdAt", "desc")
      );
      const fridgeSnapshot = await getDocs(fridgeQuery);
      setFridgeLogs(fridgeSnapshot.docs.map(doc => ({
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || null,
        type: 'fridge'
      })));

      // Fetch delivery logs
      const deliveryQuery = query(
        getRestaurantCollection(restaurantId, "deliverylogs"),
        where("createdAt", ">=", start),
        where("createdAt", "<=", end),
        orderBy("createdAt", "desc")
      );
      const deliverySnapshot = await getDocs(deliveryQuery);
      setDeliveryLogs(deliverySnapshot.docs.map(doc => ({
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || null,
        type: 'delivery'
      })));

      // Fetch cooling and reheating logs
      const coolingReheatingQuery = query(
        getRestaurantCollection(restaurantId, "coolingreheating"),
        where("createdAt", ">=", start),
        where("createdAt", "<=", end),
        orderBy("createdAt", "desc")
      );
      const coolingReheatingSnapshot = await getDocs(coolingReheatingQuery);
      setCoolingReheatingLogs(coolingReheatingSnapshot.docs.map(doc => ({
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || null,
        type: 'coolingreheating'
      })));

      // Fetch cooling logs (new separate collection)
      const coolingQuery = query(
        getRestaurantCollection(restaurantId, "cooling"),
        where("createdAt", ">=", start),
        where("createdAt", "<=", end),
        orderBy("createdAt", "desc")
      );
      const coolingSnapshot = await getDocs(coolingQuery);
      setCoolingLogs(coolingSnapshot.docs.map(doc => ({
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || null,
        type: 'cooling'
      })));

      // Fetch sous vide logs
      const sousVideQuery = query(
        getRestaurantCollection(restaurantId, "sousvide"),
        where("createdAt", ">=", start),
        where("createdAt", "<=", end),
        orderBy("createdAt", "desc")
      );
      const sousVideSnapshot = await getDocs(sousVideQuery);
      setSousVideLogs(sousVideSnapshot.docs.map(doc => ({
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || null,
        type: 'sousvide'
      })));

      // Fetch hot holding logs
      const hotHoldingQuery = query(
        getRestaurantCollection(restaurantId, "hotholding"),
        where("createdAt", ">=", start),
        where("createdAt", "<=", end),
        orderBy("createdAt", "desc")
      );
      const hotHoldingSnapshot = await getDocs(hotHoldingQuery);
      setHotHoldingLogs(hotHoldingSnapshot.docs.map(doc => ({
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || null,
        type: 'hotholding'
      })));
    };

    fetchTemperatureRecordsInRange();
  }, [startDate, endDate, restaurantId]);

  // Move fetchRecentDownloads outside useEffect so you can call it manually
  const fetchRecentDownloads = async () => {
    if (!restaurantId) return;
    
    try {
      const recentDownloadsRef = getRestaurantSubCollection(
        restaurantId,
        "downloads",
        "temperature", 
        "recent_downloads"
      );
      const q = query(recentDownloadsRef, orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const downloads = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setRecentDownloads(downloads);
    } catch (e) {
      console.error("Failed to fetch recent downloads", e);
    }
  };

  useEffect(() => {
    fetchRecentDownloads();
  }, [restaurantId]);

  const renderDownloadItem = ({ item }) => (
    <TouchableOpacity
      style={styles.downloadItem}
      onPress={() => {
        if (item.link && item.link.startsWith('http')) {
          Linking.openURL(item.link);
        } else {
          Alert.alert('Invalid Link', 'This download link is not accessible.');
        }
      }}
    >
      <MaterialIcons name="description" size={28} color="#FF9800" style={{ marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.downloadName}>
          {(item.name || item.id).replace(/\.pdf$/i, '')}
        </Text>
        <Text style={styles.downloadMeta}>
          {item.createdAt?.toDate
            ? item.createdAt.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : ''}
          {item.isLocalStorage && ' • Local only'}
        </Text>
      </View>
      <TouchableOpacity
        onPress={async (e) => {
          e.stopPropagation();
          if (!item.link) {
            Alert.alert('No Link', 'No download link available for this item.');
            return;
          }
          
          try {
            if (item.isLocalStorage && item.link.startsWith('file')) {
              // Local storage files - direct sharing
              try {
                // Check if file still exists
                const fileInfo = await FileSystem.getInfoAsync(item.link);
                if (fileInfo.exists) {
                  await Sharing.shareAsync(item.link, { mimeType: 'application/pdf' });
                } else {
                  Alert.alert('File Not Found', 'This file is no longer available on the device.');
                }
              } catch (error) {
                console.error('Local file access error:', error);
                Alert.alert('Error', 'Could not access the local file.');
              }
            } else if (item.link.startsWith('http')) {
              // Cloud storage files
              Alert.alert(
                'Download Options',
                'How would you like to access this file?',
                [
                  {
                    text: 'Open in Browser',
                    onPress: () => Linking.openURL(item.link)
                  },
                  {
                    text: 'Download to Device',
                    onPress: async () => {
                      try {
                        const fileUri = FileSystem.documentDirectory + (item.name || 'temperature_records.pdf');
                        const downloadResumable = FileSystem.createDownloadResumable(item.link, fileUri);
                        const result = await downloadResumable.downloadAsync();
                        if (result) {
                          await Sharing.shareAsync(result.uri, { mimeType: 'application/pdf' });
                        }
                      } catch (downloadError) {
                        console.error('Download error:', downloadError);
                        Alert.alert('Download Failed', 'Could not download the file.');
                      }
                    }
                  },
                  {
                    text: 'Cancel',
                    style: 'cancel'
                  }
                ]
              );
            } else if (item.link.startsWith('file')) {
              // Legacy local files
              await Sharing.shareAsync(item.link, { mimeType: 'application/pdf' });
            } else {
              Alert.alert('Invalid Link', 'This download link is not supported.');
            }
          } catch (error) {
            console.error('Error handling download:', error);
            Alert.alert('Error', 'Could not process the download.');
          }
        }}
        style={{ padding: 8 }}
      >
        <Ionicons 
          name={item.isLocalStorage ? "phone-portrait-outline" : 
                item.link && item.link.startsWith('http') ? "cloud-download-outline" : "download-outline"} 
          size={20} 
          color={item.isLocalStorage ? "#f59e0b" : Colors.gray300} 
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const formatDate = (date) => {
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  const exportToPDF = async () => {
    if (!fridgeLogs.length && !deliveryLogs.length && !coolingReheatingLogs.length && !coolingLogs.length && !sousVideLogs.length && !hotHoldingLogs.length) {
      Alert.alert('No Data', 'No temperature records found for the selected date range.');
      return;
    }

    try {
      // Show progress modal
      setIsExporting(true);
      setExportProgress('Preparing temperature data...');

      // Generate unique filename
      const fileName = generatePdfFileName('temperature', startDate, endDate);

      let html = `
        <h1>Temperature Records</h1>
        <p>Generated on: ${new Date().toLocaleDateString('en-GB', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric' 
        })}</p>
        
        <h2>Fridge Temperature Logs</h2>
        <table border="1" cellspacing="0" cellpadding="8" style="width: 100%; border-collapse: collapse;">
          <tr style="background-color: #f5f5f5;">
            <th>Fridge Name</th>
            <th>AM Temperature</th>
            <th>PM Temperature</th>
            <th>Date</th>
          </tr>
          ${fridgeLogs.map(log => `
            <tr>
              <td>${log.fridgeName || 'Unknown'}</td>
              <td>${log.temperatureAM || '--'}°C</td>
              <td>${log.temperaturePM || '--'}°C</td>
              <td>${log.date || (log.createdAt ? log.createdAt.toLocaleDateString('en-GB', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric' 
              }) : '--')}</td>
            </tr>
          `).join('')}
        </table>
        
        <h2>Delivery Temperature Logs</h2>
        <table border="1" cellspacing="0" cellpadding="8" style="width: 100%; border-collapse: collapse;">
          <tr style="background-color: #f5f5f5;">
            <th>Supplier</th>
            <th>Frozen Temp</th>
            <th>Chilled Temp</th>
            <th>Date</th>
          </tr>
          ${deliveryLogs.map(log => `
            <tr>
              <td>${log.supplierName || 'Unknown'}</td>
              <td>${log.frozen || '--'}°C</td>
              <td>${log.chilled || '--'}°C</td>
              <td>${log.date || (log.createdAt ? log.createdAt.toLocaleDateString('en-GB', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric' 
              }) : '--')}</td>
            </tr>
          `).join('')}
        </table>
        
        <h2>Cooking & Reheating Temperature Logs</h2>
        <table border="1" cellspacing="0" cellpadding="8" style="width: 100%; border-collapse: collapse;">
          <tr style="background-color: #f5f5f5;">
            <th>Food Item</th>
            <th>Type</th>
            <th>Temperature</th>
            <th>Date</th>
          </tr>
          ${coolingReheatingLogs.map(log => `
            <tr>
              <td>${log.item || 'Unknown'}</td>
              <td>${log.type || 'Unknown'}</td>
              <td>${log.temperature || '--'}°C</td>
              <td>${log.createdAt ? log.createdAt.toLocaleDateString('en-GB', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric' 
              }) : '--'}</td>
            </tr>
          `).join('')}
        </table>
        
        <h2>Cooling Temperature Logs</h2>
        <table border="1" cellspacing="0" cellpadding="8" style="width: 100%; border-collapse: collapse;">
          <tr style="background-color: #f5f5f5;">
            <th>Food Item</th>
            <th>Start Temp</th>
            <th>Cooling Time</th>
            <th>End Temp</th>
            <th>Date</th>
          </tr>
          ${coolingLogs.map(log => `
            <tr>
              <td>${log.item || 'Unknown'}</td>
              <td>${log.start_temp || '--'}°C</td>
              <td>${log.cooling_time || '--'}</td>
              <td>${log.end_temp || '--'}°C</td>
              <td>${log.createdAt ? log.createdAt.toLocaleDateString('en-GB', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric' 
              }) : '--'}</td>
            </tr>
          `).join('')}
        </table>
        
        <h2>Sous Vide Cooking Logs</h2>
        <table border="1" cellspacing="0" cellpadding="8" style="width: 100%; border-collapse: collapse;">
          <tr style="background-color: #f5f5f5;">
            <th>Food Item</th>
            <th>Weight</th>
            <th>Water Bath Temp</th>
            <th>Cooking Time</th>
            <th>Date</th>
          </tr>
          ${sousVideLogs.map(log => `
            <tr>
              <td>${log.item || 'Unknown'}</td>
              <td>${log.weight || '--'}</td>
              <td>${log.water_bath_temperature || '--'}°C</td>
              <td>${log.cooking_time || '--'}</td>
              <td>${log.createdAt ? log.createdAt.toLocaleDateString('en-GB', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric' 
              }) : '--'}</td>
            </tr>
          `).join('')}
        </table>
        
        <h2>Hot Holding Logs</h2>
        <table border="1" cellspacing="0" cellpadding="8" style="width: 100%; border-collapse: collapse;">
          <tr style="background-color: #f5f5f5;">
            <th>Food Item</th>
            <th>Time</th>
            <th>Temperature</th>
            <th>Date</th>
          </tr>
          ${hotHoldingLogs.map(log => `
            <tr>
              <td>${log.item || 'Unknown'}</td>
              <td>${log.time || '--'}</td>
              <td>${log.temperature || '--'}°C</td>
              <td>${log.createdAt ? log.createdAt.toLocaleDateString('en-GB', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric' 
              }) : '--'}</td>
            </tr>
          `).join('')}
        </table>
      `;

      // Generate PDF locally first
      setExportProgress('Generating PDF document...');
      const { uri } = await Print.printToFileAsync({ 
        html, 
        base64: false, 
        fileName: fileName.replace('.pdf', '') 
      });

      console.log('📄 PDF generated locally:', uri);

      // Attempt to upload to Firebase Storage, with local fallback
      let downloadURL;
      let isLocalStorage = false;
      try {
        setExportProgress('Uploading to cloud storage...');
        console.log('☁️ Attempting Firebase Storage upload...');
        downloadURL = await uploadPdfToStorage(uri, fileName, restaurantId, 'temperature');
        console.log('✅ PDF uploaded to Firebase Storage successfully:', downloadURL);
      } catch (storageError) {
        console.log('⚠️ Firebase Storage upload failed, using local storage fallback:', storageError.message);
        try {
          setExportProgress('Saving to local storage...');
          downloadURL = await uploadPdfToStorageTemporary(uri, fileName, restaurantId, 'temperature');
          console.log('💾 PDF saved to local storage successfully:', downloadURL);
          isLocalStorage = true;
        } catch (localError) {
          console.error('❌ Local storage also failed:', localError);
          throw new Error('Both cloud and local storage failed. Please check your device storage and try again.');
        }
      }

      if (!downloadURL) {
        throw new Error('Failed to generate download URL');
      }

      // Save download info to Firestore with better error handling
      try {
        setExportProgress('Saving record to database...');
        await addDoc(
          getRestaurantSubCollection(restaurantId, "downloads", "temperature", "recent_downloads"),
          {
            name: fileName,
            link: downloadURL,
            isLocalStorage: isLocalStorage,
            createdAt: serverTimestamp(),
          }
        );
        console.log('💾 Download record saved to Firestore');
      } catch (firestoreError) {
        console.error('❌ Failed to save download record:', firestoreError);
        // Don't throw here - the PDF was created successfully, just the record wasn't saved
        setIsExporting(false);
        setTimeout(() => {
          Alert.alert(
            'Warning', 
            'PDF created successfully but failed to save to recent downloads. You can still access the file.',
            [{ text: 'OK' }]
          );
        }, 300);
        return;
      }

      // Clean up the original temporary file (keep the permanent copy)
      try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
        console.log('🗑️ Original temporary file cleaned up');
      } catch (cleanupError) {
        console.warn('⚠️ Could not clean up original temporary file:', cleanupError);
      }

      // Refresh the downloads list
      try {
        setExportProgress('Finalizing...');
        await fetchRecentDownloads();
      } catch (refreshError) {
        console.warn('⚠️ Failed to refresh downloads list:', refreshError);
      }

      // Close progress modal and show success
      setIsExporting(false);
      setTimeout(() => {
        Alert.alert(
          'PDF Generated!', 
          isLocalStorage 
            ? 'Temperature records have been generated and saved locally on this device. Note: The file will only be accessible from this device until cloud storage is available.'
            : 'Temperature records have been generated and uploaded to cloud storage. You can access them from the Recent Downloads section.',
          [
            {
              text: 'View Downloads',
              onPress: () => {
                // The list will automatically refresh if it succeeded
              }
            },
            {
              text: 'OK',
              style: 'default'
            }
          ]
        );
      }, 300);

    } catch (error) {
      console.error('❌ Error exporting PDF:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to export PDF';
      if (error.message.includes('Network request failed') || error.message.includes('network')) {
        errorMessage = 'Network connection failed. Please check your internet connection and try again.';
      } else if (error.message.includes('storage')) {
        errorMessage = 'Storage error occurred. Please try again or contact support.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setIsExporting(false);
      setTimeout(() => {
        Alert.alert(
          'Export Failed', 
          errorMessage,
          [{ text: 'OK' }]
        );
      }, 300);
    }
  };

  const handleRangeSelect = (days) => {
    setSelectedRange(days);
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (parseInt(days) - 1));
    setStartDate(start);
    setEndDate(end);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Temperature Downloads</Text>
            <Text style={styles.date}>{today}</Text>
          </View>
        </View>

        {/* Temperature Records Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconCircle}>
              <Ionicons name="thermometer-outline" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.cardTitle}>Temperature Records</Text>
          </View>
          <TouchableOpacity
            style={styles.cardAction}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('TemperatureRecords')}
          >
            <Text style={styles.cardActionText}>View All Temperature Records</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.gray400} />
          </TouchableOpacity>
        </View>

        {/* Date Range Section */}
        <Text style={styles.sectionTitle}>Select Date Range</Text>
        <View style={styles.dateInputsRow}>
          <TouchableOpacity style={styles.dateInput} onPress={() => setShowStartPicker(true)}>
            <Ionicons name="calendar-outline" size={18} color={Colors.gray400} style={{ marginRight: 8 }} />
            <Text style={styles.dateInputText}>{startDate ? formatDate(startDate) : 'Start Date'}</Text>
          </TouchableOpacity>
          <DateTimePickerModal
            isVisible={showStartPicker}
            mode="date"
            onConfirm={date => { setStartDate(date); setShowStartPicker(false); }}
            onCancel={() => setShowStartPicker(false)}
            themeVariant="light"
          />
          <TouchableOpacity style={styles.dateInput} onPress={() => setShowEndPicker(true)}>
            <Ionicons name="calendar-outline" size={18} color={Colors.gray400} style={{ marginRight: 8 }} />
            <Text style={styles.dateInputText}>{endDate ? formatDate(endDate) : 'End Date'}</Text>
          </TouchableOpacity>
          <DateTimePickerModal
            isVisible={showEndPicker}
            mode="date"
            onConfirm={date => { setEndDate(date); setShowEndPicker(false); }}
            onCancel={() => setShowEndPicker(false)}
            themeVariant="light"
          />
        </View>
        <View style={styles.rangeButtonsRow}>
          <TouchableOpacity
            style={[styles.rangeButton, selectedRange === '7' && styles.rangeButtonActive]}
            onPress={() => handleRangeSelect('7')}
          >
            <Text style={[styles.rangeButtonText, selectedRange === '7' && styles.rangeButtonTextActive]}>Last 7 Days</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.rangeButton, selectedRange === '30' && styles.rangeButtonActive]}
            onPress={() => handleRangeSelect('30')}
          >
            <Text style={[styles.rangeButtonText, selectedRange === '30' && styles.rangeButtonTextActive]}>Last 30 Days</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.rangeButton, selectedRange === '90' && styles.rangeButtonActive]}
            onPress={() => handleRangeSelect('90')}
          >
            <Text style={[styles.rangeButtonText, selectedRange === '90' && styles.rangeButtonTextActive]}>Last 90 Days</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.exportButton} onPress={exportToPDF}>
          <Text style={styles.exportButtonText}>Export Selected Records</Text>
        </TouchableOpacity>

        {/* Recent Downloads */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: Spacing.md}}>
          <Text style={styles.sectionTitle}>Recent Downloads</Text>
          <TouchableOpacity onPress={fetchRecentDownloads} style={{ paddingHorizontal: Spacing.lg }}>
            <Ionicons name="refresh" size={22} color={Colors.primary} />
          </TouchableOpacity>
        </View>
        <FlatList
          data={recentDownloads}
          keyExtractor={item => item.id}
          renderItem={renderDownloadItem}
          scrollEnabled={false}
          contentContainerStyle={{ paddingHorizontal: Spacing.lg }}
        />
      </ScrollView>

      {/* Progress Modal */}
      <Modal
        visible={isExporting}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.progressModalOverlay}>
          <View style={styles.progressModalContent}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.progressTitle}>Exporting PDF</Text>
            <Text style={styles.progressText}>{exportProgress}</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    paddingTop: Spacing.lg + getAndroidTitleMargin(),
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
  titleContainer: {
    flex: 1,
  },
  title: {
    fontFamily: Typography.fontBold,
    fontSize: Typography.xl,
    color: Colors.textPrimary,
    fontWeight: 'bold',
  },
  date: {
    ...Typography.body,
    color: Colors.gray400,
    marginTop: 2,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  cardIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F0FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  cardTitle: {
    fontSize: Typography.lg,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
  },
  cardAction: {
    backgroundColor: Colors.gray50,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  cardActionText: {
    fontSize: Typography.base,
    color: Colors.textPrimary,
    fontFamily: Typography.fontMedium,
  },
  sectionTitle: {
    fontFamily: Typography.fontBold,
    fontSize: Typography.lg,
    color: Colors.textPrimary,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    marginTop: Spacing.md,
  },
  dateInputsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gray100,
    borderRadius: 12,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    flex: 1,
    marginRight: Spacing.md,
  },
  dateInputText: {
    color: Colors.gray400,
    fontFamily: Typography.fontRegular,
    fontSize: Typography.base,
  },
  rangeButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  rangeButton: {
    flex: 1,
    backgroundColor: Colors.gray100,
    borderRadius: 10,
    paddingVertical: Spacing.md,
    marginRight: Spacing.md,
    alignItems: 'center',
  },
  rangeButtonActive: {
    backgroundColor: Colors.primary,
  },
  rangeButtonText: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontMedium,
    fontSize: 14,
  },
  rangeButtonTextActive: {
    color: '#fff',
  },
  exportButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    marginHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  exportButtonText: {
    color: '#fff',
    fontFamily: Typography.fontBold,
    fontSize: Typography.base,
  },
  downloadItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 1,
  },
  downloadName: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sm,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  downloadMeta: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sm,
    color: Colors.gray400,
  },
  downloadLocation: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.xs,
    color: Colors.primary,
    marginTop: 2,
  },
  progressModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: Spacing.xl,
    alignItems: 'center',
    minWidth: 250,
    maxWidth: 300,
  },
  progressTitle: {
    fontSize: Typography.lg,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  progressText: {
    fontSize: Typography.base,
    fontFamily: Typography.fontRegular,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
});

export default TemperatureDownloadsScreen;
