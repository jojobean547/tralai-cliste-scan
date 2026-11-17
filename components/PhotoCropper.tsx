// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tralaí Cliste Contributors
//
// The check step after photographing a label: the photo with a box around the price
// label. Drag a corner to resize the box, or the middle to move it; only what's inside
// is read. "Retake" goes back to the camera, for example when the label shines.
// UI only: the box rules are in lib/cropBox.ts. White on black, like the camera.

import { TouchTargets } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { fitPhoto, moveBox, moveCorner, type Box, type Corner, type Size } from '@/lib/cropBox';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, PanResponder, Pressable, Text, View, type PanResponderInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = {
  photo: { uri: string; width: number; height: number };
  initialBox: Box;
  onUse: (box: Box) => void;
  onRetake: () => void;
};

const WHITE = '#FFFFFF';
const BLACK = '#000000';
const DIM = 'rgba(0,0,0,0.6)';
const HANDLE_TOUCH = 56;   // the area you can grab
const HANDLE_DOT = 22;     // what you see

const CORNERS: Corner[] = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];

export function PhotoCropper({ photo, initialBox, onUse, onRetake }: Props) {
  const { typography, spacing, radii } = useTheme();
  const [view, setView] = useState<Size>({ width: 0, height: 0 });
  const [box, setBox] = useState<Box>(initialBox);

  const size: Size = { width: photo.width, height: photo.height };
  const fit = fitPhoto(size, view);

  // The drag handlers are made once, so they read the latest box and scale from here
  const latest = useRef({ box, scale: fit.scale, size });
  useEffect(() => {
    latest.current = { box, scale: fit.scale, size: { width: photo.width, height: photo.height } };
  }, [box, fit.scale, photo.width, photo.height]);

  const responders = useMemo(() => {
    const start = { box: initialBox };
    const make = (drag: Corner | 'move'): PanResponderInstance =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          start.box = latest.current.box;
        },
        onPanResponderMove: (_e, g) => {
          const { scale, size: s } = latest.current;
          if (scale <= 0) return;
          const dx = g.dx / scale;
          const dy = g.dy / scale;
          setBox(drag === 'move' ? moveBox(start.box, dx, dy, s) : moveCorner(start.box, drag, dx, dy, s));
        },
      });
    return {
      move: make('move'),
      topLeft: make('topLeft'),
      topRight: make('topRight'),
      bottomLeft: make('bottomLeft'),
      bottomRight: make('bottomRight'),
    };
    // Made once: the handlers read everything they need from `latest`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The box on screen
  const left = fit.offsetX + box.x * fit.scale;
  const top = fit.offsetY + box.y * fit.scale;
  const width = box.width * fit.scale;
  const height = box.height * fit.scale;
  const photoW = photo.width * fit.scale;
  const photoH = photo.height * fit.scale;

  const cornerPos = (c: Corner) => ({
    left: (c === 'topLeft' || c === 'bottomLeft' ? left : left + width) - HANDLE_TOUCH / 2,
    top: (c === 'topLeft' || c === 'topRight' ? top : top + height) - HANDLE_TOUCH / 2,
  });

  const bigButton = (filled: boolean) => ({
    flex: 1,
    minHeight: TouchTargets.minHeight,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: WHITE,
    backgroundColor: filled ? WHITE : 'transparent',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BLACK }}>
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
        <Text style={{ color: WHITE, fontSize: typography.heading3, fontWeight: typography.semibold, textAlign: 'center' }}>
          Is the price label inside the box?
        </Text>
        <Text style={{ color: WHITE, fontSize: typography.bodySmall, textAlign: 'center', marginTop: spacing.xs }}>
          Drag the corners to fit it. If the price shines, retake and tilt the phone a little.
        </Text>
      </View>

      {/* Room around the photo, so a corner at the edge can still be grabbed */}
      <View style={{ flex: 1, marginHorizontal: HANDLE_TOUCH / 2, marginVertical: HANDLE_TOUCH / 2 }} onLayout={(e) => setView({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
        {view.width > 0 && (
          <>
            <Image
              source={{ uri: photo.uri }}
              accessible={false}
              style={{ position: 'absolute', left: fit.offsetX, top: fit.offsetY, width: photoW, height: photoH }}
            />

            {/* Darken everything outside the box */}
            <View pointerEvents="none" style={{ position: 'absolute', left: fit.offsetX, top: fit.offsetY, width: photoW, height: top - fit.offsetY, backgroundColor: DIM }} />
            <View pointerEvents="none" style={{ position: 'absolute', left: fit.offsetX, top: top + height, width: photoW, height: fit.offsetY + photoH - top - height, backgroundColor: DIM }} />
            <View pointerEvents="none" style={{ position: 'absolute', left: fit.offsetX, top, width: left - fit.offsetX, height, backgroundColor: DIM }} />
            <View pointerEvents="none" style={{ position: 'absolute', left: left + width, top, width: fit.offsetX + photoW - left - width, height, backgroundColor: DIM }} />

            {/* The box: drag the middle to move it */}
            <View
              {...responders.move.panHandlers}
              accessible={false}
              style={{ position: 'absolute', left, top, width, height, borderWidth: 3, borderColor: WHITE }}
            />

            {/* The corners: drag to resize */}
            {CORNERS.map((c) => (
              <View
                key={c}
                {...responders[c].panHandlers}
                accessible={false}
                style={{ position: 'absolute', ...cornerPos(c), width: HANDLE_TOUCH, height: HANDLE_TOUCH, alignItems: 'center', justifyContent: 'center' }}
              >
                <View style={{ width: HANDLE_DOT, height: HANDLE_DOT, borderRadius: HANDLE_DOT / 2, backgroundColor: WHITE, borderWidth: 3, borderColor: BLACK }} />
              </View>
            ))}
          </>
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.md, padding: spacing.xl, paddingTop: spacing.sm }}>
        <Pressable onPress={onRetake} accessibilityRole="button" accessibilityLabel="Retake photo" style={bigButton(false)}>
          <Text style={{ color: WHITE, fontSize: typography.body, fontWeight: typography.semibold }}>Retake</Text>
        </Pressable>
        <Pressable onPress={() => onUse(box)} accessibilityRole="button" accessibilityLabel="Use this photo" style={bigButton(true)}>
          <Text style={{ color: BLACK, fontSize: typography.body, fontWeight: typography.bold }}>Use photo</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
