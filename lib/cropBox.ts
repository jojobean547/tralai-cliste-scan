// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tralaí Cliste Contributors
//
// The crop box on the photo check screen: where it starts, how dragging moves it,
// and the exact part of the photo to read. All sizes are in photo pixels.
// Plain functions, tested on the computer:
//   npx tsx scripts/checkCropBox.ts
// components/LabelCamera.tsx draws the box and handles the dragging.

export type Size = { width: number; height: number };
export type Box = { x: number; y: number; width: number; height: number };
export type Corner = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

// The part of the photo to read (null: all of it), as handed from the camera to the reader
export type PhotoCrop = { originX: number; originY: number; width: number; height: number } | null;
export type LabelPhoto = { uri: string; width: number; height: number; crop: PhotoCrop };

// The box can't get smaller than this share of the photo's shorter side
export const MIN_BOX_SHARE = 0.12;

const minSide = (photo: Size) => Math.round(MIN_BOX_SHARE * Math.min(photo.width, photo.height));

// Keeps the box inside the photo and no smaller than the minimum
export function clampBox(b: Box, photo: Size): Box {
  const min = minSide(photo);
  const width = Math.min(Math.max(b.width, min), photo.width);
  const height = Math.min(Math.max(b.height, min), photo.height);
  const x = Math.min(Math.max(b.x, 0), photo.width - width);
  const y = Math.min(Math.max(b.y, 0), photo.height - height);
  return { x, y, width, height };
}

// A box about the shape of a shelf label in the middle, when the frame's place isn't known
export function defaultBox(photo: Size): Box {
  const width = photo.width * 0.8;
  const height = Math.min(width / 1.6, photo.height * 0.8);
  return clampBox({ x: (photo.width - width) / 2, y: (photo.height - height) / 2, width, height }, photo);
}

// Where the white frame on the camera screen falls on the photo. The camera picture
// fills the screen and is trimmed at the edges ("cover"), so the photo shows a little
// more than the screen did.
export function frameToPhoto(frame: Box, screen: Size, photo: Size): Box {
  if (screen.width <= 0 || screen.height <= 0 || photo.width <= 0 || photo.height <= 0) return defaultBox(photo);
  const scale = Math.max(screen.width / photo.width, screen.height / photo.height);
  const offsetX = (photo.width * scale - screen.width) / 2;
  const offsetY = (photo.height * scale - screen.height) / 2;
  return clampBox({
    x: (frame.x + offsetX) / scale,
    y: (frame.y + offsetY) / scale,
    width: frame.width / scale,
    height: frame.height / scale,
  }, photo);
}

// Dragging a corner; the opposite corner stays put
export function moveCorner(start: Box, corner: Corner, dx: number, dy: number, photo: Size): Box {
  const min = minSide(photo);
  let left = start.x;
  let top = start.y;
  let right = start.x + start.width;
  let bottom = start.y + start.height;
  if (corner === 'topLeft' || corner === 'bottomLeft') left = Math.min(Math.max(left + dx, 0), right - min);
  else right = Math.max(Math.min(right + dx, photo.width), left + min);
  if (corner === 'topLeft' || corner === 'topRight') top = Math.min(Math.max(top + dy, 0), bottom - min);
  else bottom = Math.max(Math.min(bottom + dy, photo.height), top + min);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

// Dragging the middle of the box moves all of it, without leaving the photo
export function moveBox(start: Box, dx: number, dy: number, photo: Size): Box {
  return clampBox({ ...start, x: start.x + dx, y: start.y + dy }, photo);
}

// How the photo fits on the check screen ("contain": all of it shows, centred)
export function fitPhoto(photo: Size, view: Size): { scale: number; offsetX: number; offsetY: number } {
  if (photo.width <= 0 || photo.height <= 0 || view.width <= 0 || view.height <= 0) return { scale: 1, offsetX: 0, offsetY: 0 };
  const scale = Math.min(view.width / photo.width, view.height / photo.height);
  return { scale, offsetX: (view.width - photo.width * scale) / 2, offsetY: (view.height - photo.height * scale) / 2 };
}

// The part of the photo to cut out, in whole pixels, never past the edges
export function toCrop(b: Box, photo: Size): { originX: number; originY: number; width: number; height: number } {
  const originX = Math.max(0, Math.floor(b.x));
  const originY = Math.max(0, Math.floor(b.y));
  const width = Math.min(Math.round(b.width), photo.width - originX);
  const height = Math.min(Math.round(b.height), photo.height - originY);
  return { originX, originY, width, height };
}

// True when the box covers (nearly) the whole photo, so there's nothing to cut
export function coversPhoto(b: Box, photo: Size): boolean {
  return b.width >= photo.width - 2 && b.height >= photo.height - 2;
}
