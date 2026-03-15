import { StyleSheet, Text, View } from 'react-native';

export function SummaryRow({
  label,
  value,
  emphasis,
  valueTestID,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  valueTestID?: string;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text
        testID={valueTestID}
        style={[styles.summaryValue, emphasis ? styles.summaryValueEmphasis : null]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    color: '#bcc8dc',
    fontSize: 13,
  },
  summaryValue: {
    color: '#ffffff',
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  summaryValueEmphasis: {
    color: '#f4cc8b',
    fontSize: 15,
  },
});
