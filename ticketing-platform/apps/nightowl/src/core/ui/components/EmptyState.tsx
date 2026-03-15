import { StyleSheet, Text, View } from 'react-native';

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>{title}</Text>
      <Text style={styles.emptyStateDescription}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyState: {
    alignItems: 'center',
    backgroundColor: '#17253a',
    borderRadius: 20,
    gap: 8,
    padding: 22,
  },
  emptyStateTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
  },
  emptyStateDescription: {
    color: '#bcc8dc',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
