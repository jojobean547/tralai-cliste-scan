// The confirm card (step 4 of the mockup). UI only: the form, its errors and the
// notes come from hooks/useScanScreen.ts; changes go back through onChange.
// Used for typed-in prices now, and filled in by the scanner later.
// The barcode look-up (Open Food Facts) is optional: the button only shows when
// the screen passes onLookUp.

import { CategoryPicker } from '@/components/CategoryPicker';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StoreBadge } from '@/components/ui/StoreBadge';
import { TouchTargets } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import type { ConfirmForm, DealChoice, FormErrors } from '@/lib/confirmForm';
import type { LookupStatus } from '@/lib/productLookup';
import { Image, Pressable, Switch, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';

// The − and + buttons look compact (40 high), matching the basket, but an
// invisible margin (hitSlop) keeps the area you can tap at the full 56 high
// for older shoppers.
const STEP_HEIGHT = 40;
const STEP_WIDTH = 48;

type Props = {
  title: string;
  form: ConfirmForm;
  errors: FormErrors;
  notes: string[];
  store: string;
  clubCardName: string | null;   // e.g. 'Tesco Clubcard'
  showClubPrice: boolean;        // only for stores that print club prices on labels
  onChange: <K extends keyof ConfirmForm>(key: K, value: ConfirmForm[K]) => void;
  onChooseDeal: (choice: DealChoice) => void;
  onCancel: () => void;
  onAdd: () => void;
  lookupStatus?: LookupStatus;
  lookupMessage?: string | null;
  onLookUp?: () => void;
};

// A labelled text box. It must live outside ConfirmCard: a component defined
// inside another is rebuilt on every keystroke, which closes the keyboard.
type LabeledInputProps = {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  error?: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  hint?: string;
  prefix?: string;
};

function LabeledInput(p: LabeledInputProps) {
  const { colors, typography, spacing, radii } = useTheme();
  return (
    <View>
      <Text style={{ fontSize: typography.bodySmall, fontWeight: typography.semibold, color: colors.textPrimary, marginBottom: spacing.xs }}>
        {p.label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {!!p.prefix && <Text style={{ fontSize: typography.heading3, color: colors.textPrimary }}>{p.prefix}</Text>}
        <TextInput
          value={p.value}
          onChangeText={p.onChangeText}
          placeholder={p.placeholder}
          placeholderTextColor={colors.textSecondary}
          keyboardType={p.keyboardType}
          accessibilityLabel={p.label}
          style={{
            flex: 1,
            minHeight: TouchTargets.minHeight,
            paddingHorizontal: spacing.md,
            borderRadius: radii.md,
            borderWidth: p.error ? 2 : 1,
            borderColor: p.error ? colors.error : colors.border,
            backgroundColor: colors.surface,
            color: colors.textPrimary,
            fontSize: typography.heading3,
          }}
        />
      </View>
      {!!p.error && <Text style={{ fontSize: typography.caption, color: colors.error, marginTop: spacing.xs }}>{p.error}</Text>}
      {!p.error && !!p.hint && <Text style={{ fontSize: typography.caption, color: colors.textSecondary, marginTop: spacing.xs }}>{p.hint}</Text>}
    </View>
  );
}

export function ConfirmCard(props: Props) {
  const { title, form, errors, notes, store, clubCardName, showClubPrice, onChange, onChooseDeal, onCancel, onAdd } = props;
  const { lookupStatus = 'idle', lookupMessage, onLookUp } = props;
  const lookingUp = lookupStatus === 'loading';
  const found = lookupStatus === 'found';
  const { colors, typography, spacing, radii } = useTheme();

  const label = { fontSize: typography.bodySmall, fontWeight: typography.semibold, color: colors.textPrimary, marginBottom: spacing.xs };
  const hint = { fontSize: typography.caption, color: colors.textSecondary, marginTop: spacing.xs };
  const errorText = { fontSize: typography.caption, color: colors.error, marginTop: spacing.xs };
  const inputStyle = (hasError: boolean) => ({
    minHeight: TouchTargets.minHeight,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: hasError ? 2 : 1,
    borderColor: hasError ? colors.error : colors.border,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    fontSize: typography.heading3,
  });

  const smallBox = (hasError: boolean) => ({ ...inputStyle(hasError), width: 72, textAlign: 'center' as const });

  const slop = Math.max(0, Math.ceil((TouchTargets.minHeight - STEP_HEIGHT) / 2));
  const stepHitSlop = { top: slop, bottom: slop, left: 4, right: 4 };
  const stepButton = { width: STEP_WIDTH, height: STEP_HEIGHT, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center' as const, justifyContent: 'center' as const };
  const stepLabel = { fontSize: typography.heading3, fontWeight: typography.semibold, color: colors.textPrimary };

  const dealPill = (choice: DealChoice, text: string) => {
    const selected = form.dealChoice === choice;
    return (
      <Pressable
        key={choice}
        onPress={() => onChooseDeal(choice)}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        style={{
          minHeight: TouchTargets.minHeight - 8,
          paddingHorizontal: spacing.md,
          justifyContent: 'center',
          borderRadius: radii.pill,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? colors.primaryGreen : colors.border,
          backgroundColor: selected ? colors.greenTintBg : colors.surface,
        }}
      >
        <Text style={{ fontSize: typography.bodySmall, fontWeight: selected ? typography.semibold : typography.regular, color: selected ? colors.primaryGreen : colors.textPrimary }}>
          {text}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: typography.heading2, fontWeight: typography.bold, color: colors.textPrimary }}>{title}</Text>
        <StoreBadge store={store} size="sm" />
      </View>

      {notes.length > 0 && (
        <Card variant="gold">
          {notes.map((n) => (
            <Text key={n} style={{ fontSize: typography.bodySmall, color: colors.textPrimary }}>{n}</Text>
          ))}
        </Card>
      )}

      <LabeledInput
        label="Shelf price"
        prefix="€"
        value={form.priceText}
        onChangeText={(t) => onChange('priceText', t)}
        placeholder="1.29"
        keyboardType="decimal-pad"
        error={errors.price}
      />

      {showClubPrice && !!clubCardName && (
        <LabeledInput
          label={`${clubCardName} price (optional)`}
          prefix="€"
          value={form.clubPriceText}
          onChangeText={(t) => onChange('clubPriceText', t)}
          placeholder="0.99"
          keyboardType="decimal-pad"
          error={errors.clubPrice}
          hint="Only if the label shows a separate club card price"
        />
      )}

      <View>
        <Text style={label}>Deal on this item?</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {dealPill('none', 'No deal')}
          {dealPill('price', 'e.g. 3 for €4')}
          {dealPill('qty', 'e.g. 3 for 2')}
        </View>

        {form.dealChoice !== 'none' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
            <TextInput
              value={form.dealQtyText}
              onChangeText={(t) => onChange('dealQtyText', t)}
              keyboardType="number-pad"
              placeholder="3"
              placeholderTextColor={colors.textSecondary}
              accessibilityLabel="How many for the deal"
              style={smallBox(!!errors.dealQty)}
            />
            <Text style={{ fontSize: typography.heading3, color: colors.textPrimary }}>for</Text>
            {form.dealChoice === 'price' ? (
              <>
                <Text style={{ fontSize: typography.heading3, color: colors.textPrimary }}>€</Text>
                <TextInput
                  value={form.dealPriceText}
                  onChangeText={(t) => onChange('dealPriceText', t)}
                  keyboardType="decimal-pad"
                  placeholder="4.00"
                  placeholderTextColor={colors.textSecondary}
                  accessibilityLabel="Deal price"
                  style={{ ...smallBox(!!errors.dealPrice), width: 110 }}
                />
              </>
            ) : (
              <TextInput
                value={form.dealPayText}
                onChangeText={(t) => onChange('dealPayText', t)}
                keyboardType="number-pad"
                placeholder="2"
                placeholderTextColor={colors.textSecondary}
                accessibilityLabel="How many you pay for"
                style={smallBox(!!errors.dealPay)}
              />
            )}
          </View>
        )}
        {form.dealChoice === 'qty' && !errors.dealPay && !errors.dealQty && <Text style={hint}>Cheapest one free</Text>}
        {!!errors.dealQty && <Text style={errorText}>{errors.dealQty}</Text>}
        {!!errors.dealPrice && <Text style={errorText}>{errors.dealPrice}</Text>}
        {!!errors.dealPay && <Text style={errorText}>{errors.dealPay}</Text>}

        {form.dealChoice !== 'none' && showClubPrice && !!clubCardName && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md }}>
            <Text style={{ flex: 1, fontSize: typography.bodySmall, color: colors.textPrimary }}>Only with {clubCardName}</Text>
            <Switch
              value={form.clubOnly}
              onValueChange={(v) => onChange('clubOnly', v)}
              accessibilityLabel={`Deal only with ${clubCardName}`}
              trackColor={{ true: colors.primaryGreen, false: colors.border }}
            />
          </View>
        )}
      </View>

      <View>
        <Text style={label}>How many?</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Pressable
            onPress={() => onChange('quantity', Math.max(1, form.quantity - 1))}
            accessibilityRole="button"
            accessibilityLabel="One fewer"
            hitSlop={stepHitSlop}
            style={stepButton}
          >
            <Text style={stepLabel}>−</Text>
          </Pressable>
          <Text accessibilityLabel={`Quantity ${form.quantity}`} style={{ minWidth: 28, textAlign: 'center', fontSize: typography.heading3, fontWeight: typography.bold, color: colors.textPrimary }}>
            {form.quantity}
          </Text>
          <Pressable
            onPress={() => onChange('quantity', form.quantity + 1)}
            accessibilityRole="button"
            accessibilityLabel="One more"
            hitSlop={stepHitSlop}
            style={stepButton}
          >
            <Text style={stepLabel}>+</Text>
          </Pressable>
        </View>
      </View>

      <Text style={{ fontSize: typography.heading3, fontWeight: typography.semibold, color: colors.textPrimary, marginTop: spacing.sm }}>
        Optional
      </Text>

      <LabeledInput
        label="Barcode"
        value={form.barcodeText}
        onChangeText={(t) => onChange('barcodeText', t)}
        placeholder="13 digits under the barcode"
        keyboardType="number-pad"
        error={errors.barcode}
        hint={onLookUp ? 'Type the numbers under the barcode, then tap Look up product' : 'Scanning the barcode with the camera is coming in a later update'}
      />

      {!!onLookUp && (
        <View style={{ gap: spacing.sm }}>
          <Button variant="secondary" onPress={() => { if (!lookingUp) onLookUp(); }}>
            {lookingUp ? 'Looking up…' : 'Look up product'}
          </Button>

          {!!lookupMessage && (
            <Text
              accessibilityLiveRegion="polite"
              style={{ fontSize: typography.bodySmall, color: found ? colors.primaryGreen : lookupStatus === 'unavailable' ? colors.error : colors.textSecondary }}
            >
              {lookupMessage}
            </Text>
          )}

          {found && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              {!!form.imageUrl && (
                <Image
                  source={{ uri: form.imageUrl }}
                  accessibilityIgnoresInvertColors
                  accessible={false}
                  resizeMode="contain"
                  style={{ width: 72, height: 72, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
                />
              )}
              <Text style={{ flex: 1, fontSize: typography.caption, color: colors.textSecondary }}>
                Product information from Open Food Facts
              </Text>
            </View>
          )}
        </View>
      )}

      <LabeledInput
        label="Product name"
        value={form.name}
        onChangeText={(t) => onChange('name', t)}
        placeholder="e.g. Beans 415g"
      />

      <View>
        <Text style={label}>Category</Text>
        <CategoryPicker value={form.category} onChange={(c) => onChange('category', c)} />
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
        <Button variant="secondary" onPress={onCancel} fullWidth={false} style={{ paddingHorizontal: spacing.xl }}>Cancel</Button>
        <Button variant="primary" onPress={onAdd} style={{ flex: 1 }}>Add to basket</Button>
      </View>
    </View>
  );
}
