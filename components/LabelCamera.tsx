// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tralaí Cliste Contributors
//
// The camera screen for photographing a shelf price label. UI only: what happens
// with the photo is in hooks/useLabelScanner.ts.
// White on black, whatever the app theme, so it reads well over the camera picture.

import { TouchTargets } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { CameraView } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  onPhoto: (photo: { uri: string; width: number }) => void;
  onCancel: () => void;
};

const WHITE = '#FFFFFF';
const BLACK = '#000000';
const SHADE = 'rgba(0,0,0,0.55)';
const SHUTTER = 84;

export function LabelCamera({ visible, onPhoto, onCancel }: Props) {
  const { typography, spacing, radii } = useTheme();
  const camera = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [taking, setTaking] = useState(false);
  const [light, setLight] = useState(false);

  // The camera starts fresh each time the screen opens
  useEffect(() => {
    if (!visible) {
      setReady(false);
      setLight(false);
    }
  }, [visible]);

  const takePhoto = async () => {
    if (!camera.current || !ready || taking) return;
    setTaking(true);
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.9, shutterSound: false });
      if (photo?.uri) onPhoto({ uri: photo.uri, width: photo.width });
    } catch {
      // Leave the camera open so the shopper can simply try again
    } finally {
      setTaking(false);
    }
  };

  const smallButton = {
    minHeight: TouchTargets.minHeight,
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: WHITE,
    backgroundColor: SHADE,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: BLACK }}>
          {visible && (
            <CameraView
              ref={camera}
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={light}
              onCameraReady={() => setReady(true)}
            />
          )}

          <SafeAreaView style={{ flex: 1, justifyContent: 'space-between', padding: spacing.xl }} pointerEvents="box-none">
            <View style={{ backgroundColor: SHADE, borderRadius: radii.md, padding: spacing.md }}>
              <Text style={{ color: WHITE, fontSize: typography.heading3, fontWeight: typography.semibold, textAlign: 'center' }}>
                Fill the frame with the price label
              </Text>
              <Text style={{ color: WHITE, fontSize: typography.bodySmall, textAlign: 'center', marginTop: spacing.xs }}>
                Hold the phone straight on, then tap the white button
              </Text>
            </View>

            {/* The frame to aim at, about the shape of a shelf label */}
            <View
              accessible={false}
              style={{ alignSelf: 'center', width: '92%', aspectRatio: 1.6, borderWidth: 3, borderColor: WHITE, borderRadius: radii.md }}
            />

            <View style={{ gap: spacing.lg, alignItems: 'center' }}>
              <Pressable
                onPress={takePhoto}
                disabled={!ready || taking}
                accessibilityRole="button"
                accessibilityLabel="Take photo of the label"
                accessibilityState={{ disabled: !ready || taking, busy: taking }}
                style={{
                  width: SHUTTER, height: SHUTTER, borderRadius: SHUTTER / 2,
                  backgroundColor: WHITE, borderWidth: 5, borderColor: SHADE,
                  alignItems: 'center', justifyContent: 'center', opacity: ready ? 1 : 0.5,
                }}
              >
                {taking && <ActivityIndicator color={BLACK} />}
              </Pressable>

              <View style={{ flexDirection: 'row', gap: spacing.md, alignSelf: 'stretch' }}>
                <Pressable
                  onPress={() => setLight((v) => !v)}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: light }}
                  accessibilityLabel="Phone light"
                  style={smallButton}
                >
                  <Text style={{ color: WHITE, fontSize: typography.body, fontWeight: typography.semibold }}>
                    {light ? 'Light off' : 'Light on'}
                  </Text>
                </Pressable>
                <Pressable onPress={onCancel} accessibilityRole="button" accessibilityLabel="Cancel" style={smallButton}>
                  <Text style={{ color: WHITE, fontSize: typography.body, fontWeight: typography.bold }}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </SafeAreaProvider>
    </Modal>
  );
}
