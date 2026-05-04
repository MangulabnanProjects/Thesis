import React, { useEffect, useState, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import {
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
  Text,
  Animated,
  StatusBar,
} from 'react-native';

import HomeScreen from './src-mobile/screens/HomeScreen';
import StorageScreen from './src-mobile/screens/StorageScreen';
import RecordingScreen from './src-mobile/screens/RecordingScreen';
import RoomScreen from './src-mobile/screens/RoomScreen';
import ArchiveScreen from './src-mobile/screens/ArchiveScreen';

import { ClientProvider, useClientContext } from './src-mobile/context/ClientContext';

const Tab = createBottomTabNavigator();

// ── Splash / Loading Screen ─────────────────────────────────
function SplashScreen({ dbLoaded }) {
  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;
  const progressAnim = useRef(new Animated.Value(0.3)).current;
  const [dots, setDots] = useState('');

  useEffect(() => {
    // Fade in the content
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();

    // Pulse the icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    ).start();

    // Animate the loading dots
    const dotInterval = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? '' : prev + '.'));
    }, 400);

    return () => clearInterval(dotInterval);
  }, []);

  useEffect(() => {
    if (dbLoaded) {
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: false, // width animation doesn't support native driver
      }).start();
    }
  }, [dbLoaded]);

  const widthInterpolate = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%']
  });

  return (
    <View style={splashStyles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FE" />

      {/* Subtle background circles */}
      <View style={splashStyles.bgCircle1} />
      <View style={splashStyles.bgCircle2} />

      <Animated.View style={[splashStyles.content, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
        {/* App Icon */}
        <Animated.View style={[splashStyles.iconContainer, { opacity: pulseAnim }]}>
          <View style={splashStyles.iconCircle}>
            <Ionicons name="mic" size={40} color="#fff" />
          </View>
        </Animated.View>

        {/* App Name */}
        <Text style={splashStyles.appName}>Clinical Voice</Text>
        <Text style={splashStyles.appTagline}>Voice Analysis Platform</Text>

        {/* Loading indicator */}
        <View style={splashStyles.loadingContainer}>
          <View style={splashStyles.loadingBar}>
            <Animated.View
              style={[
                splashStyles.loadingFill,
                { width: widthInterpolate },
              ]}
            />
          </View>
          <Text style={splashStyles.loadingText}>
            {dbLoaded ? 'Ready to go!' : `Connecting to services${dots}`}
          </Text>
        </View>

        {/* Status checklist */}
        <View style={splashStyles.checklist}>
          <View style={splashStyles.checkItem}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={splashStyles.checkText}>Initializing app</Text>
          </View>
          <View style={splashStyles.checkItem}>
            <Ionicons name={dbLoaded ? "checkmark-circle" : "sync-outline"} size={16} color={dbLoaded ? "#4CAF50" : "#FFA94D"} />
            <Text style={splashStyles.checkText}>Syncing with Firebase</Text>
          </View>
          <View style={splashStyles.checkItem}>
            <Ionicons name={dbLoaded ? "checkmark-circle" : "ellipse-outline"} size={16} color={dbLoaded ? "#4CAF50" : "#D1D1D6"} />
            <Text style={splashStyles.checkText}>Loading client data</Text>
          </View>
        </View>
      </Animated.View>

      <Text style={splashStyles.version}>v1.0.0</Text>
    </View>
  );
}

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FE',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  bgCircle1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(76, 175, 80, 0.06)',
    top: -60,
    right: -80,
  },
  bgCircle2: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(76, 175, 80, 0.04)',
    bottom: -40,
    left: -60,
  },
  content: {
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 24,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a2e',
    letterSpacing: -0.5,
  },
  appTagline: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
    marginTop: 4,
    marginBottom: 40,
  },
  loadingContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  loadingBar: {
    width: 180,
    height: 4,
    backgroundColor: '#E8E8ED',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 12,
  },
  loadingFill: {
    width: '100%',
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 2,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    width: 180,
  },
  checklist: {
    alignItems: 'flex-start',
    gap: 8,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkText: {
    fontSize: 13,
    color: '#636366',
    fontWeight: '500',
  },
  version: {
    position: 'absolute',
    bottom: 40,
    fontSize: 12,
    color: '#C7C7CC',
    fontWeight: '600',
  },
});

// ── Main App (shown after loading) ──────────────────────────
function MainApp() {
  const { width } = useWindowDimensions();
  const isSmall = width < 360;
  const { dbLoaded } = useClientContext();
  const [minimumTimePassed, setMinimumTimePassed] = useState(false);
  const fadeOut = useRef(new Animated.Value(1)).current;
  const [showSplash, setShowSplash] = useState(true);

  // Enforce a minimum 2s splash so it doesn't just flash
  useEffect(() => {
    const timer = setTimeout(() => setMinimumTimePassed(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  // When both conditions are met, animate out the splash
  useEffect(() => {
    if (dbLoaded && minimumTimePassed) {
      Animated.timing(fadeOut, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => setShowSplash(false));
    }
  }, [dbLoaded, minimumTimePassed]);

  if (showSplash) {
    return (
      <Animated.View style={{ flex: 1, opacity: fadeOut }}>
        <SplashScreen dbLoaded={dbLoaded} />
      </Animated.View>
    );
  }

  return (
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
  );
}

// ── Root Export ──────────────────────────────────────────────
export default function App() {
  return (
    <ClientProvider>
      <MainApp />
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
