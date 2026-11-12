// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tralaí Cliste Contributors
//
// Saved scans on the phone: one <id>.json and one <id>.jpg per scan, in the app's
// own "scans" folder (nobody else can see it). Export copies them all, plus one
// combined scans.json, into a folder the shopper picks, such as Downloads.
// What a record holds and how it's scored is in lib/scanLog.ts.

import { Directory, File, Paths } from 'expo-file-system';
import { useCallback, useState } from 'react';
import { readRecord, summarise, type ScanRecord, type Summary } from '../lib/scanLog';

const scansFolder = () => new Directory(Paths.document, 'scans');

function loadAll(): ScanRecord[] {
  const dir = scansFolder();
  if (!dir.exists) return [];
  const records: ScanRecord[] = [];
  for (const item of dir.list()) {
    if (!(item instanceof File) || !item.name.endsWith('.json')) continue;
    try {
      const r = readRecord(item.textSync());
      if (r) records.push(r);
    } catch {
      // a damaged file is skipped
    }
  }
  return records.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

// Saving happens when an item is added, so it must never get in the way:
// any problem is ignored and the basket carries on as normal.
export function saveScan(record: ScanRecord, photoUri: string | null) {
  try {
    const dir = scansFolder();
    dir.create({ intermediates: true, idempotent: true });
    let photo: string | null = null;
    if (photoUri) {
      try {
        new File(photoUri).copy(new File(dir, `${record.id}.jpg`));
        photo = `${record.id}.jpg`;
      } catch {
        photo = null;
      }
    }
    const file = new File(dir, `${record.id}.json`);
    file.create({ overwrite: true });
    file.write(JSON.stringify({ ...record, photo }));
  } catch {
    // nothing to do: the scan just isn't saved
  }
}

export type ExportResult = { ok: true; folder: string; count: number } | { ok: false; message: string };

export function useScanLog() {
  const [records, setRecords] = useState<ScanRecord[]>([]);
  const [sizeMb, setSizeMb] = useState(0);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    try {
      setRecords(loadAll());
      const dir = scansFolder();
      setSizeMb(dir.exists ? Math.round(((dir.size ?? 0) / 1e6) * 10) / 10 : 0);
    } catch {
      setRecords([]);
      setSizeMb(0);
    }
  }, []);

  // Copies everything into a new folder inside the one the shopper picks
  const exportAll = useCallback(async (): Promise<ExportResult> => {
    const all = loadAll();
    if (all.length === 0) return { ok: false, message: 'There are no saved scans to export yet.' };
    setBusy(true);
    try {
      let picked: Awaited<ReturnType<typeof Directory.pickDirectoryAsync>>;
      try {
        picked = await Directory.pickDirectoryAsync();
      } catch {
        return { ok: false, message: 'No folder was chosen, so nothing was exported.' };
      }
      const name = `tralai-scans-${new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-')}`;
      const target = picked.createDirectory(name);

      target.createFile('scans.json', 'application/json').write(JSON.stringify(all, null, 1));
      const source = scansFolder();
      for (const r of all) {
        if (!r.photo) continue;
        try {
          const bytes = await new File(source, r.photo).bytes();
          target.createFile(r.photo, 'image/jpeg').write(bytes);
        } catch {
          // a missing photo doesn't stop the rest
        }
      }
      return { ok: true, folder: name, count: all.length };
    } catch {
      return { ok: false, message: "Couldn't write to that folder. Please try again and pick another folder, such as Downloads." };
    } finally {
      setBusy(false);
    }
  }, []);

  const deleteAll = useCallback(() => {
    try {
      const dir = scansFolder();
      if (dir.exists) dir.delete();
    } catch {
      // ignore: refresh shows what is left
    }
    refresh();
  }, [refresh]);

  const summary: Summary = summarise(records);
  return { count: records.length, sizeMb, summary, busy, refresh, exportAll, deleteAll };
}
