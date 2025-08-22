import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '../../constants';
import { getAndroidTitleMargin } from '../../utils/responsive';
import useNavigationBar from '../../hooks/useNavigationBar';

const { width: screenWidth } = Dimensions.get('window');

const InvoiceDetailScreen = ({ route, navigation }) => {
  const { invoice } = route.params;
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Hide Android navigation bar
  const navigationBar = useNavigationBar();
  navigationBar.useHidden();

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown Date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.title}>Invoice Details</Text>
          <Text style={styles.subtitle}>{invoice.invoiceNumber}</Text>
        </View>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Main Photo Display */}
        {invoice.images && invoice.images.length > 0 && (
          <View style={styles.mainPhotoContainer}>
            <Image 
              source={{ uri: invoice.images[selectedImageIndex] }} 
              style={styles.mainPhoto}
              resizeMode="contain"
            />
            
            {/* Photo Navigation */}
            {invoice.images.length > 1 && (
              <View style={styles.photoNavigation}>
                <TouchableOpacity 
                  style={[styles.navButton, selectedImageIndex === 0 && styles.navButtonDisabled]}
                  onPress={() => setSelectedImageIndex(prev => Math.max(0, prev - 1))}
                  disabled={selectedImageIndex === 0}
                >
                  <Ionicons name="chevron-back" size={24} color={selectedImageIndex === 0 ? Colors.gray400 : Colors.primary} />
                </TouchableOpacity>
                
                <Text style={styles.photoCounter}>
                  {selectedImageIndex + 1} of {invoice.images.length}
                </Text>
                
                <TouchableOpacity 
                  style={[styles.navButton, selectedImageIndex === invoice.images.length - 1 && styles.navButtonDisabled]}
                  onPress={() => setSelectedImageIndex(prev => Math.min(invoice.images.length - 1, prev + 1))}
                  disabled={selectedImageIndex === invoice.images.length - 1}
                >
                  <Ionicons name="chevron-forward" size={24} color={selectedImageIndex === invoice.images.length - 1 ? Colors.gray400 : Colors.primary} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Thumbnail Gallery */}
        {invoice.images && invoice.images.length > 1 && (
          <View style={styles.thumbnailContainer}>
            <Text style={styles.sectionTitle}>All Photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbnailScroll}>
              {invoice.images.map((imageUri, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.thumbnail,
                    selectedImageIndex === index && styles.selectedThumbnail
                  ]}
                  onPress={() => setSelectedImageIndex(index)}
                >
                  <Image source={{ uri: imageUri }} style={styles.thumbnailImage} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Invoice Details */}
        <View style={styles.detailsSection}>
          <Text style={styles.sectionTitle}>Invoice Information</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Invoice Number</Text>
            <Text style={styles.detailValue}>{invoice.invoiceNumber}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date</Text>
            <Text style={styles.detailValue}>{formatDate(invoice.date)}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Supplier</Text>
            <Text style={styles.detailValue}>{invoice.supplier || 'Unknown'}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Amount</Text>
            <Text style={styles.amountValue}>£{invoice.amount}</Text>
          </View>
        </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
  },
  backButton: {
    padding: Spacing.sm,
    marginLeft: -Spacing.sm,
  },
  backArrow: {
    fontSize: 32,
    color: Colors.textPrimary,
    fontWeight: 'bold',
  },
  headerInfo: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    ...Typography.h3,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  subtitle: {
    ...Typography.body,
    color: Colors.gray400,
    marginTop: 2,
  },
  scrollContent: {
    padding: Spacing.md,
  },
  mainPhotoContainer: {
    marginBottom: Spacing.lg,
    backgroundColor: Colors.gray100,
    borderRadius: 16,
    padding: Spacing.md,
  },
  mainPhoto: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    backgroundColor: Colors.gray200,
  },
  photoNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  navButton: {
    padding: Spacing.sm,
    borderRadius: 20,
    backgroundColor: Colors.gray200,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  photoCounter: {
    ...Typography.body,
    color: Colors.gray600,
    fontWeight: '500',
  },
  thumbnailContainer: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  thumbnailScroll: {
    flexDirection: 'row',
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: Spacing.sm,
    borderWidth: 2,
    borderColor: Colors.gray300,
  },
  selectedThumbnail: {
    borderColor: Colors.primary,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  detailsSection: {
    backgroundColor: Colors.gray100,
    borderRadius: 16,
    padding: Spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
  },
  detailLabel: {
    ...Typography.body,
    color: Colors.gray600,
    fontWeight: '500',
  },
  detailValue: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  amountValue: {
    ...Typography.h3,
    color: Colors.primary,
    fontWeight: '700',
  },
});

export default InvoiceDetailScreen;
