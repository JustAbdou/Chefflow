import React from 'react';
import { TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import ProfileScreen from '../screens/settings/ProfileScreen';
import RecipesScreen from '../screens/recipes/RecipesScreen'; 
import TasksScreen from '../screens/tasks/TasksScreen';
import { HomeIcon, RecipesIcon, SettingsIcon, TasksIcon } from '../components/icons/NavigationIcons'; // <-- Import icons

const Tab = createBottomTabNavigator();

// Custom tab button to remove press opacity
const CustomTabButton = (props) => {
  return (
    <TouchableOpacity {...props} activeOpacity={1} />
  );
};

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: 90,
          paddingVertical: 12,
        },
        tabBarItemStyle: {
          marginVertical: 10,
        },
        tabBarButton: CustomTabButton, // Remove press opacity
        animationEnabled: false, // <-- Disable tab switching animation
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ color, size }) => <HomeIcon color={color} size={size} />,
          tabBarLabel: 'Home',
        }}
      />
      <Tab.Screen
        name="Tasks"
        component={TasksScreen}
        options={{
          tabBarIcon: ({ color, size }) => <TasksIcon color={color} size={size} />,
          tabBarLabel: 'Tasks',
        }}
      />
      <Tab.Screen
        name="Recipes"
        component={RecipesScreen}
        options={{
          tabBarIcon: ({ color, size }) => <RecipesIcon color={color} size={size} />,
          tabBarLabel: 'Recipes',
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => <SettingsIcon color={color} size={size} />,
          tabBarLabel: 'Settings',
        }}
      />
      {/* Add other screens here */}
    </Tab.Navigator>
  );
}