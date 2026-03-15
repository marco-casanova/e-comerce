import { Pressable, StyleSheet, Text, View } from 'react-native';

export function QuantityControl({
  quantity,
  onDecrease,
  onIncrease,
  disabled,
}: {
  quantity: number;
  onDecrease: () => void;
  onIncrease: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.quantityControl}>
      <Pressable onPress={onDecrease} disabled={disabled} style={styles.quantityButton}>
        <Text style={styles.quantityButtonText}>-</Text>
      </Pressable>
      <Text style={styles.quantityValue}>{quantity}</Text>
      <Pressable onPress={onIncrease} disabled={disabled} style={styles.quantityButton}>
        <Text style={styles.quantityButtonText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  quantityControl: {
    alignItems: 'center',
    backgroundColor: '#111c2e',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  quantityButton: {
    alignItems: 'center',
    backgroundColor: '#22314c',
    borderRadius: 999,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  quantityButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  quantityValue: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    minWidth: 20,
    textAlign: 'center',
  },
});
