// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tralaí Cliste Contributors
//
// Checks the crop box rules (lib/cropBox.ts). No phone needed.
//   npx tsx scripts/checkCropBox.ts

import { clampBox, coversPhoto, defaultBox, fitPhoto, frameToPhoto, moveBox, moveCorner, toCrop } from '../lib/cropBox';

let failures = 0;
function expect(what: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? '✔' : '✘'} ${what}${ok ? '' : `\n     got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
}
const round = (b: Record<string, number>) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, Math.round(v)]));

const photo = { width: 1600, height: 2133 };

// ─── Where the frame lands on the photo ───
// A 1080 × 2400 screen showing a 3:4 photo: the photo is trimmed at the sides
const screen = { width: 1080, height: 2400 };
const frame = { x: 43, y: 889, width: 994, height: 621 }; // centred on the screen
const onPhoto = frameToPhoto(frame, screen, photo);
expect('frame in the middle of the screen is in the middle of the photo', Math.round(onPhoto.x + onPhoto.width / 2), 800);
expect('…and halfway down', Math.abs(onPhoto.y + onPhoto.height / 2 - photo.height / 2) < 30, true);
expect('frame keeps its label shape', Math.round((onPhoto.width / onPhoto.height) * 10) / 10, 1.6);
expect('narrower than the photo, as the sides were trimmed', onPhoto.width < photo.width * 0.6, true);
expect('screen not measured yet: a sensible box in the middle', round(frameToPhoto(frame, { width: 0, height: 0 }, photo)), { x: 160, y: 667, width: 1280, height: 800 });

// ─── Dragging ───
const box = { x: 400, y: 800, width: 800, height: 500 };
expect('top-left corner moves, bottom-right stays', round(moveCorner(box, 'topLeft', -100, -50, photo)), { x: 300, y: 750, width: 900, height: 550 });
expect('bottom-right corner moves', round(moveCorner(box, 'bottomRight', 100, 200, photo)), { x: 400, y: 800, width: 900, height: 700 });
expect('a corner stops at the photo edge', round(moveCorner(box, 'topLeft', -900, -900, photo)), { x: 0, y: 0, width: 1200, height: 1300 });
expect('a corner stops before the box gets too small', round(moveCorner(box, 'bottomRight', -900, -900, photo)), { x: 400, y: 800, width: 192, height: 192 });
expect('moving the whole box', round(moveBox(box, 100, -100, photo)), { x: 500, y: 700, width: 800, height: 500 });
expect('the box stays inside the photo', round(moveBox(box, 2000, 2000, photo)), { x: 800, y: 1633, width: 800, height: 500 });
expect('too big a box is trimmed to the photo', round(clampBox({ x: -10, y: -10, width: 5000, height: 5000 }, photo)), { x: 0, y: 0, width: 1600, height: 2133 });

// ─── Showing the photo and cutting it ───
expect('photo fitted on a 400 × 600 area', round(fitPhoto(photo, { width: 400, height: 600 }) as unknown as Record<string, number>), { scale: 0, offsetX: 0, offsetY: 33 });
expect('fit scale', Math.round(fitPhoto(photo, { width: 400, height: 600 }).scale * 1000), 250);
expect('crop in whole pixels', toCrop({ x: 10.6, y: 20.2, width: 300.4, height: 200.7 }, photo), { originX: 10, originY: 20, width: 300, height: 201 });
expect('crop never past the edge', toCrop({ x: 1500, y: 2100, width: 300, height: 300 }, photo), { originX: 1500, originY: 2100, width: 100, height: 33 });
expect('whole photo: nothing to cut', [coversPhoto({ x: 0, y: 0, width: 1600, height: 2133 }, photo), coversPhoto(defaultBox(photo), photo)], [true, false]);

console.log(failures === 0 ? '\nAll checks passed' : `\n${failures} check(s) failed`);
if (failures > 0) process.exit(1);
