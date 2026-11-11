// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tralaí Cliste Contributors
//
// Scanning a shelf price label: asks for the camera, opens the label camera
// (components/LabelCamera.tsx), shrinks the photo, reads it with ML Kit on the
// phone (no internet needed), and hands back a filled-in confirm card.
// What happens to what was read is in lib/labelScan.ts.
// hooks/useScanScreen.ts uses this.

import { recognizeText } from '@infinitered/react-native-mlkit-text-recognition';
import { useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { mlKitToOcr } from '../lib/labelParser/fromMlKit';
import { scanToForm, type LabelScan } from '../lib/labelScan';
import { cameraMessage, type CameraAccess } from '../lib/scanner';

// Wide enough for the small print on labels, small enough to read quickly
const READ_WIDTH = 1600;

const READ_FAILED = "Couldn't read the photo. Please try again, or type the price in.";

export function useLabelScanner(store: string | null, onScanned: (scan: LabelScan) => void) {
  const [, requestPermission] = useCameraPermissions();
  const [isOpen, setOpen] = useState(false);
  const [reading, setReading] = useState(false);
  const [access, setAccess] = useState<CameraAccess>('unknown');
  const [problem, setProblem] = useState<string | null>(null);

  const latest = useRef(onScanned);
  useEffect(() => {
    latest.current = onScanned;
  }, [onScanned]);

  const open = async () => {
    setProblem(null);
    try {
      const p = await requestPermission();
      if (p.granted) {
        setAccess('granted');
        setOpen(true);
      } else {
        setAccess(p.canAskAgain ? 'denied' : 'blocked');
      }
    } catch {
      setAccess('blocked');
    }
  };

  // Called by the camera screen with the photo it took
  const onPhoto = async (photo: { uri: string; width: number }) => {
    if (!store) return;
    setOpen(false);
    setReading(true);
    try {
      let uri = photo.uri;
      if (photo.width > READ_WIDTH) {
        const shrink = ImageManipulator.manipulate(photo.uri);
        shrink.resize({ width: READ_WIDTH });
        const image = await shrink.renderAsync();
        uri = (await image.saveAsync({ compress: 0.9, format: SaveFormat.JPEG })).uri;
      }
      const result = await recognizeText(uri);
      const scan = scanToForm(mlKitToOcr(result), store);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      latest.current(scan);
    } catch {
      setProblem(READ_FAILED);
    } finally {
      setReading(false);
    }
  };

  return {
    isOpen,
    reading,
    // A problem reading the photo, or with camera access
    message: problem ?? cameraMessage(access),
    cameraBlocked: access === 'blocked',
    open,
    close: () => setOpen(false),
    onPhoto,
    openSettings: () => {
      Linking.openSettings().catch(() => {});
    },
  };
}
