// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tralaí Cliste Contributors
//
// Scanning a shelf price label: asks for the camera, opens the label camera
// (components/LabelCamera.tsx), cuts the photo to the box the shopper checked,
// shrinks it, reads it with ML Kit on the phone (no internet needed), and hands
// back a filled-in confirm card.
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
import type { LabelPhoto } from '../lib/cropBox';

// Wide enough for the small print on labels, small enough to read quickly
const READ_WIDTH = 1600;

const READ_FAILED = "Couldn't read the photo. Please try again, or type the price in.";

// photoUri: the photo as it was read (shrunk), for saving with the scan
export function useLabelScanner(store: string | null, onScanned: (scan: LabelScan, photoUri: string) => void) {
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
  const onPhoto = async (photo: LabelPhoto) => {
    if (!store) return;
    setOpen(false);
    setReading(true);
    try {
      // Only the part inside the box, no wider than READ_WIDTH
      let uri = photo.uri;
      let frame = { width: photo.width, height: photo.height };
      const width = photo.crop ? photo.crop.width : photo.width;
      if (photo.crop || width > READ_WIDTH) {
        const edit = ImageManipulator.manipulate(photo.uri);
        if (photo.crop) edit.crop(photo.crop);
        if (width > READ_WIDTH) edit.resize({ width: READ_WIDTH });
        const image = await edit.renderAsync();
        const saved = await image.saveAsync({ compress: 0.9, format: SaveFormat.JPEG });
        uri = saved.uri;
        frame = { width: saved.width, height: saved.height };
      }
      const result = await recognizeText(uri);
      const scan = scanToForm(mlKitToOcr(result), store, frame);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      latest.current(scan, uri);
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
