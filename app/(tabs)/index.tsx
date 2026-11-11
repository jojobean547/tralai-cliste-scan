// The Scan screen: pick your store, then add items.
// Photograph the price label (read on the phone by ML Kit), or type the price in.
// The product barcode can also be scanned with the camera.

import { BarcodeScanner } from '@/components/BarcodeScanner';
import { ConfirmCard } from '@/components/ConfirmCard';
import { LabelCamera } from '@/components/LabelCamera';
import { StorePicker } from '@/components/StorePicker';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StoreBadge } from '@/components/ui/StoreBadge';
import { useScanScreen } from '@/hooks/useScanScreen';
import { useTheme } from '@/hooks/useTheme';
import { euro } from '@/lib/basketDisplay';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
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

              {scan.readingLabel ? (
                <View
                  accessibilityLiveRegion="polite"
                  style={{
                    minHeight: 200, borderRadius: radii.lg, backgroundColor: colors.surfaceAlt,
                    alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md,
                  }}
                >
                  <ActivityIndicator size="large" color={colors.primaryGreen} />
                  <Text style={{ fontSize: typography.body, color: colors.textPrimary }}>Reading the label…</Text>
                </View>
              ) : (
                <Pressable
                  onPress={scan.scanLabel}
                  accessibilityRole="button"
                  accessibilityLabel="Scan price label"
                  style={({ pressed }) => ({
                    minHeight: 200, borderRadius: radii.lg, backgroundColor: colors.primaryGreen, opacity: pressed ? 0.85 : 1,
                    alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm,
                  })}
                >
                  <MaterialCommunityIcons name="camera-outline" size={56} color={colors.buttonPrimaryText} />
                  <Text style={{ fontSize: typography.heading2, fontWeight: typography.bold, color: colors.buttonPrimaryText }}>Scan price label</Text>
                  <Text style={{ fontSize: typography.bodySmall, color: colors.buttonPrimaryText, textAlign: 'center' }}>
                    Take a photo of the shelf label
                  </Text>
                </Pressable>
              )}

              {!!scan.labelMessage && (
                <Card variant="gold">
                  <Text style={{ fontSize: typography.body, color: colors.textPrimary }}>{scan.labelMessage}</Text>
                  {scan.labelCameraBlocked && (
                    <Button variant="secondary" size="sm" onPress={scan.openLabelCameraSettings} style={{ marginTop: spacing.sm }}>
                      Open phone Settings
                    </Button>
                  )}
                </Card>
              )}

              <Button variant="secondary" onPress={scan.startManualEntry} disabled={scan.readingLabel}>Type the price in</Button>
            </>
          )}

          {scan.step === 'confirm' && !!scan.store && (
            <ConfirmCard
              title={scan.fromScan ? 'Check the label' : 'Add an item'}
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
              lookupStatus={scan.lookupStatus}
              lookupMessage={scan.lookupMessage}
              onLookUp={scan.lookUpBarcode}
              onScanBarcode={scan.scanBarcode}
              cameraMessage={scan.cameraMessage}
              onOpenSettings={scan.cameraBlocked ? scan.openCameraSettings : undefined}
              lookupTone={scan.lookupTone}
              suggestion={scan.suggestion}
              onUseSuggestion={scan.acceptSuggestion}
              onRejectSuggestion={scan.rejectSuggestion}
              readText={scan.readText}
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

      {/* Full-screen camera for the product barcode; opened from the confirm card */}
      <BarcodeScanner visible={scan.scannerOpen} onScanned={scan.onBarcodeScanned} onCancel={scan.closeScanner} />

      {/* Full-screen camera for the price label */}
      <LabelCamera visible={scan.labelCameraOpen} onPhoto={scan.onLabelPhoto} onCancel={scan.closeLabelCamera} />
    </SafeAreaView>
  );
}
