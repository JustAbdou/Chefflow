import { useState, useEffect } from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, RefreshControl, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/Colors";
import { Typography } from "../../constants/Typography";
import { Spacing } from "../../constants/Spacing";
import { getAndroidTitleMargin } from "../../utils/responsive";
import useNavigationBar from "../../hooks/useNavigationBar";
import { useNavigation } from "@react-navigation/native";
import { getFormattedTodayDate, groupPrepItemsByDay } from '../../utils/dateUtils';
import AddPrepItemModal from "./AddPrepItemModal";
import AddSectionModal from "./AddSectionModal";
import EditPrepItemModal from "./EditPrepItemModal";
import FlagSelectionModal from "./FlagSelectionModal";
import { getDocs, addDoc, serverTimestamp, query, orderBy, deleteDoc, updateDoc, doc, getDoc } from "firebase/firestore";
import { useRestaurant } from "../../contexts/RestaurantContext";
import { getRestaurantCollection, getRestaurantDoc } from "../../utils/firestoreHelpers";
import { auth, db } from "../../../firebase";
import { initializeOfflineSync, offlineCapableCreate, offlineCapableUpdate, offlineCapableDelete, cachePrepItemsOffline, getCachedPrepItems, cachePrepSectionsOffline, getCachedPrepSections } from '../../utils/offlineSync';
import { addNetworkListener, getNetworkStatus, addOnlineCallback } from '../../utils/networkMonitor';

export default function PrepListsScreen() {
  const { restaurantId } = useRestaurant();
  const navigation = useNavigation();
  const [prepItems, setPrepItems] = useState([]);
  const [sections, setSections] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddSectionModal, setShowAddSectionModal] = useState(false);
  const [showEditItemModal, setShowEditItemModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedSectionForAdd, setSelectedSectionForAdd] = useState(null);
  const [currentDate, setCurrentDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [isNetworkOnline, setIsNetworkOnline] = useState(true);

  // Hide Android navigation bar
  const navigationBar = useNavigationBar();
  navigationBar.useHidden(); // Use hidden mode for complete immersion

  useEffect(() => {
    setCurrentDate(getFormattedTodayDate());
  }, []);

  // Initialize network monitoring
  useEffect(() => {
    if (!restaurantId) return;

    // Set initial network status
    setIsNetworkOnline(getNetworkStatus());

    // Add network listener
    const removeNetworkListener = addNetworkListener((isOnline) => {
      setIsNetworkOnline(isOnline);
      console.log(`🌐 Prep List - Network status updated: ${isOnline ? 'Online' : 'Offline'}`);
    });

    // Add callback for when coming back online
    const removeOnlineCallback = addOnlineCallback(async (syncResult) => {
      console.log('🔄 Prep List - Back online, refreshing data...');
      await fetchPrepItems(true); // Force refresh from server
    });

    return () => {
      removeNetworkListener();
      removeOnlineCallback();
    };
  }, [restaurantId]);

  // Initialize offline sync
  useEffect(() => {
    if (!restaurantId) return;

    const initSync = async () => {
      await initializeOfflineSync(restaurantId);
    };

    initSync();
  }, [restaurantId]);

  useEffect(() => {
    const fetchPrepItems = async (forceRefresh = false) => {
      if (!restaurantId) return;
      
      setLoading(true);
      try {
        // Always try to load cached data first for faster initial display
        if (!forceRefresh) {
          const cachedItems = await getCachedPrepItems();
          if (cachedItems.length > 0) {
            setPrepItems(cachedItems);
            console.log(`📱 Loaded ${cachedItems.length} prep items from cache (initial load)`);
            setLoading(false); // Show cached data immediately
          }
        }
        
        if (isNetworkOnline || forceRefresh) {
          // Try to fetch from Firestore
          const q = query(getRestaurantCollection(restaurantId, "preplist"), orderBy("createdAt", "desc"));
          const snapshot = await getDocs(q);
          const items = snapshot.docs.map(doc => {
            const data = doc.data();
            
            // Validate and sanitize the createdAt field
            let validCreatedAt = data.createdAt;
            if (data.createdAt) {
              try {
                // Test if the date is valid
                let testDate;
                if (typeof data.createdAt.toDate === 'function') {
                  testDate = data.createdAt.toDate();
                } else if (data.createdAt instanceof Date) {
                  testDate = data.createdAt;
                } else {
                  testDate = new Date(data.createdAt);
                }
                
                // If the date is invalid, use current date as fallback
                if (isNaN(testDate.getTime())) {
                  console.warn('Invalid createdAt date for item:', doc.id, data.createdAt);
                  validCreatedAt = new Date();
                }
              } catch (error) {
                console.error('Error validating createdAt for item:', doc.id, error);
                validCreatedAt = new Date();
              }
            } else {
              // If no createdAt, use current date
              validCreatedAt = new Date();
            }
            
            return {
              id: doc.id,
              ...data,
              createdAt: validCreatedAt,
              completed: false,
            };
          });
          
          // Sort items by creation date (newest first) before setting state
          const sortedItems = items.sort((a, b) => {
            let aTime, bTime;
            
            try {
              if (a.createdAt && typeof a.createdAt.toDate === 'function') {
                aTime = a.createdAt.toDate();
              } else if (a.createdAt instanceof Date && !isNaN(a.createdAt.getTime())) {
                aTime = a.createdAt;
              } else {
                aTime = new Date(0);
              }
            } catch (error) {
              aTime = new Date(0);
            }
            
            try {
              if (b.createdAt && typeof b.createdAt.toDate === 'function') {
                bTime = b.createdAt.toDate();
              } else if (b.createdAt instanceof Date && !isNaN(b.createdAt.getTime())) {
                bTime = b.createdAt;
              } else {
                bTime = new Date(0);
              }
            } catch (error) {
              bTime = new Date(0);
            }
            
            return bTime.getTime() - aTime.getTime(); // Newest first
          });
          
          setPrepItems(sortedItems);
          
          // Cache items for offline use
          await cachePrepItemsOffline(items);
          console.log(`📱 Cached ${items.length} prep items for offline use`);
        } else {
          // Use cached data when offline (if not already loaded)
          console.log('📱 Offline mode: Using cached prep items');
          if (!forceRefresh) {
            const cachedItems = await getCachedPrepItems();
            if (cachedItems.length > 0) {
              setPrepItems(cachedItems);
              console.log(`📱 Loaded ${cachedItems.length} prep items from cache (offline mode)`);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching prep items:", error);
        // Try to load from cache as fallback
        const cachedItems = await getCachedPrepItems();
        setPrepItems(cachedItems);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };
    fetchPrepItems();
  }, [restaurantId, isNetworkOnline]);

  // Fetch sections with offline support
  useEffect(() => {
    const fetchSections = async () => {
      if (!restaurantId) return;
      
      try {
        // Load cached sections first for faster display
        const cachedSections = await getCachedPrepSections();
        if (cachedSections.length > 0) {
          setSections(cachedSections);
          console.log(`📂 Loaded ${cachedSections.length} prep sections from cache`);
        }
        
        // Then fetch from Firestore if online
        if (isNetworkOnline) {
          const q = query(getRestaurantCollection(restaurantId, "prepsections"), orderBy("createdAt", "asc"));
          const snapshot = await getDocs(q);
          const sectionList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setSections(sectionList);
          
          // Cache for offline use
          await cachePrepSectionsOffline(sectionList);
          console.log(`📂 Loaded ${sectionList.length} prep sections from server`);
        }
      } catch (error) {
        console.error("Error fetching sections:", error);
        // Fall back to cached data
        const cachedSections = await getCachedPrepSections();
        setSections(cachedSections);
      }
    };
    
    fetchSections();
  }, [restaurantId, isNetworkOnline]);

  // Pull to refresh handler
  const onRefresh = async () => {
    if (!isNetworkOnline) {
      console.log('📱 Offline: Refreshing with cached data');
      setRefreshing(true);
      const cachedItems = await getCachedPrepItems();
      setPrepItems(cachedItems);
      setRefreshing(false);
      return;
    }
    
    setRefreshing(true);
    try {
      const q = query(getRestaurantCollection(restaurantId, "preplist"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map(doc => {
        const data = doc.data();
        
        // Validate and sanitize the createdAt field
        let validCreatedAt = data.createdAt;
        if (data.createdAt) {
          try {
            // Test if the date is valid
            let testDate;
            if (typeof data.createdAt.toDate === 'function') {
              testDate = data.createdAt.toDate();
            } else if (data.createdAt instanceof Date) {
              testDate = data.createdAt;
            } else {
              testDate = new Date(data.createdAt);
            }
            
            // If the date is invalid, use current date as fallback
            if (isNaN(testDate.getTime())) {
              console.warn('Invalid createdAt date for item in refresh:', doc.id, data.createdAt);
              validCreatedAt = new Date();
            }
          } catch (error) {
            console.error('Error validating createdAt for item in refresh:', doc.id, error);
            validCreatedAt = new Date();
          }
        } else {
          // If no createdAt, use current date
          validCreatedAt = new Date();
        }
        
        return {
          id: doc.id,
          ...data,
          createdAt: validCreatedAt,
          completed: false,
        };
      });
      
      // Sort items by creation date (newest first) before setting state
      const sortedItems = items.sort((a, b) => {
        let aTime, bTime;
        
        try {
          if (a.createdAt && typeof a.createdAt.toDate === 'function') {
            aTime = a.createdAt.toDate();
          } else if (a.createdAt instanceof Date && !isNaN(a.createdAt.getTime())) {
            aTime = a.createdAt;
          } else {
            aTime = new Date(0);
          }
        } catch (error) {
          aTime = new Date(0);
        }
        
        try {
          if (b.createdAt && typeof b.createdAt.toDate === 'function') {
            bTime = b.createdAt.toDate();
          } else if (b.createdAt instanceof Date && !isNaN(b.createdAt.getTime())) {
            bTime = b.createdAt;
          } else {
            bTime = new Date(0);
          }
        } catch (error) {
          bTime = new Date(0);
        }
        
        return bTime.getTime() - aTime.getTime(); // Newest first
      });
      
      setPrepItems(sortedItems);
      
      // Update cache
      await cachePrepItemsOffline(items);
    } catch (error) {
      console.error("Error refreshing prep items:", error);
    } finally {
      setRefreshing(false);
    }
  };

  // Toggle done (checkbox) in state and Firestore
  const toggleItem = async (id, currentDone) => {
    if (!restaurantId) return;
    
    // Check if item is temporary and prevent action
    const item = prepItems.find(item => item.id === id);
    if (item && item.isTemporary) {
      console.log('Cannot toggle temporary item, still processing...');
      return;
    }
    
    setPrepItems((items) =>
      items.map((item) =>
        item.id === id ? { ...item, done: !currentDone } : item
      )
    );
    try {
      await offlineCapableUpdate(restaurantId, "preplist", id, { done: !currentDone }, isNetworkOnline);
    } catch (error) {
      console.error("Error updating done field:", error);
    }
  };

  const addNewItem = async (itemName, sectionId = null) => {
    if (!restaurantId) return;
    
    try {
      const currentUser = auth.currentUser;
      let userInfo = {
        userId: 'anonymous',
        userEmail: 'anonymous',
        userName: 'Anonymous User',
        fullName: 'Anonymous User'
      };

      if (currentUser) {
        // Fetch user's full name from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          const userData = userDoc.exists() ? userDoc.data() : null;
          
          userInfo = {
            userId: currentUser.uid,
            userEmail: currentUser.email || 'Unknown Email',
            userName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Unknown User',
            fullName: userData?.fullName || currentUser.displayName || currentUser.email?.split('@')[0] || 'Unknown User'
          };
        } catch (firestoreError) {
          console.warn('Could not fetch user data from Firestore:', firestoreError);
          // Fallback to auth data only
          userInfo = {
            userId: currentUser.uid,
            userEmail: currentUser.email || 'Unknown Email',
            userName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Unknown User',
            fullName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Unknown User'
          };
        }
      }

      // Create the item for local state (with offline ID if needed)
      const itemData = {
        name: itemName,
        done: false,
        sectionId: sectionId || null,
        createdAt: isNetworkOnline ? serverTimestamp() : new Date(), // Use current date for offline items
        createdBy: userInfo,
      };

      // Create the new item for immediate display (before async operation)
      const tempId = `temp_${Date.now()}_${Math.random()}`;
      const immediateItem = {
        id: tempId,
        name: itemName,
        done: false,
        completed: false,
        flagged: false,
        sectionId: sectionId || null,
        createdAt: new Date(),
        createdBy: userInfo,
        isTemporary: true // Mark as temporary for immediate display
      };
      
      // Add to UI immediately for instant feedback
      setPrepItems((prevItems) => {
        console.log(`📱 Adding "${itemName}" to UI immediately (${isNetworkOnline ? 'online' : 'offline'})`);
        return [immediateItem, ...prevItems];
      });
      setShowAddModal(false);
      
      try {
        // Now perform the actual create operation
        const result = await offlineCapableCreate(restaurantId, "preplist", itemData, isNetworkOnline);
        
        // Replace the temporary item with the real one
        setPrepItems((prevItems) => 
          prevItems.map(item => 
            item.id === tempId 
              ? { ...result, completed: false, flagged: false, createdAt: new Date() }
              : item
          )
        );
        
        console.log(`✅ Item "${itemName}" added successfully (${isNetworkOnline ? 'online' : 'offline'})`);
      } catch (error) {
        console.error("Error adding prep item:", error);
        // Remove the temporary item if the operation failed
        setPrepItems((prevItems) => prevItems.filter(item => item.id !== tempId));
      }
    } catch (error) {
      console.error("Error adding prep item:", error);
    }
  };

  // Toggle urgent flag in state and Firestore - now opens modal for selection
  const openFlagModal = (id) => {
    // Check if item is temporary and prevent action
    const item = prepItems.find(item => item.id === id);
    if (item && item.isTemporary) {
      console.log('Cannot flag temporary item, still processing...');
      return;
    }
    
    setSelectedItemId(id);
    setShowFlagModal(true);
  };

  const handleFlagSelection = async (flagValue) => {
    if (!restaurantId || !selectedItemId) return;
    
    setPrepItems((items) =>
      items.map((item) =>
        item.id === selectedItemId ? { ...item, urgent: flagValue } : item
      )
    );
    try {
      await offlineCapableUpdate(restaurantId, "preplist", selectedItemId, { urgent: flagValue }, isNetworkOnline);
    } catch (error) {
      console.error("Error updating urgent flag:", error);
    }
    setSelectedItemId(null);
  };

  const clearAllItems = async () => {
    if (!restaurantId || prepItems.length === 0) return;
    
    Alert.alert(
      "Clear All Items",
      `Are you sure you want to delete all ${prepItems.length} prep items? This action cannot be undone.`,
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete All",
          style: "destructive",
          onPress: async () => {
            try {
              // Delete all items using offline-capable delete
              const deletePromises = prepItems.map(item =>
                offlineCapableDelete(restaurantId, "preplist", item.id, isNetworkOnline)
              );
              
              await Promise.all(deletePromises);
              
              // Clear local state
              setPrepItems([]);
            } catch (error) {
              console.error("Error clearing all prep items:", error);
              Alert.alert("Error", "Failed to delete all items. Please try again.");
            }
          }
        }
      ]
    );
  };

  const clearYesterdayItems = async () => {
    // Sort prep items by creation date (newest first) for getting yesterday's items
    const sortedItems = [...prepItems].sort((a, b) => {
      let aTime, bTime;
      
      try {
        if (a.createdAt && typeof a.createdAt.toDate === 'function') {
          aTime = a.createdAt.toDate();
        } else if (a.createdAt instanceof Date && !isNaN(a.createdAt.getTime())) {
          aTime = a.createdAt;
        } else if (a.createdAt) {
          const parsedDate = new Date(a.createdAt);
          aTime = !isNaN(parsedDate.getTime()) ? parsedDate : new Date(0);
        } else {
          aTime = new Date(0);
        }
      } catch (error) {
        aTime = new Date(0);
      }
      
      try {
        if (b.createdAt && typeof b.createdAt.toDate === 'function') {
          bTime = b.createdAt.toDate();
        } else if (b.createdAt instanceof Date && !isNaN(b.createdAt.getTime())) {
          bTime = b.createdAt;
        } else if (b.createdAt) {
          const parsedDate = new Date(b.createdAt);
          bTime = !isNaN(parsedDate.getTime()) ? parsedDate : new Date(0);
        } else {
          bTime = new Date(0);
        }
      } catch (error) {
        bTime = new Date(0);
      }
      
      return bTime.getTime() - aTime.getTime();
    });
    
    const { yesterdayItems } = groupPrepItemsByDay(sortedItems);
    if (!restaurantId || yesterdayItems.length === 0) return;
    
    Alert.alert(
      "Clear Today's Items",
      `Are you sure you want to delete all ${yesterdayItems.length} items from today's list? This action cannot be undone.`,
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete All",
          style: "destructive",
          onPress: async () => {
            try {
              // Delete yesterday's items using offline-capable delete
              const deletePromises = yesterdayItems.map(item =>
                offlineCapableDelete(restaurantId, "preplist", item.id, isNetworkOnline)
              );
              
              await Promise.all(deletePromises);
              
              // Remove yesterday's items from local state
              setPrepItems(items => items.filter(item => !yesterdayItems.find(yi => yi.id === item.id)));
            } catch (error) {
              console.error("Error clearing yesterday's prep items:", error);
              Alert.alert("Error", "Failed to delete yesterday's items. Please try again.");
            }
          }
        }
      ]
    );
  };

  // Add a new section
  const addNewSection = async (sectionName) => {
    if (!restaurantId) return;
    
    try {
      const sectionData = {
        name: sectionName,
        createdAt: serverTimestamp(),
      };
      
      const docRef = await addDoc(getRestaurantCollection(restaurantId, "prepsections"), sectionData);
      const newSection = {
        id: docRef.id,
        ...sectionData,
        createdAt: new Date()
      };
      
      const updatedSections = [...sections, newSection];
      setSections(updatedSections);
      
      // Cache the updated sections
      await cachePrepSectionsOffline(updatedSections);
      
      console.log(`✅ Section "${sectionName}" added successfully`);
      setShowAddSectionModal(false);
    } catch (error) {
      console.error("Error adding section:", error);
      Alert.alert("Error", "Failed to add section. Please try again.");
    }
  };

  // Delete a section
  const deleteSection = async (sectionId) => {
    if (!restaurantId) return;
    
    // Check if section has items
    const itemsInSection = prepItems.filter(item => item.sectionId === sectionId);
    
    Alert.alert(
      "Delete Section",
      itemsInSection.length > 0
        ? `This section contains ${itemsInSection.length} item(s). All items will be deleted along with the section. Continue?`
        : "Are you sure you want to delete this section?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              // Delete all items in the section
              if (itemsInSection.length > 0) {
                const deletePromises = itemsInSection.map(item =>
                  offlineCapableDelete(restaurantId, "preplist", item.id, isNetworkOnline)
                );
                await Promise.all(deletePromises);
                
                // Update local state - remove items from section
                setPrepItems(items =>
                  items.filter(item => item.sectionId !== sectionId)
                );
              }
              
              // Delete the section
              await deleteDoc(getRestaurantDoc(restaurantId, "prepsections", sectionId));
              const updatedSections = sections.filter(s => s.id !== sectionId);
              setSections(updatedSections);
              
              // Cache the updated sections
              await cachePrepSectionsOffline(updatedSections);
              
              console.log(`✅ Section and ${itemsInSection.length} items deleted successfully`);
            } catch (error) {
              console.error("Error deleting section:", error);
              Alert.alert("Error", "Failed to delete section. Please try again.");
            }
          }
        }
      ]
    );
  };

  // Edit an item
  const editItem = async (itemId, newName) => {
    if (!restaurantId) return;
    
    try {
      await offlineCapableUpdate(restaurantId, "preplist", itemId, { name: newName }, isNetworkOnline);
      setPrepItems(items =>
        items.map(item =>
          item.id === itemId ? { ...item, name: newName } : item
        )
      );
      console.log(`✅ Item updated successfully`);
    } catch (error) {
      console.error("Error editing item:", error);
      Alert.alert("Error", "Failed to update item. Please try again.");
    }
  };

  // Delete an item
  const deleteItem = async (itemId) => {
    if (!restaurantId) return;
    
    try {
      await offlineCapableDelete(restaurantId, "preplist", itemId, isNetworkOnline);
      setPrepItems(items => items.filter(item => item.id !== itemId));
      console.log(`✅ Item deleted successfully`);
    } catch (error) {
      console.error("Error deleting item:", error);
      Alert.alert("Error", "Failed to delete item. Please try again.");
    }
  };

  const onBack = () => {
    navigation.goBack();
  };

  const renderPrepItem = (item) => (
    <TouchableOpacity 
      key={item.id} 
      style={[
        styles.listItem,
        item.isTemporary && styles.temporaryItem // Add subtle styling for temporary items
      ]}
      onPress={() => toggleItem(item.id, item.done)}
      onLongPress={() => {
        if (!item.isTemporary) {
          setSelectedItem(item);
          setShowEditItemModal(true);
        }
      }}
      activeOpacity={0.7}
    >
      <View
        style={[styles.checkbox, item.done && styles.checkedBox]}
      >
        {item.done && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <Text style={[
        styles.itemText, 
        item.done && styles.completedText,
        item.isTemporary && styles.temporaryText // Subtle styling for temporary items
      ]}>
        {item.name}
      </Text>
      <View style={styles.flagContainer}>
        {item.isTemporary ? (
          // Show loading indicator for temporary items
          <Text style={styles.loadingIndicator}>⋯</Text>
        ) : (
          <TouchableOpacity onPress={() => openFlagModal(item.id)} activeOpacity={0.7}>
            <Text
              style={[
                styles.flagIcon,
                { 
                  color: item.urgent === 'x85' ? "#F7B801" : 
                         item.urgent === 'x86' ? "#FF3B30" : 
                         Colors.gray200 
                }
              ]}
            >
              ⚑
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  // Group items by day AND section
  let todayItems = [];
  let yesterdayItems = [];
  
  try {
    const grouped = groupPrepItemsByDay(prepItems);
    todayItems = grouped.todayItems || [];
    yesterdayItems = grouped.yesterdayItems || [];
  } catch (error) {
    console.error('Error grouping prep items by day:', error);
    // Fallback: just show all items as today's items
    todayItems = prepItems;
    yesterdayItems = [];
  }

  // Group items by section within each day - ALWAYS show all sections
  const groupItemsBySection = (items) => {
    const noSectionItems = items.filter(item => !item.sectionId);
    // Always include all sections, even if they have no items
    const allSectionsWithItems = sections.map(section => ({
      ...section,
      items: items.filter(item => item.sectionId === section.id)
    }));
    
    return { noSectionItems, allSectionsWithItems };
  };

  const todayGrouped = groupItemsBySection(todayItems);
  const yesterdayGrouped = groupItemsBySection(yesterdayItems);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.backHeader}>
            <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
              <Text style={styles.backArrow}>‹</Text>
            </TouchableOpacity>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>Prep Lists</Text>
              <Text style={styles.date}>{currentDate}</Text>
            </View>
          </View>
        </View>

        {/* Offline Indicator */}
        {!isNetworkOnline && (
          <View style={styles.offlineIndicator}>
            <Text style={styles.offlineText}>📱 Offline Mode - Changes will sync when connected</Text>
          </View>
        )}

        {/* Section Management Header */}
        <View style={styles.sectionManagementHeader}>
          <TouchableOpacity
            style={styles.addSectionButton}
            onPress={() => setShowAddSectionModal(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
            <Text style={styles.addSectionText}>Add Section</Text>
          </TouchableOpacity>
        </View>

        {/* Prep Items List - Grouped by Sections */}
        <View style={styles.listContainer}>
          {loading ? (
            <Text style={{ textAlign: "center", marginTop: 40 }}>Loading...</Text>
          ) : (
            <>
              {/* Tomorrow's List */}
              {(todayItems.length > 0 || sections.length > 0) && (
                <>
                  <View style={styles.dayHeader}>
                    <Text style={styles.dayTitle}>Tomorrow's List</Text>
                    {todayItems.length > 0 && (
                      <TouchableOpacity
                        style={styles.clearAllButton}
                        onPress={clearAllItems}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.clearAllText}>Clear All</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  {/* No Section Items - Display without section header */}
                  {todayGrouped.noSectionItems.length > 0 && (
                    <View style={styles.noSectionItemsContainer}>
                      {todayGrouped.noSectionItems.map(renderPrepItem)}
                    </View>
                  )}
                  
                  {/* All Sections - ALWAYS show, even if empty */}
                  {todayGrouped.allSectionsWithItems.map(section => (
                    <View key={section.id} style={styles.sectionCard}>
                      <View style={styles.sectionCardHeader}>
                        <Text style={styles.sectionCardTitle}>{section.name}</Text>
                        <TouchableOpacity
                          style={styles.deleteSectionButton}
                          onPress={() => deleteSection(section.id)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.sectionCardContent}>
                        {section.items.map(renderPrepItem)}
                        {/* Add Item Button within section */}
                        <TouchableOpacity
                          style={styles.addItemInSectionButton}
                          onPress={() => {
                            setSelectedSectionForAdd(section.id);
                            setShowAddModal(true);
                          }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
                          <Text style={styles.addItemInSectionText}>Add Item</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </>
              )}
              
              {/* Today's List */}
              {yesterdayItems.length > 0 && (
                <>
                  <View style={styles.dayHeader}>
                    <Text style={[styles.dayTitle, styles.todayTitle]}>Today's List</Text>
                    <TouchableOpacity
                      style={styles.clearAllButton}
                      onPress={clearYesterdayItems}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.clearAllText}>Clear All</Text>
                    </TouchableOpacity>
                  </View>
                  
                  {/* No Section Items - Display without section header */}
                  {yesterdayGrouped.noSectionItems.length > 0 && (
                    <View style={styles.noSectionItemsContainer}>
                      {yesterdayGrouped.noSectionItems.map(renderPrepItem)}
                    </View>
                  )}
                  
                  {/* Items grouped by sections */}
                  {yesterdayGrouped.allSectionsWithItems.map(section => {
                    // Only show section in yesterday if it has items
                    if (section.items.length === 0) return null;
                    
                    return (
                      <View key={section.id} style={styles.sectionCard}>
                        <View style={styles.sectionCardHeader}>
                          <Text style={styles.sectionCardTitle}>{section.name}</Text>
                          <TouchableOpacity
                            style={styles.deleteSectionButton}
                            onPress={() => deleteSection(section.id)}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                          </TouchableOpacity>
                        </View>
                        <View style={styles.sectionCardContent}>
                          {section.items.map(renderPrepItem)}
                        </View>
                      </View>
                    );
                  })}
                </>
              )}
              
              {/* Empty state */}
              {todayItems.length === 0 && yesterdayItems.length === 0 && sections.length === 0 && (
                <Text style={styles.emptyState}>No sections yet. Add your first section to get started!</Text>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowAddModal(true)} activeOpacity={0.85}>
        <Ionicons name="add" size={38} color="#fff" />
      </TouchableOpacity>
      {/* Add Item Modal */}
      {showAddModal && (
        <AddPrepItemModal
          visible={showAddModal}
          onClose={() => {
            setShowAddModal(false);
            setSelectedSectionForAdd(null);
          }}
          onAdd={addNewItem}
          date={currentDate}
          preSelectedSection={selectedSectionForAdd}
        />
      )}

      {/* Add Section Modal */}
      <AddSectionModal
        visible={showAddSectionModal}
        onClose={() => setShowAddSectionModal(false)}
        onAdd={addNewSection}
      />

      {/* Edit Item Modal */}
      {selectedItem && (
        <EditPrepItemModal
          visible={showEditItemModal}
          onClose={() => {
            setShowEditItemModal(false);
            setSelectedItem(null);
          }}
          onSave={editItem}
          onDelete={deleteItem}
          item={selectedItem}
        />
      )}

      {/* Flag Selection Modal */}
      <FlagSelectionModal
        visible={showFlagModal}
        onClose={() => {
          setShowFlagModal(false);
          setSelectedItemId(null);
        }}
        onSelect={handleFlagSelection}
        onDelete={() => {
          if (selectedItemId) {
            deleteItem(selectedItemId);
          }
        }}
        currentFlag={selectedItemId ? prepItems.find(item => item.id === selectedItemId)?.urgent : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg + getAndroidTitleMargin(),
    paddingBottom: Spacing.md,
  },
  backHeader: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    width: "100%",
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
    fontSize: 22,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
  },
  date: {
    fontSize: Typography.md,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  sectionManagementHeader: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  addSectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    alignSelf: 'flex-start',
  },
  addSectionText: {
    fontSize: Typography.base,
    fontFamily: Typography.fontMedium,
    color: Colors.primary,
    marginLeft: Spacing.xs,
  },
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
    marginTop: Spacing.xl,
  },
  dayTitle: {
    fontSize: Typography.xxl,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
  },
  todayTitle: {
    color: Colors.warning, // Orange color for today's list
  },
  sectionGroup: {
    marginBottom: Spacing.xl,
  },
  sectionCard: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.gray50,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  sectionCardTitle: {
    fontSize: Typography.lg,
    fontFamily: Typography.fontBold,
    color: Colors.textPrimary,
  },
  sectionCardContent: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  sectionTitle: {
    fontSize: Typography.lg,
    fontFamily: Typography.fontBold,
    color: Colors.textSecondary,
  },
  deleteSectionButton: {
    padding: Spacing.xs,
  },
  addItemInSectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(66, 133, 244, 0.05)',
  },
  addItemInSectionText: {
    fontSize: Typography.base,
    fontFamily: Typography.fontMedium,
    color: Colors.primary,
    marginLeft: Spacing.xs,
  },
  listContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 100,
  },
  noSectionItemsContainer: {
    marginBottom: Spacing.lg,
  },
  emptyState: {
    textAlign: "center",
    marginTop: 40,
    fontSize: Typography.md,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.gray50,
    borderRadius: 12,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.primary,
    marginRight: Spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
  },
  checkedBox: {
    backgroundColor: Colors.primary,
  },
  checkmark: {
    color: "white",
    fontSize: 14,
    fontWeight: Typography.bold,
  },
  itemText: {
    fontSize: Typography.lg,
    color: Colors.textPrimary,
    fontWeight: Typography.medium,
    flex: 1,
  },
  completedText: {
    textDecorationLine: "line-through",
    color: Colors.textSecondary,
  },
  flagContainer: {
    marginLeft: Spacing.md,
  },
  flagIcon: {
    fontSize: 22,
    color: "#F7B801", // yellow/orange for flagged, gray for not flagged
  },
  clearAllButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#FF3B30",
    backgroundColor: "transparent",
  },
  clearAllText: {
    fontSize: Typography.sm,
    color: "#FF3B30", // Red color to indicate deletion
    fontWeight: Typography.medium,
  },
  fab: {
    position: "absolute",
    right: 40,
    bottom: 70,
    width: 72,
    height: 72,
    borderRadius: 50,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  offlineIndicator: {
    backgroundColor: Colors.warning,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: 8,
  },
  offlineText: {
    color: Colors.background,
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
    textAlign: 'center',
  },
  temporaryItem: {
    opacity: 0.8, // Slightly faded to indicate processing
  },
  temporaryText: {
    fontStyle: 'italic', // Italic text for temporary items
  },
  loadingIndicator: {
    fontSize: Typography.lg,
    color: Colors.primary,
  },
});