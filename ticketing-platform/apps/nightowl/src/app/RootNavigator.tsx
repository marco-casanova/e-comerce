import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useAuth } from "../core/auth/AuthProvider";
import { LoginScreen } from "../features/auth/screens/LoginScreen";
import { EventsScreen } from "../features/events/screens/EventsScreen";

export function RootNavigator() {
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

const styles = StyleSheet.create({
  loadingState: {
    alignItems: "center",
    flex: 1,
    gap: 14,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  loadingText: {
    color: "#d7ddeb",
    fontSize: 16,
    fontWeight: "600",
  },
});
