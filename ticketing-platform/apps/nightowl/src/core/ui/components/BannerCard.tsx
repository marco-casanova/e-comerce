import { StyleSheet, Text, View } from 'react-native';

export function BannerCard({
  tone,
  message,
  compact,
}: {
  tone: 'error' | 'success' | 'info';
  message: string;
  compact?: boolean;
}) {
  return (
    <View
      style={[
        styles.banner,
        tone === 'error' ? styles.bannerError : null,
        tone === 'success' ? styles.bannerSuccess : null,
        compact ? styles.bannerCompact : null,
      ]}
    >
      <Text style={styles.bannerText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#19324f',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  bannerCompact: {
    marginTop: 14,
  },
  bannerError: {
    backgroundColor: '#4b2128',
  },
  bannerSuccess: {
    backgroundColor: '#1d4b37',
  },
  bannerText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 20,
  },
});
