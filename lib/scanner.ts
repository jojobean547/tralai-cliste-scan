// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tralaí Cliste Contributors
//
// Camera access for the barcode scanner, and what the shopper is told.
// Plain functions, tested on the computer:
//   npx tsx scripts/checkFindBarcode.ts
// hooks/useBarcodeScanner.ts asks the phone; lib/barcode.ts reads the barcode.

// unknown = not asked yet; denied = said no, can ask again; blocked = turned off in Settings
export type CameraAccess = 'unknown' | 'granted' | 'denied' | 'blocked';

export function cameraMessage(access: CameraAccess): string | null {
  switch (access) {
    case 'denied':
      return 'The camera is needed to scan. Tap Scan barcode to allow it, or type the numbers instead.';
    case 'blocked':
      return "Camera access is turned off for this app. You can turn it on in your phone's Settings, or type the numbers instead.";
    default:
      return null;
  }
}
