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

      // Calculate totals
      const totalAmount = invoices.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);
      
      let html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Invoice Records</title>
          <style>
            body { 
              font-family: 'Helvetica', Arial, sans-serif; 
              margin: 20px; 
              color: #333; 
              line-height: 1.4;
            }
            .logo-section {
              text-align: center;
              margin-bottom: 25px;
              padding: 15px 0;
            }
            .chefflow-logo {
              display: inline-block;
              font-size: 36px;
              font-weight: 700;
              color: #2563eb;
              text-decoration: none;
              font-family: 'Helvetica', Arial, sans-serif;
              letter-spacing: -1px;
              margin-bottom: 8px;
            }
            .chef-icon {
              font-size: 32px;
              margin-right: 8px;
              vertical-align: middle;
            }
            .tagline {
              color: #6b7280;
              font-size: 12px;
              font-style: italic;
              margin-top: 5px;
            }
            .header { 
              text-align: center; 
              margin-bottom: 30px; 
              border-bottom: 2px solid #2563eb;
              padding: 20px 0;
              background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
              border-radius: 8px;
            }
            .header h1 { 
              color: #2563eb; 
              font-size: 28px; 
              margin: 15px 0 10px 0;
              font-weight: 600;
            }
            .header-info { 
              color: #666; 
              font-size: 14px; 
            }
            .summary-box {
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 15px;
              margin: 20px 0;
              text-align: center;
            }
            .summary-box h3 {
              color: #2563eb;
              margin: 0 0 10px 0;
              font-size: 18px;
            }
            .invoice-table { 
              width: 100%; 
              border-collapse: collapse; 
              margin: 20px 0;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
              border-radius: 8px;
              overflow: hidden;
            }
            .invoice-table th { 
              background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
              color: white; 
              font-weight: 600; 
              font-size: 16px;
              padding: 18px 14px; 
              text-align: center;
              border: none;
            }
            .invoice-table th:first-child { 
              text-align: left;
              border-radius: 8px 0 0 0; 
            }
            .invoice-table th:last-child { border-radius: 0 8px 0 0; }
            .invoice-table td { 
              padding: 14px 12px; 
              border-bottom: 1px solid #f1f5f9;
              font-size: 15px;
              text-align: center;
            }
            .invoice-table td:first-child {
              text-align: left;
            }
            .invoice-table tr:nth-child(even) { 
              background-color: #f8fafc; 
            }
            .invoice-table tr:hover { 
              background-color: #e0f2fe; 
            }
            .amount-cell { 
              text-align: center; 
              font-weight: 600; 
              color: #059669;
              font-size: 16px;
            }
            .date-cell { 
              color: #6b7280;
              font-size: 14px;
              text-align: center;
            }
            .supplier-cell {
              font-weight: 500;
              color: #374151;
              text-align: center;
              font-size: 15px;
            }
            .invoice-number {
              font-family: 'Courier New', monospace;
              background-color: #eff6ff;
              padding: 6px 10px;
              border-radius: 4px;
              font-size: 14px;
              color: #1d4ed8;
              font-weight: 600;
            }
            .totals-row { 
              background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
              color: white; 
              font-weight: 700;
              border-top: 3px solid #15803d;
            }
            .totals-row td { 
              padding: 16px 12px;
              border: none;
              font-size: 15px;
            }
            .total-amount {
              font-size: 20px;
              text-align: center;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              color: #6b7280;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="logo-section">
            <div class="chefflow-logo">
              <span class="chef-icon">👨‍🍳</span>ChefFlow
            </div>
            <div class="tagline">Restaurant Management System</div>
          </div>
          
          <div class="header">
            <h1>📋 Invoice Records Report</h1>
            <div class="header-info">
              <strong>Generated:</strong> ${new Date().toLocaleDateString('en-GB', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}<br>
              <strong>Period:</strong> ${startDate ? startDate.toLocaleDateString('en-GB') : ''} - ${endDate ? endDate.toLocaleDateString('en-GB') : ''}
            </div>
          </div>

          <div class="summary-box">
            <h3>📊 Summary</h3>
            <p><strong>${invoices.length}</strong> invoice${invoices.length === 1 ? '' : 's'} • Total Value: <strong style="color: #16a34a;">£${totalAmount.toFixed(2)}</strong></p>
          </div>

          <table class="invoice-table">
            <thead>
              <tr>
                <th style="width: 30%;">Invoice Number</th>
                <th style="width: 35%;">Supplier</th>
                <th style="width: 20%;">Amount</th>
                <th style="width: 15%;">Date</th>
              </tr>
            </thead>
            <tbody>
              ${invoices.map((inv, index) => `
                <tr>
                  <td><span class="invoice-number">${inv.invoiceNumber || `INV-${String(index + 1).padStart(3, '0')}`}</span></td>
                  <td class="supplier-cell">${inv.supplier || 'Unknown Supplier'}</td>
                  <td class="amount-cell">£${parseFloat(inv.amount || 0).toFixed(2)}</td>
                  <td class="date-cell">${inv.date ? new Date(inv.date).toLocaleDateString('en-GB', { 
                    day: '2-digit', 
                    month: 'short', 
                    year: 'numeric' 
                  }) : 'N/A'}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr class="totals-row">
                <td colspan="2" style="text-align: right; font-size: 18px;">
                  <strong>📋 GRAND TOTAL (${invoices.length} invoice${invoices.length === 1 ? '' : 's'})</strong>
                </td>
                <td class="total-amount" style="font-size: 20px;">
                  <strong>£${totalAmount.toFixed(2)}</strong>
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>

          <div class="footer">
            <p>This report was automatically generated by <strong>ChefFlow</strong> restaurant management system.<br>
            All amounts are in British Pounds (GBP). Report generated at ${new Date().toLocaleTimeString('en-GB')}.</p>
          </div>
        </body>
        </html>
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