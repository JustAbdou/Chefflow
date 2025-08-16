import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity, 
  TextInput, 
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { Typography } from '../../constants/Typography';
import { Spacing } from '../../constants/Spacing';
import useNavigationBar from '../../hooks/useNavigationBar';
import { useNavigation } from '@react-navigation/native';
import { useRestaurant } from '../../contexts/RestaurantContext';
import { auth } from '../../../firebase';
import { addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { getRestaurantCollection } from '../../utils/firestoreHelpers';
import { uploadPdfToStorage, uploadPdfToStorageTemporary } from '../../utils/pdfUpload';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';

function HandoverScreen() {
  const navigation = useNavigation();
  const { restaurantId } = useRestaurant();
  const [serviceNotes, setServiceNotes] = useState('');
  const [stockIssues, setStockIssues] = useState('');
  const [problemsDuringShift, setProblemsDuringShift] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Hide Android navigation bar
  const navigationBar = useNavigationBar();
  navigationBar.useHidden(); // Use hidden mode for complete immersion

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
      console.log('📝 Submitting handover to Firestore...');
      
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

      // Get handovers collection reference
      const handoversCollection = getRestaurantCollection(restaurantId, 'handovers');
      
      // Submit to Firestore first
      const docRef = await addDoc(handoversCollection, handoverData);
      console.log('✅ Handover submitted successfully with ID:', docRef.id);

      // Generate PDF for this handover
      let pdfUrl = '';
      try {
        console.log('📄 Generating PDF for handover...');
        pdfUrl = await generateHandoverPDF(handoverData, docRef.id);
        
        if (pdfUrl) {
          // Update the handover document with the PDF URL
          await updateDoc(docRef, { pdf: pdfUrl });
          console.log('✅ PDF generated and URL saved:', pdfUrl);
        } else {
          console.warn('⚠️ PDF generation returned empty URL');
        }
      } catch (pdfError) {
        console.error('⚠️ PDF generation failed, but handover was saved:', pdfError);
        // Show a warning but don't fail the entire operation
        Alert.alert(
          "Handover Saved", 
          "Your handover was saved successfully, but we couldn't generate the PDF. You can still view it in Previous Handovers.",
          [{ text: "OK" }]
        );
      }
      
      // Navigate to completion screen with handover data
      navigation.navigate('HandoverCompletion', {
        handoverData: {
          serviceNotes: handoverData.serviceNotes,
          stockIssues: handoverData.stockIssues,
          problems: handoverData.problems,
          docId: docRef.id,
          pdfUrl: pdfUrl,
        }
      });

    } catch (error) {
      console.error('❌ Error submitting handover:', error);
      Alert.alert(
        "Submission Failed", 
        "There was an error submitting your handover. Please check your connection and try again.",
        [
          {
            text: "OK",
            onPress: () => {}
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
      console.log('🚀 Starting PDF generation process...');
      const currentDate = new Date();
      const fileName = `handover_${docId}_${currentDate.toISOString().split('T')[0]}.pdf`;

      // Determine handover status
      let status = 'Clean Shift';
      if (handoverData.problems) status = 'Problems Reported';
      else if (handoverData.stockIssues) status = 'Stock Issues';
      else if (handoverData.serviceNotes) status = 'Notes Available';

      console.log('📋 Handover status determined:', status);

      // Create HTML for PDF
      const html = `
        <html>
          <head>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                margin: 20px; 
                color: #333;
                line-height: 1.6;
              }
              .header { 
                text-align: center; 
                margin-bottom: 30px; 
                border-bottom: 3px solid #007AFF;
                padding-bottom: 20px;
              }
              .header h1 { 
                color: #007AFF; 
                margin-bottom: 10px; 
                font-size: 28px;
              }
              .header p { 
                color: #666; 
                margin: 5px 0;
              }
              .section { 
                margin-bottom: 25px; 
                page-break-inside: avoid;
              }
              .section h2 { 
                color: #333; 
                border-bottom: 2px solid #007AFF; 
                padding-bottom: 5px; 
                margin-bottom: 15px;
              }
              .status { 
                padding: 15px; 
                border-radius: 8px; 
                margin-bottom: 20px;
                font-weight: bold;
                border-left: 5px solid;
              }
              .status.clean { 
                background-color: #d4edda; 
                color: #155724; 
                border-left-color: #28a745;
              }
              .status.issues { 
                background-color: #f8d7da; 
                color: #721c24; 
                border-left-color: #dc3545;
              }
              .status.notes { 
                background-color: #cce5ff; 
                color: #004085; 
                border-left-color: #007AFF;
              }
              .content { 
                background-color: #f8f9fa; 
                padding: 15px; 
                border-radius: 8px; 
                border: 1px solid #e9ecef;
                min-height: 60px;
              }
              .empty { 
                color: #999; 
                font-style: italic; 
              }
              .footer {
                margin-top: 40px; 
                text-align: center; 
                color: #666; 
                font-size: 12px;
                border-top: 1px solid #ddd;
                padding-top: 20px;
              }
              .footer p {
                margin: 5px 0;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Kitchen Handover Report</h1>
              <p><strong>Generated on:</strong> ${currentDate.toLocaleDateString()} at ${currentDate.toLocaleTimeString()}</p>
              <p><strong>Document ID:</strong> ${docId}</p>
            </div>
            
            <div class="status ${status.includes('Problems') ? 'issues' : status.includes('Stock') ? 'issues' : status.includes('Notes') ? 'notes' : 'clean'}">
              <strong>Shift Status:</strong> ${status}
            </div>
            
            <div class="section">
              <h2>📝 Service Notes</h2>
              <div class="content">
                ${handoverData.serviceNotesText ? handoverData.serviceNotesText.replace(/\n/g, '<br>') : '<span class="empty">No service notes provided</span>'}
              </div>
            </div>
            
            <div class="section">
              <h2>📦 Stock Issues</h2>
              <div class="content">
                ${handoverData.stockIssuesText ? handoverData.stockIssuesText.replace(/\n/g, '<br>') : '<span class="empty">No stock issues reported</span>'}
              </div>
            </div>
            
            <div class="section">
              <h2>⚠️ Problems During Shift</h2>
              <div class="content">
                ${handoverData.problemsDuringShiftText ? handoverData.problemsDuringShiftText.replace(/\n/g, '<br>') : '<span class="empty">No problems reported</span>'}
              </div>
            </div>
            
            <div class="footer">
              <p>This handover report was generated by ChefFlow</p>
              <p>For internal restaurant management use only</p>
              <p>© ${currentDate.getFullYear()} ChefFlow - Kitchen Management System</p>
            </div>
          </body>
        </html>
      `;

      console.log('📝 HTML template created successfully');

      // Generate PDF locally using expo-print
      console.log('🖨️ Generating PDF with expo-print...');
      const printOptions = {
        html,
        base64: false,
        fileName: fileName.replace('.pdf', ''),
        width: 612, // 8.5 inches in points
        height: 792, // 11 inches in points
        margins: {
          left: 50,
          right: 50,
          top: 50,
          bottom: 50,
        },
      };

      const { uri } = await Print.printToFileAsync(printOptions);
      console.log('📄 PDF generated locally at:', uri);

      // Verify the file was created
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        throw new Error('PDF file was not created successfully');
      }
      console.log('✅ PDF file verified, size:', fileInfo.size, 'bytes');

      // Upload to Firebase Storage
      console.log('☁️ Starting Firebase Storage upload...');
      let downloadURL;
      
      // Try Firebase Storage first (primary method)
      try {
        console.log('� Uploading PDF to Firebase Storage...');
        downloadURL = await uploadPdfToStorage(uri, fileName, restaurantId, 'handovers');
        console.log('🎉 PDF uploaded to Firebase Storage successfully:', downloadURL);
      } catch (storageError) {
        console.error('❌ Firebase Storage upload failed:', storageError);
        
        // Only use local storage as absolute last resort
        console.warn('⚠️ Falling back to local storage...');
        try {
          downloadURL = await uploadPdfToStorageTemporary(uri, fileName, restaurantId, 'handovers');
          console.log('💾 PDF saved using local storage fallback:', downloadURL);
        } catch (fallbackError) {
          console.error('❌ Both storage methods failed:', fallbackError);
          throw new Error('Failed to save PDF using any storage method: ' + fallbackError.message);
        }
      }

      // Clean up the original temporary file
      try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
        console.log('🗑️ Original temporary file cleaned up successfully');
      } catch (cleanupError) {
        console.warn('⚠️ Could not clean up original temporary file:', cleanupError.message);
      }

      return downloadURL;

    } catch (error) {
      console.error('❌ Error generating handover PDF:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        cause: error.cause
      });
      throw new Error(`PDF generation failed: ${error.message}`);
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
            <Text style={styles.title}>Kitchen Handover</Text>
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
    paddingTop: Spacing.lg,
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
  title: {
    fontSize: 22,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
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
});

export default HandoverScreen;
