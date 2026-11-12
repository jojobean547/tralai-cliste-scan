// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tralaí Cliste Contributors
//
// Builds on app.json. Gives each kind of build its own Android ID, so they can
// sit side by side on one phone:
//   development  ie.tralaicliste.scan.dev      "Tralaí Cliste (dev)"  loads code from the computer
//   preview      ie.tralaicliste.scan.preview  "Tralaí Cliste"        standalone, for testing in store
//   production   ie.tralaicliste.scan          "Tralaí Cliste"        the Play Store app, later
// The kind is set by APP_VARIANT in eas.json.

import type { ConfigContext, ExpoConfig } from 'expo/config';

const VARIANTS: Record<string, { idSuffix: string; nameSuffix: string }> = {
  development: { idSuffix: '.dev', nameSuffix: ' (dev)' },
  preview: { idSuffix: '.preview', nameSuffix: '' },
};

export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = VARIANTS[process.env.APP_VARIANT ?? ''] ?? { idSuffix: '', nameSuffix: '' };
  return {
    ...config,
    name: `${config.name}${variant.nameSuffix}`,
    slug: config.slug ?? 'tralai-cliste-scan',
    android: { ...config.android, package: `${config.android?.package}${variant.idSuffix}` },
  };
};
