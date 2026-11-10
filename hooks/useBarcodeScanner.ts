// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tralaí Cliste Contributors
//
// The barcode scanner: asks for the camera the first time, opens and closes the
// camera screen (components/BarcodeScanner.tsx), and hands back the first good
// barcode it reads. A gentle buzz confirms the read.
// hooks/useScanScreen.ts uses this; what counts as a good barcode is in lib/barcode.ts.

import { useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { barcodeFromScan } from '../lib/barcode';
import { cameraMessage, type CameraAccess } from '../lib/scanner';

export function useBarcodeScanner(onBarcode: (barcode: string) => void) {
  const [, requestPermission] = useCameraPermissions();
  const [isOpen, setOpen] = useState(false);
  const [access, setAccess] = useState<CameraAccess>('unknown');

  // The camera reports the same barcode many times a second; only the first counts
  const done = useRef(false);
  const latest = useRef(onBarcode);
  useEffect(() => {
    latest.current = onBarcode;
  }, [onBarcode]);

  const open = async () => {
    try {
      // Asks only if needed; also notices if camera access was turned on in Settings
      const p = await requestPermission();
      if (p.granted) {
        done.current = false;
        setAccess('granted');
        setOpen(true);
      } else {
        setAccess(p.canAskAgain ? 'denied' : 'blocked');
      }
    } catch {
      setAccess('blocked');
    }
  };

  const onScanned = ({ data }: { data: string }) => {
    if (done.current) return;
    const barcode = barcodeFromScan(data);
    if (!barcode) return; // a misread or a QR code: keep scanning
    done.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setOpen(false);
    latest.current(barcode);
  };

  return {
    isOpen,
    cameraBlocked: access === 'blocked',
    message: cameraMessage(access),
    open,
    close: () => setOpen(false),
    onScanned,
    openSettings: () => {
      Linking.openSettings().catch(() => {});
    },
  };
}
