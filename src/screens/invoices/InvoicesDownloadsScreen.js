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
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '../../constants';
import { getFormattedTodayDate } from '../../utils/dateUtils';
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { query, where, getDocs, Timestamp, orderBy, addDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { useRestaurant } from "../../contexts/RestaurantContext";
import { getRestaurantCollection, getRestaurantSubCollection } from "../../utils/firestoreHelpers";
import { uploadPdfToStorage, uploadPdfToStorageTemporary, generatePdfFileName } from "../../utils/pdfUpload";
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

const InvoicesDownloadsScreen = ({ navigation }) => {
  const { restaurantId } = useRestaurant();
  const [selectedRange, setSelectedRange] = useState(null); // Changed from '7' to null
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [recentDownloads, setRecentDownloads] = useState([]);
  const today = getFormattedTodayDate();

  useEffect(() => {
    const fetchInvoicesInRange = async () => {
      if (!restaurantId || !startDate || !endDate) return;
      
      const start = Timestamp.fromDate(new Date(startDate.setHours(0,0,0,0)));
      const end = Timestamp.fromDate(new Date(endDate.setHours(23,59,59,999)));
      const q = query(
        getRestaurantCollection(restaurantId, "invoices"),
        where("createdAt", ">=", start),
        where("createdAt", "<=", end)
      );
      const snapshot = await getDocs(q);
      setInvoices(snapshot.docs.map(doc => ({
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || null,
      })));
    };

    fetchInvoicesInRange();
  }, [startDate, endDate, restaurantId]);

  // Move fetchRecentDownloads outside useEffect so you can call it manually
  const fetchRecentDownloads = async () => {
    if (!restaurantId) return;
    
    try {
      const recentDownloadsRef = getRestaurantSubCollection(
        restaurantId,
        "downloads",
        "invoices", 
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

  const renderDownloadItem = ({ item }) => {
    // Helper function to handle local file access
    const handleLocalFileAccess = async (fileUri) => {
      try {
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (fileInfo.exists) {
          await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf' });
        } else {
          Alert.alert(
            'File Not Found', 
            'This file is no longer accessible. It may have been moved or deleted.',
            [
              {
                text: 'Remove Invalid Download',
                onPress: () => removeInvalidDownload(item.id),
                style: 'destructive'
              },
              {
                text: 'OK',
                style: 'cancel'
              }
            ]
          );
        }
      } catch (error) {
        console.error('Error accessing local file:', error);
        Alert.alert('Error', 'Could not access this file.');
      }
    };

    // Helper function to remove invalid downloads
    const removeInvalidDownload = async (downloadId) => {
      try {
        const downloadRef = getRestaurantSubCollection(
          restaurantId,
          "downloads",
          "invoices", 
          "recent_downloads"
        ).doc(downloadId);
        await deleteDoc(downloadRef);
        
        // Update local state
        setRecentDownloads(prev => prev.filter(download => download.id !== downloadId));
        Alert.alert('Success', 'Invalid download removed.');
      } catch (error) {
        console.error('Error removing invalid download:', error);
        Alert.alert('Error', 'Could not remove the invalid download.');
      }
    };

    return (
      <TouchableOpacity
        style={styles.downloadItem}
        onPress={() => {
          if (item.link && item.link.startsWith('http')) {
            Linking.openURL(item.link);
          } else if (item.link && item.link.startsWith('file')) {
            handleLocalFileAccess(item.link);
          } else {
            Alert.alert('Invalid Link', 'This download link is not accessible.');
          }
        }}
      >
        <MaterialIcons name="description" size={28} color="#E53935" style={{ marginRight: 12 }} />
        <View style={{ flex: 1 }}>
          <Text style={styles.downloadName}>
            {(item.name || item.id).replace(/\.pdf$/i, '')}
          </Text>
          <Text style={styles.downloadMeta}>
            {item.createdAt?.toDate
              ? item.createdAt.toDate().toLocaleDateString()
              : ''}
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
              if (item.link.startsWith('http')) {
                // For cloud URLs, we can either open in browser or download
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
                          const fileUri = FileSystem.documentDirectory + (item.name || 'invoice.pdf');
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
                // Local files - use the helper function
                await handleLocalFileAccess(item.link);
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
            name={item.link && item.link.startsWith('http') ? "cloud-download-outline" : "download-outline"} 
            size={20} 
            color={Colors.gray300} 
          />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const formatDate = (date) => {
    // Implement your date formatting logic here
    return date.toLocaleDateString();
  };

  const exportToPDF = async () => {
    if (!invoices.length) {
      Alert.alert('No Data', 'No invoices found for the selected date range.');
      return;
    }

    try {
      // Show loading state
      Alert.alert('Generating PDF', 'Please wait while we prepare your invoice records...');

      // Generate unique filename
      const fileName = generatePdfFileName('invoice', startDate, endDate);

      let html = `
        <h1>Invoice Records</h1>
        <p>Generated on: ${new Date().toLocaleDateString()}</p>
        <p>Period: ${startDate ? startDate.toLocaleDateString() : ''} to ${endDate ? endDate.toLocaleDateString() : ''}</p>
        
        <table border="1" cellspacing="0" cellpadding="8" style="width: 100%; border-collapse: collapse;">
          <tr style="background-color: #f5f5f5;">
            <th>Invoice Number</th>
            <th>Supplier</th>
            <th>Amount</th>
            <th>Date</th>
            <th>Photos</th>
          </tr>
          ${invoices.map(inv => `
            <tr>
              <td>${inv.invoiceNumber || 'N/A'}</td>
              <td>${inv.supplier || 'Unknown'}</td>
              <td>£${inv.amount || '0.00'}</td>
              <td>${inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : 'N/A'}</td>
              <td>${inv.images && inv.images.length > 0 ? `${inv.images.length} photo${inv.images.length === 1 ? '' : 's'}` : 'No photos'}</td>
            </tr>
          `).join('')}
        </table>
        
        <p style="margin-top: 20px; font-size: 12px; color: #666;">
          Total Invoices: ${invoices.length}<br>
          Total Amount: £${invoices.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0).toFixed(2)}
        </p>
      `;

      // Generate PDF locally first
      const { uri } = await Print.printToFileAsync({ 
        html, 
        base64: false, 
        fileName: fileName.replace('.pdf', '') 
      });

      console.log('📄 PDF generated locally:', uri);

      // Use temporary storage solution until Firebase Storage blob issues are resolved
      let downloadURL;
      try {
        // Try the original method first
        downloadURL = await uploadPdfToStorage(uri, fileName, restaurantId, 'invoices');
        console.log('☁️ PDF uploaded to Firebase Storage successfully:', downloadURL);
      } catch (storageError) {
        console.log('⚠️ Firebase Storage upload failed, using temporary local storage:', storageError.message);
        // Use temporary local storage as fallback
        downloadURL = await uploadPdfToStorageTemporary(uri, fileName, restaurantId, 'invoices');
        console.log('💾 PDF saved to local storage:', downloadURL);
        
        // Alert user about local storage limitation
        Alert.alert(
          'Local Storage Used',
          'Your PDF has been saved locally. Note that local files may have limited accessibility across app sessions.',
          [{ text: 'OK' }]
        );
      }

      // Save download info to Firestore with the cloud URL
      await addDoc(
        getRestaurantSubCollection(restaurantId, "downloads", "invoices", "recent_downloads"),
        {
          name: fileName,
          link: downloadURL, // This is now a cloud URL, not local path
          createdAt: serverTimestamp(),
        }
      );

      console.log('💾 Download record saved to Firestore');

      // Clean up the original temporary file (keep the permanent copy)
      try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
        console.log('🗑️ Original temporary file cleaned up');
      } catch (cleanupError) {
        console.warn('⚠️ Could not clean up original temporary file:', cleanupError);
      }

      // Refresh the downloads list
      await fetchRecentDownloads();

      Alert.alert(
        'Success!', 
        'Invoice records have been generated and saved. You can access them from the Recent Downloads section.',
        [
          {
            text: 'View Downloads',
            onPress: () => {
              // The list will automatically refresh
            }
          },
          {
            text: 'OK',
            style: 'default'
          }
        ]
      );

    } catch (error) {
      console.error('❌ Error exporting PDF:', error);
      Alert.alert(
        'Export Failed', 
        'Failed to export PDF: ' + error.message,
        [{ text: 'OK' }]
      );
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
        <View style={[styles.headerRow]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Downloads</Text>
            <Text style={styles.date}>{today}</Text>
          </View>
        </View>

        {/* Invoices Records Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconCircle}>
              <Ionicons name="document-text-outline" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.cardTitle}>Invoices Records</Text>
          </View>
          <TouchableOpacity
            style={styles.cardAction}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Invoices')}
          >
            <Text style={styles.cardActionText}>View All Invoices</Text>
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  appTitle: {
    fontSize: Typography.xxl,
    fontFamily: Typography.fontBold,
    color: Colors.primary,
    textAlign: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.md,
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
    marginTop: Spacing.xl,
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
    color: Colors.gray400,
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
});

export default InvoicesDownloadsScreen;