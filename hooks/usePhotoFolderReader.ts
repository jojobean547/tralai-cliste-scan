// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tralaí Cliste Contributors
//
// For testing only: reads label photos with ML Kit, the same way a scan does
// (shrunk to READ_WIDTH, read on the phone), and saves what was read into the
// picked folder as mlkit_ocr.json. This lets the capstone label photos be scored
// as the phone sees them, on the computer.
//
// Which photos: the ones in the picked folder, and in the folders inside it (one
// store per folder). Where a folder has a "cropped" folder, only the cropped photos
// are read, as the capstone did. So picking price_labels reads
// price_labels/Aldi/cropped/*.jpg, price_labels/Centra/cropped/*.jpg, and so on.
//
// What is saved is ML Kit's own result (blocks, lines, words and their boxes), not
// the parser's, so later versions of lib/labelParser/fromMlKit.ts can be tried on it
// without reading the photos again.
//
// The file is saved every few photos. If the reading stops (the screen turned off,
// the app closed), picking the same folder again carries on from where it stopped.

import { recognizeText } from '@infinitered/react-native-mlkit-text-recognition';
import Constants from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useCallback, useState } from 'react';
import type { MlRect, MlText } from '../lib/labelParser/fromMlKit';
import { READ_WIDTH } from './useLabelScanner';

const OUTPUT = 'mlkit_ocr.json';
const SAVE_EVERY = 10;
const PHOTO = /\.(jpe?g|png)$/i;

type PhotoReading = { frame: { width: number; height: number }; mlkit: MlText } | { error: string };
type Output = { app_version: string; read_width: number; photos: Record<string, PhotoReading & { path?: string }> };
type Found = { photo: File; path: string };

const CROPPED = 'cropped';
const isPhoto = (i: Directory | File): i is File => i instanceof File && PHOTO.test(i.name);

// The photos to read in one folder: its cropped ones if it has a "cropped" folder,
// otherwise its own. Then the same for each folder inside it (two levels at most).
function findPhotos(folder: Directory, path: string, depth: number): Found[] {
  const items = folder.list();
  const cropped = items.find((i): i is Directory => i instanceof Directory && i.name.toLowerCase() === CROPPED);
  const found: Found[] = cropped
    ? cropped.list().filter(isPhoto).map((photo) => ({ photo, path: `${path}${cropped.name}/${photo.name}` }))
    : items.filter(isPhoto).map((photo) => ({ photo, path: `${path}${photo.name}` }));
  if (depth > 0) {
    for (const sub of items) {
      if (sub instanceof Directory && sub !== cropped) found.push(...findPhotos(sub, `${path}${sub.name}/`, depth - 1));
    }
  }
  return found;
}

export type FolderProgress = { done: number; total: number } | null;
export type FolderResult =
  | { ok: true; read: number; skipped: number; failed: number }
  | { ok: false; message: string };

// Only what fromMlKit.ts uses, so the file stays small
const rect = (r: MlRect): MlRect => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
function slim(result: MlText): MlText {
  return {
    text: result.text,
    blocks: (result.blocks ?? []).map((b) => ({
      lines: (b.lines ?? []).map((l) => ({
        text: l.text,
        frame: rect(l.frame),
        elements: (l.elements ?? []).map((w) => ({ text: w.text, frame: rect(w.frame) })),
      })),
    })),
  };
}

// One photo, read exactly like a scan without the crop step
async function readPhoto(photo: File): Promise<PhotoReading> {
  // A copy in the app's own cache, so the image tools can open it
  const copy = new File(Paths.cache, `folder-read${photo.name.slice(photo.name.lastIndexOf('.'))}`);
  copy.create({ overwrite: true });
  copy.write(await photo.bytes());

  const first = await ImageManipulator.manipulate(copy.uri).renderAsync();
  let image = first;
  if (first.width > READ_WIDTH) {
    image = await ImageManipulator.manipulate(copy.uri).resize({ width: READ_WIDTH }).renderAsync();
  }
  const saved = await image.saveAsync({ compress: 0.9, format: SaveFormat.JPEG });
  const result = await recognizeText(saved.uri);
  return { frame: { width: saved.width, height: saved.height }, mlkit: slim(result as MlText) };
}

export function usePhotoFolderReader() {
  const [progress, setProgress] = useState<FolderProgress>(null);

  const readFolder = useCallback(async (): Promise<FolderResult> => {
    let folder: Directory;
    try {
      folder = new Directory((await Directory.pickDirectoryAsync()).uri);
    } catch {
      return { ok: false, message: 'No folder was chosen, so nothing was read.' };
    }
    try {
      const items = folder.list();
      // Saved under the photo's own name ("Aldi_002.jpg"), as in the capstone files
      const photos = findPhotos(folder, '', 2).sort((a, b) => a.path.localeCompare(b.path));
      if (photos.length === 0) return { ok: false, message: 'There are no photos (.jpg or .png) in that folder.' };

      // Carry on from an earlier run in the same folder
      let outFile = items.find((i): i is File => i instanceof File && i.name === OUTPUT);
      let output: Output = { app_version: Constants.expoConfig?.version ?? '', read_width: READ_WIDTH, photos: {} };
      if (outFile) {
        try {
          const earlier = JSON.parse(await outFile.text()) as Output;
          if (earlier.read_width === READ_WIDTH && earlier.photos) output = { ...output, photos: earlier.photos };
        } catch {
          // an unreadable file is started again
        }
      }
      outFile ??= folder.createFile(OUTPUT, 'application/json');
      const save = () => outFile.write(JSON.stringify(output));

      const todo = photos.filter(({ photo }) => !(photo.name in output.photos) || 'error' in output.photos[photo.name]);
      const skipped = photos.length - todo.length;
      let failed = 0;
      setProgress({ done: skipped, total: photos.length });

      for (let i = 0; i < todo.length; i++) {
        const { photo, path } = todo[i];
        try {
          output.photos[photo.name] = { ...(await readPhoto(photo)), path };
        } catch (e) {
          failed++;
          output.photos[photo.name] = { error: e instanceof Error ? e.message : String(e), path };
        }
        setProgress({ done: skipped + i + 1, total: photos.length });
        if ((i + 1) % SAVE_EVERY === 0) save();
      }
      save();
      return { ok: true, read: todo.length - failed, skipped, failed };
    } catch {
      return { ok: false, message: "Couldn't read that folder or save into it. Please try again, or copy the photos into Downloads." };
    } finally {
      setProgress(null);
    }
  }, []);

  return { progress, busy: progress !== null, readFolder };
}
