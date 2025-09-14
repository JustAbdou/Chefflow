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

const InvoicesDownloadsScreen = ({ navigation }) => {
  const { restaurantId } = useRestaurant();
  const [selectedRange, setSelectedRange] = useState(null); // Changed from '7' to null
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [recentDownloads, setRecentDownloads] = useState([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');
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
      <MaterialIcons name="description" size={28} color="#E53935" style={{ marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.downloadName}>
          {(item.name || item.id).replace(/\.pdf$/i, '')}
        </Text>
        <Text style={styles.downloadMeta}>
          {item.createdAt?.toDate
            ? item.createdAt.toDate().toLocaleDateString()
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
    // Implement your date formatting logic here
    return date.toLocaleDateString();
  };

  const exportToPDF = async () => {
    if (!invoices.length) {
      Alert.alert('No Data', 'No invoices found for the selected date range.');
      return;
    }

    try {
      // Show progress modal
      setIsExporting(true);
      setExportProgress('Preparing invoice data...');

      // Generate unique filename
      const fileName = generatePdfFileName('invoice', startDate, endDate);

      // Calculate total value
      const totalValue = invoices.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);

      let html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Invoice Records Report</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
              margin: 0;
              padding: 40px;
              color: #333;
              line-height: 1.4;
            }
            .header {
              text-align: center;
              margin-bottom: 40px;
              border-bottom: 2px solid #e5e7eb;
              padding-bottom: 30px;
            }
            .logo {
              font-size: 32px;
              font-weight: bold;
              color: #2563eb;
              margin-bottom: 8px;
            }
            .subtitle {
              color: #6b7280;
              font-size: 14px;
              margin-bottom: 30px;
            }
            .report-title {
              font-size: 24px;
              font-weight: bold;
              color: #1f2937;
              margin-bottom: 15px;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 10px;
            }
            .report-meta {
              color: #6b7280;
              font-size: 14px;
              margin-bottom: 5px;
            }
            .summary-section {
              background-color: #f8fafc;
              border-radius: 8px;
              padding: 20px;
              margin: 30px 0;
              border-left: 4px solid #2563eb;
            }
            .summary-title {
              font-size: 18px;
              font-weight: bold;
              color: #1f2937;
              margin-bottom: 15px;
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .summary-content {
              font-size: 16px;
              color: #374151;
            }
            .summary-value {
              color: #16a34a;
              font-weight: bold;
              font-size: 18px;
            }
            .table-container {
              margin: 30px 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              background: white;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            th {
              background-color: #f8fafc;
              color: #374151;
              font-weight: 600;
              padding: 16px 12px;
              text-align: left;
              border-bottom: 2px solid #e5e7eb;
              font-size: 14px;
            }
            td {
              padding: 14px 12px;
              border-bottom: 1px solid #f1f5f9;
              font-size: 14px;
            }
            tr:nth-child(even) {
              background-color: #fafbfc;
            }
            tr:hover {
              background-color: #f1f5f9;
            }
            .invoice-number {
              color: #2563eb;
              font-weight: 600;
            }
            .amount {
              font-weight: 600;
              color: #059669;
            }
            .total-section {
              background-color: #1f2937;
              color: white;
              padding: 20px;
              border-radius: 8px;
              margin: 30px 0;
              text-align: center;
            }
            .total-label {
              font-size: 16px;
              margin-bottom: 5px;
            }
            .total-value {
              font-size: 24px;
              font-weight: bold;
              color: #10b981;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              color: #6b7280;
              font-size: 12px;
              line-height: 1.6;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">👨‍🍳 ChefFlow</div>
            <div class="subtitle">Restaurant Management System</div>
            <div class="report-title">
              📋 Invoice Records Report
            </div>
            <div class="report-meta">Generated: ${new Date().toLocaleDateString('en-GB', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</div>
            <div class="report-meta">Period: ${startDate ? startDate.toLocaleDateString('en-GB') : ''} - ${endDate ? endDate.toLocaleDateString('en-GB') : ''}</div>
          </div>

          <div class="summary-section">
            <div class="summary-title">📊 Summary</div>
            <div class="summary-content">
              <strong>${invoices.length}</strong> invoices • Total Value: <span class="summary-value">£${totalValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Invoice Number</th>
                  <th>Supplier</th>
                  <th>Amount</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                ${invoices.map(inv => `
                  <tr>
                    <td class="invoice-number">${inv.invoiceNumber || 'N/A'}</td>
                    <td>${inv.supplier || 'Unknown'}</td>
                    <td class="amount">£${(parseFloat(inv.amount) || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td>${inv.createdAt ? inv.createdAt.toLocaleDateString('en-GB', { 
                      day: 'numeric',
                      month: 'short', 
                      year: 'numeric'
                    }) : 'N/A'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="total-section">
            <div class="total-label">📊 GRAND TOTAL (${invoices.length} invoices)</div>
            <div class="total-value">£${totalValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>

          <div class="footer">
            This report was automatically generated by <strong>ChefFlow</strong> restaurant management system.<br>
            All amounts are in British Pounds (GBP). Report generated at ${new Date().toLocaleTimeString('en-GB', { hour12: false })}.
          </div>
        </body>
        </html>
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
        downloadURL = await uploadPdfToStorage(uri, fileName, restaurantId, 'invoices');
        console.log('✅ PDF uploaded to Firebase Storage successfully:', downloadURL);
      } catch (storageError) {
        console.log('⚠️ Firebase Storage upload failed, using local storage fallback:', storageError.message);
        setExportProgress('Saving to local storage...');
        // Use local storage as fallback
        downloadURL = await uploadPdfToStorageTemporary(uri, fileName, restaurantId, 'invoices');
        console.log('💾 PDF saved to local storage:', downloadURL);
        isLocalStorage = true;
      }

      // Save download info to Firestore with the download URL
      setExportProgress('Saving record to database...');
      await addDoc(
        getRestaurantSubCollection(restaurantId, "downloads", "invoices", "recent_downloads"),
        {
          name: fileName,
          link: downloadURL,
          isLocalStorage: isLocalStorage, // Flag to indicate storage type
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
      setExportProgress('Finalizing...');
      await fetchRecentDownloads();

      // Close progress modal and show success
      setIsExporting(false);
      setTimeout(() => {
        Alert.alert(
          'PDF Generated!', 
          isLocalStorage 
            ? 'Invoice records have been generated and saved locally on this device. Note: The file will only be accessible from this device until cloud storage is available.'
            : 'Invoice records have been generated and uploaded to cloud storage. You can access them from the Recent Downloads section.',
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
      }, 300);

    } catch (error) {
      console.error('❌ Error exporting PDF:', error);
      setIsExporting(false);
      setTimeout(() => {
        Alert.alert(
          'Export Failed', 
          'Failed to export PDF: ' + error.message,
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
        <View style={styles.headerRow}>
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

export default InvoicesDownloadsScreen;