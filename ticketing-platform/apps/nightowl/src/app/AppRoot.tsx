import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from '../core/auth/AuthProvider';
import { LoginScreen } from '../features/auth/components/LoginScreen';
import { EventsScreen } from '../features/events/components/EventsScreen';

function RootContent() {
  const { isHydrating, session } = useAuth();

  if (isHydrating) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator color="#f0b35c" size="large" />
        <Text style={styles.loadingText}>Preparing Night Owl</Text>
      </View>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return <EventsScreen />;
}

export function AppRoot() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthProvider>
        <SafeAreaView style={styles.container}>
          <RootContent />
        </SafeAreaView>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1220',
  },
  loadingState: {
    alignItems: 'center',
    flex: 1,
    gap: 14,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    color: '#d7ddeb',
    fontSize: 16,
    fontWeight: '600',
  },
});
