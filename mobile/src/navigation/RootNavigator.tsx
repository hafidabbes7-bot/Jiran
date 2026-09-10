import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NavigationContainer, useNavigationContainerRef, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { SosFab } from '../components/SosFab';
import { useI18n } from '../i18n/I18nProvider';
import { AlertsScreen } from '../screens/AlertsScreen';
import { ComposeScreen } from '../screens/ComposeScreen';
import { FeedScreen } from '../screens/FeedScreen';
import { NeighborhoodScreen } from '../screens/NeighborhoodScreen';
import { PostDetailScreen } from '../screens/PostDetailScreen';
import { SosScreen } from '../screens/SosScreen';
import { colors, fontSizes } from '../theme/theme';
import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

const navigationTheme: Theme = {
  dark: false,
  colors: {
    primary: colors.brand,
    background: colors.paper,
    card: colors.paper,
    text: colors.ink,
    border: colors.line,
    notification: colors.alert,
  },
  fonts: {
    regular: { fontFamily: 'System', fontWeight: '400' },
    medium: { fontFamily: 'System', fontWeight: '500' },
    bold: { fontFamily: 'System', fontWeight: '700' },
    heavy: { fontFamily: 'System', fontWeight: '800' },
  },
};

const TabIcon = ({ emoji, focused }: { emoji: string; focused: boolean }) => (
  <Text style={[styles.tabIcon, focused && styles.tabIconFocused]}>{emoji}</Text>
);

function TabsNavigator() {
  const { s } = useI18n();

  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="Feed"
        component={FeedScreen}
        options={{
          title: s.nav.feed,
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏘️" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="Alerts"
        component={AlertsScreen}
        options={{
          title: s.nav.alerts,
          tabBarIcon: ({ focused }) => <TabIcon emoji="🚨" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="Neighborhood"
        component={NeighborhoodScreen}
        options={{
          title: s.nav.neighborhood,
          tabBarIcon: ({ focused }) => <TabIcon emoji="📍" focused={focused} />,
        }}
      />
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  const { s } = useI18n();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const [currentRoute, setCurrentRoute] = useState<string | undefined>();

  return (
    <View style={styles.root}>
      <NavigationContainer
        ref={navigationRef}
        theme={navigationTheme}
        onReady={() => setCurrentRoute(navigationRef.getCurrentRoute()?.name)}
        onStateChange={() => setCurrentRoute(navigationRef.getCurrentRoute()?.name)}
      >
        <Stack.Navigator screenOptions={{ headerTitleStyle: styles.headerTitle }}>
          <Stack.Screen name="Tabs" component={TabsNavigator} options={{ headerShown: false }} />
          <Stack.Screen
            name="Compose"
            component={ComposeScreen}
            options={{ title: s.compose.title }}
          />
          <Stack.Screen
            name="PostDetail"
            component={PostDetailScreen}
            options={{ title: s.detail.repliesTitle }}
          />
          <Stack.Screen name="Sos" component={SosScreen} options={{ title: s.sos.title }} />
        </Stack.Navigator>
      </NavigationContainer>

      {currentRoute === 'Sos' ? null : (
        <SosFab onPress={() => navigationRef.navigate('Sos')} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabBar: { backgroundColor: colors.paper, borderTopColor: colors.line },
  tabLabel: { fontSize: fontSizes.caption, fontWeight: '600' },
  tabIcon: { fontSize: fontSizes.title, opacity: 0.6 },
  tabIconFocused: { opacity: 1 },
  headerTitle: { color: colors.ink, fontSize: fontSizes.title, fontWeight: '700' },
});
