import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from "@expo/vector-icons";
import NetInfo from '@react-native-community/netinfo';
import { Colors } from '../../constants/Colors';
import { Typography } from '../../constants/Typography';
import { Spacing } from '../../constants/Spacing';
import { getAndroidTitleMargin } from '../../utils/responsive';
import useNavigationBar from '../../hooks/useNavigationBar';
import { useNavigation } from '@react-navigation/native';
import { useRestaurant } from '../../contexts/RestaurantContext';
import { auth } from '../../../firebase';
import { addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { getRestaurantCollection } from '../../utils/firestoreHelpers';
import { uploadPdfToStorage, uploadPdfToStorageTemporary, generatePdfFileName } from '../../utils/pdfUpload';
import { addHandoverOffline } from '../../utils/offlineSync';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';

function HandoverScreen() {
  const navigation = useNavigation();
  const { restaurantId } = useRestaurant();
  const [serviceNotes, setServiceNotes] = useState('');
  const [stockIssues, setStockIssues] = useState('');
  const [problemsDuringShift, setProblemsDuringShift] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState('');

  // Hide Android navigation bar
  const navigationBar = useNavigationBar();
  navigationBar.useHidden(); // Use hidden mode for complete immersion

  // Monitor network status
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
    });
    return unsubscribe;
  }, []);

  // Get current date
  const getCurrentDate = () => {
    const date = new Date();
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  const handleCompleteHandover = () => {
    Alert.alert(
      "Complete Handover",
      "Are you sure you want to complete this handover? This action cannot be undone.",
      [
        {
          text: "Back to Edit",
          style: "cancel",
          onPress: () => console.log("User chose to continue editing")
        },
        {
          text: "Confirm",
          style: "default",
          onPress: () => submitHandoverToFirestore()
        }
      ]
    );
  };

  const submitHandoverToFirestore = async () => {
    if (!restaurantId) {
      Alert.alert("Error", "Restaurant information not available. Please try again.");
      return;
    }

    if (!auth.currentUser) {
      Alert.alert("Error", "User not authenticated. Please log in again.");
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('📝 Submitting handover...');
      
      // Prepare handover data
      const handoverData = {
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser.uid,
        restaurantId: restaurantId,
        pdf: '', // Will be updated after PDF generation
        problems: problemsDuringShift.trim() !== '',
        serviceNotes: serviceNotes.trim() !== '',
        stockIssues: stockIssues.trim() !== '',
        // Store the actual text content as well
        serviceNotesText: serviceNotes.trim(),
        stockIssuesText: stockIssues.trim(),
        problemsDuringShiftText: problemsDuringShift.trim(),
      };

      console.log('📋 Handover data:', handoverData);

      if (isOffline) {
        console.log('📱 Offline mode: adding handover to pending queue');
        await addHandoverOffline(restaurantId, handoverData);
        
        Alert.alert(
          "Handover Saved",
          "Your handover has been saved and will be synced when you're back online.",
          [
            {
              text: "OK",
              onPress: () => {
                // Navigate to completion screen
                navigation.navigate('HandoverCompletion', {
                  handoverData: {
                    serviceNotes: handoverData.serviceNotes,
                    stockIssues: handoverData.stockIssues,
                    problems: handoverData.problems,
                    docId: 'offline',
                    isOffline: true,
                  }
                });
              }
            }
          ]
        );
      } else {
        // Online: save directly to Firestore
        const handoversCollection = getRestaurantCollection(restaurantId, 'handovers');
        const docRef = await addDoc(handoversCollection, handoverData);
        console.log('✅ Handover submitted successfully with ID:', docRef.id);

        // Generate PDF for this handover
        try {
          setIsGeneratingPdf(true);
          setPdfProgress('Generating handover PDF...');
          console.log('📄 Generating PDF for handover...');
          const pdfResult = await generateHandoverPDF(handoverData, docRef.id);
          
          if (pdfResult && pdfResult.downloadURL) {
            setPdfProgress('Saving PDF information...');
            // Update the handover document with the PDF URL and storage type
            await updateDoc(docRef, { 
              pdf: pdfResult.downloadURL,
              isLocalStorage: pdfResult.isLocalStorage 
            });
            console.log('✅ PDF generated and URL saved:', pdfResult.downloadURL);
          }
          setIsGeneratingPdf(false);
        } catch (pdfError) {
          console.error('⚠️ PDF generation failed, but handover was saved:', pdfError);
          setIsGeneratingPdf(false);
          // Don't fail the entire operation if PDF generation fails
        }
        
        // Navigate to completion screen with handover data
        navigation.navigate('HandoverCompletion', {
          handoverData: {
            serviceNotes: handoverData.serviceNotes,
            stockIssues: handoverData.stockIssues,
            problems: handoverData.problems,
            docId: docRef.id,
          }
        });
      }
    } catch (error) {
      console.error('❌ Error submitting handover:', error);
      Alert.alert(
        "Submission Failed", 
        "There was an error submitting your handover. Please check your connection and try again.",
        [
          {
            text: "OK",
            onPress: () => setIsSubmitting(false)
          }
        ]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generate PDF for individual handover
  const generateHandoverPDF = async (handoverData, docId) => {
    try {
      const currentDate = new Date();
      const fileName = `handover_${docId}_${currentDate.toISOString().split('T')[0]}.pdf`;

      // Determine handover status
      let status = 'Clean Shift';
      if (handoverData.problems) status = 'Problems Reported';
      else if (handoverData.stockIssues) status = 'Stock Issues';
      else if (handoverData.serviceNotes) status = 'Notes Available';

      // Create HTML for PDF
      const html = `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              .header { text-align: center; margin-bottom: 30px; }
              .header h1 { color: #007AFF; margin-bottom: 10px; }
              .header p { color: #666; }
              .section { margin-bottom: 25px; }
              .section h2 { color: #333; border-bottom: 2px solid #007AFF; padding-bottom: 5px; }
              .status { 
                padding: 10px; 
                border-radius: 5px; 
                margin-bottom: 20px;
                font-weight: bold;
              }
              .status.clean { background-color: #d4edda; color: #155724; }
              .status.issues { background-color: #f8d7da; color: #721c24; }
              .status.notes { background-color: #cce5ff; color: #004085; }
              .content { background-color: #f8f9fa; padding: 15px; border-radius: 5px; }
              .empty { color: #999; font-style: italic; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Kitchen Handover Report</h1>
              <p>Generated on: ${currentDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} at ${currentDate.toLocaleTimeString('en-GB')}</p>
            </div>
            
            <div class="status ${status.includes('Problems') ? 'issues' : status.includes('Stock') ? 'issues' : status.includes('Notes') ? 'notes' : 'clean'}">
              Status: ${status}
            </div>
            
            <div class="section">
              <h2>Service Notes</h2>
              <div class="content">
                ${handoverData.serviceNotesText || '<span class="empty">No service notes provided</span>'}
              </div>
            </div>
            
            <div class="section">
              <h2>Stock Issues</h2>
              <div class="content">
                ${handoverData.stockIssuesText || '<span class="empty">No stock issues reported</span>'}
              </div>
            </div>
            
            <div class="section">
              <h2>Problems During Shift</h2>
              <div class="content">
                ${handoverData.problemsDuringShiftText || '<span class="empty">No problems reported</span>'}
              </div>
            </div>
            
            <div style="margin-top: 40px; text-align: center; color: #666; font-size: 12px;">
              <p>This handover was submitted by a ChefFlow user and is for internal use only.</p>
              <p>Document ID: ${docId}</p>
            </div>
          </body>
        </html>
      `;

      // Generate PDF locally
      setPdfProgress('Creating PDF document...');
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
        setPdfProgress('Uploading to cloud storage...');
        console.log('☁️ Attempting Firebase Storage upload...');
        downloadURL = await uploadPdfToStorage(uri, fileName, restaurantId, 'handovers');
        console.log('✅ PDF uploaded to Firebase Storage successfully:', downloadURL);
      } catch (storageError) {
        console.log('⚠️ Firebase Storage upload failed, using local storage fallback:', storageError.message);
        setPdfProgress('Saving to local storage...');
        downloadURL = await uploadPdfToStorageTemporary(uri, fileName, restaurantId, 'handovers');
        console.log('💾 PDF saved to local storage:', downloadURL);
        isLocalStorage = true;
      }

      // Clean up the original temporary file
      try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
        console.log('🗑️ Original temporary file cleaned up');
      } catch (cleanupError) {
        console.warn('⚠️ Could not clean up original temporary file:', cleanupError);
      }

      return { downloadURL, isLocalStorage };

    } catch (error) {
      console.error('❌ Error generating handover PDF:', error);
      throw error;
    }
  };

  const handlePreviousHandovers = () => {
    // Navigate to previous handovers screen
    navigation.navigate('PreviousHandovers');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
       

        {/* Title and Date */}
        <View style={styles.titleContainer}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>‹</Text>
          </TouchableOpacity>
          <View style={styles.titleInfo}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Kitchen Handover</Text>
              {isOffline && (
                <View style={styles.offlineIndicator}>
                  <Ionicons name="cloud-offline-outline" size={16} color="#dc2626" />
                  <Text style={styles.offlineText}>Offline</Text>
                </View>
              )}
            </View>
            <Text style={styles.date}>{getCurrentDate()}</Text>
          </View>
        </View>

        {/* Service Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service Notes</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="How was today's service? any notable events?"
              placeholderTextColor={Colors.gray400}
              value={serviceNotes}
              onChangeText={setServiceNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* Stock Issues */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stock Issues</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="List any stock shortages or quality issues"
              placeholderTextColor={Colors.gray400}
              value={stockIssues}
              onChangeText={setStockIssues}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* Problems During Shift */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Problems During Shift</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Equipment issues, timing problems, etc."
              placeholderTextColor={Colors.gray400}
              value={problemsDuringShift}
              onChangeText={setProblemsDuringShift}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* Previous Handovers */}
        <TouchableOpacity style={styles.previousHandoversButton} onPress={handlePreviousHandovers}>
          <Text style={styles.previousHandoversText}>Previous Handovers</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        {/* Spacer for bottom button */}
        <View style={styles.spacer} />
      </ScrollView>

      {/* Complete Handover Button */}
      <View style={styles.bottomButtonContainer}>
        <TouchableOpacity 
          style={[styles.completeButton, isSubmitting && styles.completeButtonDisabled]} 
          onPress={handleCompleteHandover}
          disabled={isSubmitting}
        >
          <Text style={styles.completeButtonText}>
            {isSubmitting ? 'Submitting...' : 'Complete Handover'}
          </Text>
        </TouchableOpacity>
      </View>
      </KeyboardAvoidingView>

      {/* PDF Generation Progress Modal */}
      <Modal
        visible={isGeneratingPdf}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.progressModalOverlay}>
          <View style={styles.progressModalContent}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.progressTitle}>Generating Handover PDF</Text>
            <Text style={styles.progressText}>{pdfProgress}</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg + getAndroidTitleMargin(),
    paddingBottom: Spacing.md,
  },
  appTitle: {
    fontSize: Typography.xxl,
    fontFamily: Typography.fontBold,
    color: Colors.primary,
    textAlign: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  backButton: {
    padding: Spacing.sm,
    marginRight: Spacing.sm,
  },
  backButtonText: {
    fontSize: 32,
    color: Colors.textPrimary,
    fontWeight: '300',
  },
  titleInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 22,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
    flex: 1,
  },
  offlineIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fca5a5",
  },
  offlineText: {
    fontSize: 12,
    fontFamily: Typography.fontMedium,
    color: "#dc2626",
    marginLeft: 4,
  },
  date: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  section: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: Typography.lg,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  inputContainer: {
    backgroundColor: Colors.gray50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 120,
  },
  textInput: {
    padding: Spacing.md,
    fontSize: Typography.base,
    color: Colors.textPrimary,
    minHeight: 120,
  },
  previousHandoversButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.lg,
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.lg,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  previousHandoversText: {
    fontSize: Typography.base,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  chevron: {
    fontSize: 20,
    color: Colors.gray400,
  },
  spacer: {
    height: 100, // Space for the bottom button
  },
  bottomButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.background,
  },
  completeButton: {
    backgroundColor: '#00C896',
    paddingVertical: Spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  completeButtonText: {
    color: "#ffffff",
    fontSize: Typography.lg,
    fontFamily: Typography.fontBold,
  },
  completeButtonDisabled: {
    backgroundColor: Colors.gray400,
    opacity: 0.6,
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

export default HandoverScreen;
