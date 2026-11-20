import { memo } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatQuantity } from './categories';
import { colors, radius } from './theme';
import type { EditableIngredient } from './types';

interface Props {
  item: EditableIngredient;
  onToggle: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
}

function IngredientRowBase({ item, onToggle, onRename, onRemove }: Props) {
  const qty = formatQuantity(item.quantity, item.unit);
  const needsCheck = item.confidence === 'low';

  return (
    <View style={[styles.row, !item.selected && styles.rowOff]}>
      <Pressable
        onPress={() => onToggle(item.id)}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.selected }}
        accessibilityLabel={`Include ${item.name}`}
        style={[styles.check, item.selected && styles.checkOn]}
      >
        {item.selected ? <Text style={styles.checkMark}>✓</Text> : null}
      </Pressable>

      <View style={styles.body}>
        <TextInput
          value={item.name}
          onChangeText={(t) => onRename(item.id, t)}
          style={styles.name}
          autoCapitalize="none"
          accessibilityLabel="Ingredient name"
        />
        <Text style={styles.source} numberOfLines={1}>
          {item.source_lines.join(' · ') || 'Added manually'}
        </Text>
      </View>

      {needsCheck ? <Text style={styles.badge}>check</Text> : null}
      {qty ? <Text style={styles.qty}>{qty}</Text> : null}

      <Pressable onPress={() => onRemove(item.id)} hitSlop={10} accessibilityLabel={`Remove ${item.name}`}>
        <Text style={styles.remove}>✕</Text>
      </Pressable>
    </View>
  );
}

export const IngredientRow = memo(IngredientRowBase);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: 8,
  },
  rowOff: { opacity: 0.45 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkMark: { color: colors.primaryText, fontWeight: '700', fontSize: 14 },
  body: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text, padding: 0 },
  source: { fontSize: 12, color: colors.muted, marginTop: 2 },
  qty: { fontSize: 13, color: colors.muted, fontVariant: ['tabular-nums'] },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.warn,
    backgroundColor: colors.warnBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  remove: { fontSize: 16, color: colors.muted, paddingHorizontal: 2 },
});
