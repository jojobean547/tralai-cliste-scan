
import { useTheme } from '@/hooks/useTheme';
import React from 'react';
import { StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';

type Variant = 'default' | 'highlight' | 'danger' | 'gold';

interface CardProps {
  variant?: Variant;
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}

export function Card({ variant = 'default', children, onPress, style }: CardProps) {
  const { colors, spacing, radii } = useTheme();

  const variantStyles: Record<Variant, { bg: string; border: string; borderWidth: number }> = {
    default:   { bg: colors.surface,   border: colors.border,       borderWidth: 1 },
    highlight: { bg: colors.surface,   border: colors.primaryGreen, borderWidth: 3.5 },
    danger:    { bg: colors.errorBg,   border: colors.errorBorder,  borderWidth: 1 },
    gold:      { bg: colors.accentGoldTint,       border: colors.accentGold,   borderWidth: 1.5 },
  };

  const { bg, border, borderWidth } = variantStyles[variant];

  const styles = StyleSheet.create({
    base: {
      borderRadius: radii.lg,
      padding: spacing.lg,
    },
  });

  const containerStyle = [
    styles.base,
    { backgroundColor: bg, borderColor: border, borderWidth },
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={containerStyle}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={containerStyle}>{children}</View>;
}
