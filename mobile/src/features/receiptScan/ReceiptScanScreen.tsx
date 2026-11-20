import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { scanReceipt, type ScanOptions } from './api';
import { CATEGORY_META } from './categories';
import { IngredientRow } from './IngredientRow';
import { pickReceiptImage, type PickSource } from './pickImage';
import { colors, radius } from './theme';
import type { EditableIngredient, ReceiptScanResponse, ScanLanguage } from './types';

type Phase =
  | { kind: 'idle' }
  | { kind: 'scanning'; imageUri: string }
  | { kind: 'review'; imageUri: string; receipt: ReceiptScanResponse }
  | { kind: 'error'; message: string; imageUri?: string };

export interface ReceiptScanScreenProps {
  /** Called with the ingredients the user kept. In Cuisigo: add to pantry / search recipes. */
  onConfirm: (ingredients: EditableIngredient[], receipt: ReceiptScanResponse) => void;
  /** API URL, auth headers, etc. */
  scanOptions?: Omit<ScanOptions, 'lang' | 'signal'>;
  defaultLanguage?: ScanLanguage;
}

let nextId = 0;
const newId = () => `ing-${nextId++}`;

export function ReceiptScanScreen({ onConfirm, scanOptions, defaultLanguage = 'en' }: ReceiptScanScreenProps) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [items, setItems] = useState<EditableIngredient[]>([]);
  const [lang, setLang] = useState<ScanLanguage>(defaultLanguage);
  const [draft, setDraft] = useState('');
  const [showNonFood, setShowNonFood] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const runScan = useCallback(
    async (source: PickSource) => {
      let imageUri: string | null;
      try {
        imageUri = await pickReceiptImage(source);
      } catch (e) {
        setPhase({ kind: 'error', message: (e as Error).message });
        return;
      }
      if (!imageUri) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setPhase({ kind: 'scanning', imageUri });
      try {
        const receipt = await scanReceipt(imageUri, { ...scanOptions, lang, signal: controller.signal });
        setItems(receipt.ingredients.map((i) => ({ ...i, id: newId(), selected: true })));
        setShowNonFood(false);
        setPhase({ kind: 'review', imageUri, receipt });
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        setPhase({ kind: 'error', message: (e as Error).message, imageUri });
      }
    },
    [lang, scanOptions],
  );

  const cancelScan = () => {
    abortRef.current?.abort();
    setPhase({ kind: 'idle' });
  };

  const toggle = useCallback(
    (id: string) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, selected: !x.selected } : x))),
    [],
  );
  const rename = useCallback(
    (id: string, name: string) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, name } : x))),
    [],
  );
  const remove = useCallback((id: string) => setItems((xs) => xs.filter((x) => x.id !== id)), []);

  const addManual = () => {
    const name = draft.trim().toLowerCase();
    if (!name) return;
    setItems((xs) => [
      ...xs,
      { id: newId(), name, category: 'other_food', quantity: null, unit: null, confidence: 'high', source_lines: [], selected: true },
    ]);
    setDraft('');
  };

  const sections = useMemo(() => {
    const groups = new Map<string, EditableIngredient[]>();
    for (const it of items) {
      const list = groups.get(it.category) ?? [];
      list.push(it);
      groups.set(it.category, list);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => CATEGORY_META[a as keyof typeof CATEGORY_META].order - CATEGORY_META[b as keyof typeof CATEGORY_META].order)
      .map(([cat, data]) => ({ key: cat, meta: CATEGORY_META[cat as keyof typeof CATEGORY_META], data }));
  }, [items]);

  const selected = items.filter((i) => i.selected && i.name.trim());

  // ---------- idle / scanning / error ----------
  if (phase.kind !== 'review') {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        {phase.kind === 'scanning' ? (
          <>
            <Image source={{ uri: phase.imageUri }} style={styles.preview} resizeMode="cover" />
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
            <Text style={styles.title}>Reading your receipt…</Text>
            <Text style={styles.subtitle}>Decoding abbreviations and sorting out the groceries.</Text>
            <Pressable onPress={cancelScan} style={styles.linkBtn}>
              <Text style={styles.linkText}>Cancel</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.hero}>🧾 → 🥕</Text>
            <Text style={styles.title}>Scan a grocery receipt</Text>
            <Text style={styles.subtitle}>
              Snap a photo and we'll turn it into an ingredient list you can cook from.
            </Text>

            {phase.kind === 'error' ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{phase.message}</Text>
              </View>
            ) : null}

            <View style={styles.langRow}>
              {(['en', 'fr'] as const).map((l) => (
                <Pressable
                  key={l}
                  onPress={() => setLang(l)}
                  style={[styles.langChip, lang === l && styles.langChipOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: lang === l }}
                >
                  <Text style={[styles.langText, lang === l && styles.langTextOn]}>
                    {l === 'en' ? 'English names' : 'Noms en français'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {Platform.OS !== 'web' ? (
              <Pressable style={styles.primaryBtn} onPress={() => runScan('camera')}>
                <Text style={styles.primaryText}>Take photo</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={Platform.OS === 'web' ? styles.primaryBtn : styles.secondaryBtn}
              onPress={() => runScan('library')}
            >
              <Text style={Platform.OS === 'web' ? styles.primaryText : styles.secondaryText}>
                Choose from {Platform.OS === 'web' ? 'files' : 'photos'}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    );
  }

  // ---------- review ----------
  const { receipt } = phase;
  const meta = [receipt.store_name, receipt.purchase_date].filter(Boolean).join(' · ');

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <SectionList
        sections={sections}
        keyExtractor={(i) => i.id}
        stickySectionHeadersEnabled={false}
        initialNumToRender={60}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: 140 + insets.bottom }}
        ListHeaderComponent={
          <View style={styles.reviewHeader}>
            <Image source={{ uri: phase.imageUri }} style={styles.thumb} />
            <View style={{ flex: 1 }}>
              <Text style={styles.reviewTitle}>{items.length} ingredients found</Text>
              {meta ? <Text style={styles.subtitleLeft}>{meta}</Text> : null}
              <Text style={styles.hint}>Tap a name to fix it. Untick anything you don't want.</Text>
            </View>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>
            {section.meta.emoji} {section.meta.label}
          </Text>
        )}
        renderItem={({ item }) => <IngredientRow item={item} onToggle={toggle} onRename={rename} onRemove={remove} />}
        ListFooterComponent={
          <View>
            <View style={styles.addRow}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={addManual}
                placeholder="Add something we missed…"
                placeholderTextColor={colors.muted}
                style={styles.addInput}
                returnKeyType="done"
                autoCapitalize="none"
              />
              <Pressable onPress={addManual} style={styles.addBtn} accessibilityLabel="Add ingredient">
                <Text style={styles.primaryText}>Add</Text>
              </Pressable>
            </View>

            {receipt.non_food_lines.length ? (
              <Pressable onPress={() => setShowNonFood((s) => !s)} style={{ marginTop: 16 }}>
                <Text style={styles.linkText}>
                  {showNonFood ? 'Hide' : 'Show'} {receipt.non_food_lines.length} skipped non-food lines
                </Text>
                {showNonFood ? (
                  <Text style={styles.nonFood}>{receipt.non_food_lines.join('\n')}</Text>
                ) : null}
              </Pressable>
            ) : null}
          </View>
        }
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable style={styles.secondaryBtnSmall} onPress={() => setPhase({ kind: 'idle' })}>
          <Text style={styles.secondaryText}>Rescan</Text>
        </Pressable>
        <Pressable
          style={[styles.primaryBtn, styles.footerPrimary, !selected.length && styles.disabled]}
          disabled={!selected.length}
          onPress={() => onConfirm(selected, receipt)}
        >
          <Text style={styles.primaryText}>Use {selected.length} ingredients</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  hero: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text, textAlign: 'center', marginTop: 12 },
  subtitle: { fontSize: 15, color: colors.muted, textAlign: 'center', marginTop: 8, maxWidth: 320, lineHeight: 21 },
  subtitleLeft: { fontSize: 14, color: colors.muted, marginTop: 2 },
  hint: { fontSize: 13, color: colors.muted, marginTop: 6 },
  preview: { width: 160, height: 220, borderRadius: radius.md, backgroundColor: colors.border },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: radius.lg,
    alignSelf: 'center',
    alignItems: 'center',
    marginTop: 12,
    maxWidth: 420,
    width: '100%',
  },
  primaryText: { color: colors.primaryText, fontWeight: '700', fontSize: 16 },
  secondaryBtn: {
    paddingVertical: 16,
    borderRadius: radius.lg,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
    marginTop: 12,
    maxWidth: 420,
    width: '100%',
  },
  secondaryBtnSmall: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
  },
  secondaryText: { color: colors.primary, fontWeight: '700', fontSize: 16 },
  linkBtn: { marginTop: 20, padding: 8 },
  linkText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  disabled: { opacity: 0.4 },
  errorBox: {
    backgroundColor: '#FCE8E6',
    borderRadius: radius.sm,
    padding: 12,
    marginTop: 20,
    maxWidth: 420,
    width: '100%',
  },
  errorText: { color: colors.danger, fontSize: 14, textAlign: 'center' },
  langRow: { flexDirection: 'row', gap: 8, marginTop: 28, marginBottom: 8 },
  langChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  langChipOn: { borderColor: colors.primary, backgroundColor: '#E7F2EB' },
  langText: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  langTextOn: { color: colors.primary },
  reviewHeader: { flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 8 },
  thumb: { width: 56, height: 76, borderRadius: radius.sm, backgroundColor: colors.border },
  reviewTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 18,
    marginBottom: 8,
  },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  addInput: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  addBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: 18, justifyContent: 'center' },
  nonFood: { color: colors.muted, fontSize: 13, marginTop: 8, lineHeight: 20 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  footerPrimary: { flex: 1, marginTop: 0, width: undefined, alignSelf: 'auto' },
});
