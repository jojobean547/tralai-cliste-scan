// The Scan screen: pick your store, then add items.
// For now items are typed in; the camera arrives with the development build.

import { ConfirmCard } from '@/components/ConfirmCard';
import { StorePicker } from '@/components/StorePicker';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StoreBadge } from '@/components/ui/StoreBadge';
import { useScanScreen } from '@/hooks/useScanScreen';
import { useTheme } from '@/hooks/useTheme';
import { euro } from '@/lib/basketDisplay';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ScanScreen() {
  const { colors, typography, spacing, radii } = useTheme();
  const scan = useScanScreen();

  // For a moment at start-up while the saved store is read
  if (!scan.loaded) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header: app name, and the store you're in (tap to change) */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.md }}>
        <Text style={{ fontSize: typography.heading2, fontWeight: typography.bold, color: colors.textPrimary }}>Tralaí Cliste</Text>
        {!!scan.store && (
          <Pressable
            onPress={scan.changeStore}
            accessibilityRole="button"
            accessibilityLabel={`Store: ${scan.store}. Tap to change.`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 48 }}
          >
            <StoreBadge store={scan.store} />
            <MaterialCommunityIcons name="chevron-down" size={24} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          {scan.step === 'pickStore' && (
            <Card>
              <Text style={{ fontSize: typography.bodySmall, color: colors.textSecondary }}>Scanning in store</Text>
              <Text style={{ fontSize: typography.heading3, fontWeight: typography.semibold, color: colors.textPrimary, marginVertical: spacing.sm }}>
                Which store are you in?
              </Text>
              <StorePicker onPick={scan.chooseStore} />
            </Card>
          )}

          {scan.step === 'ready' && (
            <>
              {!!scan.lastAdded && (
                <Card style={{ backgroundColor: colors.greenTintBg, borderColor: colors.primaryGreen }}>
                  <Text style={{ fontSize: typography.body, color: colors.greenTintText, fontWeight: typography.semibold }}>✓ {scan.lastAdded}</Text>
                </Card>
              )}

              {/* The camera arrives later; until then this area explains what it will do */}
              <View
                style={{
                  minHeight: 200, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border, borderRadius: radii.lg,
                  backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm,
                }}
              >
                <MaterialCommunityIcons name="camera-outline" size={44} color={colors.textSecondary} />
                <Text style={{ fontSize: typography.body, color: colors.textSecondary, textAlign: 'center' }}>
                  Scanning price labels with the camera is coming soon
                </Text>
              </View>

              <Button variant="primary" onPress={scan.startManualEntry}>Type the price in</Button>
            </>
          )}

          {scan.step === 'confirm' && !!scan.store && (
            <ConfirmCard
              title="Add an item"
              form={scan.form}
              errors={scan.errors}
              notes={scan.notes}
              store={scan.store}
              clubCardName={scan.clubCard?.name ?? null}
              showClubPrice={!!scan.clubCard?.priceOnLabel}
              onChange={scan.setField}
              onChooseDeal={scan.chooseDeal}
              onCancel={scan.cancelEntry}
              onAdd={scan.addToBasket}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Running basket total; tap to open the basket */}
      {scan.step !== 'confirm' && scan.itemCount > 0 && (
        <Pressable
          onPress={() => router.navigate('/basket')}
          accessibilityRole="button"
          accessibilityLabel={`Basket: ${scan.itemCount} items, ${euro(scan.total)}. Open basket.`}
          style={{
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 64,
            paddingHorizontal: spacing.xl, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
          }}
        >
          <Text style={{ fontSize: typography.body, color: colors.textSecondary }}>
            In your basket: {scan.itemCount} {scan.itemCount === 1 ? 'item' : 'items'}
          </Text>
          <Text style={{ fontSize: typography.heading2, fontWeight: typography.bold, color: colors.textPrimary }}>{euro(scan.total)}</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}
