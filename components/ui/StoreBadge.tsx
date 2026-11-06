
import { useTheme } from '@/hooks/useTheme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Size = 'sm' | 'md';

interface StoreBadgeProps {
  store: string;
  size?: Size;
  style?: import('react-native').ViewStyle;
}

type BadgeColour = { bg: string; text: string };

const LIGHT_COLOURS: Record<string, BadgeColour> = {
  'Lidl':          { bg: '#FFF3CD', text: '#7A5C00' },
  'Aldi':          { bg: '#D0E8FF', text: '#003A7A' },
  'Tesco':         { bg: '#CCE0FF', text: '#003DA5' },
  'SuperValu':     { bg: '#FFE4CC', text: '#A63200' },
  'Dunnes Stores': { bg: '#FFD6D6', text: '#A50000' },
  'Centra':        { bg: '#E8F4E8', text: '#006B3C' },
  'Spar':          { bg: '#E8F4E8', text: '#00833E' },
};

const DARK_COLOURS: Record<string, BadgeColour> = {
  'Lidl':          { bg: '#3D3200', text: '#FFD966' },
  'Aldi':          { bg: '#002D5C', text: '#66B3FF' },
  'Tesco':         { bg: '#002966', text: '#80AAFF' },
  'SuperValu':     { bg: '#4D1A00', text: '#FF9966' },
  'Dunnes Stores': { bg: '#4D0000', text: '#FF8080' },
  'Centra':        { bg: '#003D20', text: '#7FD4A0' },
  'Spar':          { bg: '#003D20', text: '#7FD4A0' },
};

export function StoreBadge({ store, size = 'md', style }: StoreBadgeProps) {
  const { colors, typography, spacing, radii, isDark } = useTheme();
  const palette = isDark ? DARK_COLOURS : LIGHT_COLOURS;
  const { bg, text } = palette[store] ?? { bg: colors.greenLight, text: colors.primaryGreen };

  const styles = StyleSheet.create({
    pill: {
      alignSelf: 'flex-start',
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    label: {
      fontFamily: 'Inter',
      fontWeight: typography.semibold,
    },
  });

  return (
    <View style={[styles.pill, { backgroundColor: bg }, style]}>
      <Text style={[
        styles.label,
        { fontSize: size === 'sm' ? typography.tiny : typography.body, color: text },
      ]}>
        {store}
      </Text>
    </View>
  );
}
