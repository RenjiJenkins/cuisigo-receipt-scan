import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReceiptScanScreen, type EditableIngredient } from './src/features/receiptScan';
import { formatQuantity } from './src/features/receiptScan/categories';
import { colors, radius } from './src/features/receiptScan/theme';

/**
 * Hackathon shell. In Cuisigo, render <ReceiptScanScreen onConfirm={...} /> inside your
 * navigator and send the confirmed ingredients to the pantry / recipe search instead.
 */
function Root() {
  const [pantry, setPantry] = useState<EditableIngredient[] | null>(null);
  const insets = useSafeAreaInsets();

  if (!pantry) return <ReceiptScanScreen onConfirm={(ings) => setPantry(ings)} />;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <Text style={styles.title}>Your ingredients</Text>
      <Text style={styles.subtitle}>Next step in Cuisigo: find recipes that use these.</Text>
      <FlatList
        data={pantry}
        keyExtractor={(i) => i.id}
        style={{ marginTop: 16 }}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.qty}>{formatQuantity(item.quantity, item.unit)}</Text>
          </View>
        )}
      />
      <Pressable style={styles.btn} onPress={() => setPantry(null)}>
        <Text style={styles.btnText}>Scan another receipt</Text>
      </Pressable>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Root />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 4 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  name: { fontSize: 16, color: colors.text },
  qty: { fontSize: 14, color: colors.muted },
  btn: { backgroundColor: colors.primary, padding: 16, borderRadius: radius.lg, alignItems: 'center' },
  btnText: { color: colors.primaryText, fontWeight: '700', fontSize: 16 },
});
