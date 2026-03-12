import { Pressable, Text, View } from 'react-native';

import { buildPassMatrix } from '../utils';
import { styles } from './eventsScreenStyles';

export function TabButton({
  label,
  isActive,
  onPress,
  count,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
  count?: number;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.tabButton, isActive ? styles.tabButtonActive : null]}>
      <Text style={[styles.tabButtonText, isActive ? styles.tabButtonTextActive : null]}>
        {label}
        {typeof count === 'number' ? ` ${count}` : ''}
      </Text>
    </Pressable>
  );
}

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

export function SellableCard({
  label,
  description,
  price,
  availability,
  inCart,
  quantity,
  busy,
  onDecrease,
  onIncrease,
  onAdd,
  actionLabel,
  category,
}: {
  label: string;
  description: string | null;
  price: string;
  availability: string;
  inCart: number;
  quantity: number;
  busy: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
  onAdd: () => void;
  actionLabel: string;
  category?: string;
}) {
  return (
    <View style={styles.sellableCard}>
      <View style={styles.sellableTopRow}>
        <View style={styles.sellableCopy}>
          <Text style={styles.sellableTitle}>{label}</Text>
          <Text style={styles.sellableDescription}>{description ?? 'Details coming soon.'}</Text>
        </View>

        {category ? (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{category}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.sellableMetaRow}>
        <Text style={styles.sellablePrice}>{price}</Text>
        <Text style={styles.sellableAvailability}>{availability}</Text>
        {inCart ? <Text style={styles.sellableInCart}>{inCart} in cart</Text> : null}
      </View>

      <View style={styles.sellableActions}>
        <QuantityControl quantity={quantity} onDecrease={onDecrease} onIncrease={onIncrease} disabled={busy} />

        <Pressable onPress={onAdd} disabled={busy} style={[styles.primaryButton, busy ? styles.buttonDisabled : null]}>
          <Text style={styles.primaryButtonText}>{busy ? 'Adding...' : actionLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>{title}</Text>
      <Text style={styles.emptyStateDescription}>{description}</Text>
    </View>
  );
}

export function SummaryRow({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, emphasis ? styles.summaryValueEmphasis : null]}>{value}</Text>
    </View>
  );
}

export function PassMatrix({ payload }: { payload: string }) {
  const matrix = buildPassMatrix(payload);

  return (
    <View style={styles.passMatrix}>
      {matrix.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.passMatrixRow}>
          {row.map((cell, cellIndex) => (
            <View key={`${rowIndex}-${cellIndex}`} style={[styles.passMatrixCell, cell ? styles.passMatrixOn : null]} />
          ))}
        </View>
      ))}
    </View>
  );
}
