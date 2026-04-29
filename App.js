import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet, useWindowDimensions } from 'react-native';

import HomeScreen from './src-mobile/screens/HomeScreen';
import StorageScreen from './src-mobile/screens/StorageScreen';
import RecordingScreen from './src-mobile/screens/RecordingScreen';
import RoomScreen from './src-mobile/screens/RoomScreen';
import ArchiveScreen from './src-mobile/screens/ArchiveScreen';

import { ClientProvider } from './src-mobile/context/ClientContext';

const Tab = createBottomTabNavigator();

export default function App() {
  const { width } = useWindowDimensions();
  const isSmall = width < 360;

  return (
    <ClientProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarIcon: ({ focused, color, size }) => {
              let iconName;
              if (route.name === 'Home') {
                iconName = focused ? 'home' : 'home-outline';
              } else if (route.name === 'Storage') {
                iconName = focused ? 'folder' : 'folder-outline';
              } else if (route.name === 'Recording') {
                iconName = focused ? 'mic' : 'mic-outline';
              } else if (route.name === 'Room') {
                iconName = focused ? 'reader' : 'reader-outline';
              } else if (route.name === 'Archive') {
                iconName = focused ? 'archive' : 'archive-outline';
              }
              return (
                <Ionicons
                  name={iconName}
                  size={isSmall ? 18 : 22}
                  color={color}
                />
              );
            },
            tabBarActiveTintColor: '#4CAF50',
            tabBarInactiveTintColor: '#8E8E93',
            tabBarStyle: [
              styles.tabBar,
              {
                left: isSmall ? 12 : 20,
                right: isSmall ? 12 : 20,
                height: isSmall ? 56 : 64,
              },
            ],
            tabBarItemStyle: styles.tabBarItem,
            tabBarLabelStyle: [
              styles.tabBarLabel,
              { fontSize: isSmall ? 9 : 11 },
            ],
          })}
        >
          <Tab.Screen name="Home" component={HomeScreen} />
          <Tab.Screen name="Storage" component={StorageScreen} />
          <Tab.Screen name="Recording" component={RecordingScreen} />
          <Tab.Screen name="Room" component={RoomScreen} />
          <Tab.Screen name="Archive" component={ArchiveScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </ClientProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 28 : 16,
    backgroundColor: '#ffffff',
    borderRadius: 32,
    paddingBottom: 0,
    paddingTop: 0,
    borderTopWidth: 0,
    elevation: 12,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  tabBarItem: {
    paddingVertical: 8,
  },
  tabBarLabel: {
    fontWeight: '600',
    marginTop: -2,
  },
});
