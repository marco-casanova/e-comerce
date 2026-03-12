import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppProviders } from './AppProviders';
import { RootNavigator } from './RootNavigator';

export function AppRoot() {
  return (
    <AppProviders>
      <SafeAreaView style={styles.container}>
        <RootNavigator />
      </SafeAreaView>
    </AppProviders>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1220',
  },
});
