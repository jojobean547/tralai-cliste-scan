// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tralaí Cliste Contributors
//
// The camera screen for scanning a product barcode. UI only: opening, closing
// and what happens with the barcode are in hooks/useBarcodeScanner.ts.
// It scans by itself as soon as a barcode is in view; there's nothing to press.
// White on black, whatever the app theme, so it reads well over the camera picture.

import { TouchTargets } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { CameraView } from 'expo-camera';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  onScanned: (result: { data: string }) => void;
  onCancel: () => void;
};

const WHITE = '#FFFFFF';
const BLACK = '#000000';
const SHADE = 'rgba(0,0,0,0.55)';

export function BarcodeScanner({ visible, onScanned, onCancel }: Props) {
  const { typography, spacing, radii } = useTheme();
  const [light, setLight] = useState(false);

  const bigButton = (filled: boolean) => ({
    minHeight: TouchTargets.minHeight,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: WHITE,
    backgroundColor: filled ? WHITE : SHADE,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: spacing.lg,
  });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: BLACK }}>
          {visible && (
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={light}
              barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a'] }}
              onBarcodeScanned={onScanned}
            />
          )}

          <SafeAreaView style={{ flex: 1, justifyContent: 'space-between', padding: spacing.xl }} pointerEvents="box-none">
            <View style={{ backgroundColor: SHADE, borderRadius: radii.md, padding: spacing.md }}>
              <Text style={{ color: WHITE, fontSize: typography.heading3, fontWeight: typography.semibold, textAlign: 'center' }}>
                Point the camera at the barcode
              </Text>
              <Text style={{ color: WHITE, fontSize: typography.bodySmall, textAlign: 'center', marginTop: spacing.xs }}>
                It scans by itself once the barcode is inside the frame
              </Text>
            </View>

            {/* The frame to aim at, about the shape of a barcode */}
            <View
              accessible={false}
              style={{ alignSelf: 'center', width: '85%', aspectRatio: 2, borderWidth: 3, borderColor: WHITE, borderRadius: radii.md }}
            />

            <View style={{ gap: spacing.md }}>
              <Pressable
                onPress={() => setLight((v) => !v)}
                accessibilityRole="switch"
                accessibilityState={{ checked: light }}
                accessibilityLabel="Phone light"
                style={bigButton(false)}
              >
                <Text style={{ color: WHITE, fontSize: typography.body, fontWeight: typography.semibold }}>
                  {light ? 'Turn light off' : 'Turn light on'}
                </Text>
              </Pressable>
              <Pressable onPress={onCancel} accessibilityRole="button" accessibilityLabel="Cancel scanning" style={bigButton(true)}>
                <Text style={{ color: BLACK, fontSize: typography.body, fontWeight: typography.bold }}>Cancel</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      </SafeAreaProvider>
    </Modal>
  );
}
