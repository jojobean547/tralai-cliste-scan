
import { useTheme } from '@/hooks/useTheme';
import React from 'react';
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';

type Variant = 'primary' | 'secondary' | 'danger' | 'purple' | 'ghost' | 'tint';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  variant: Variant;
  size?: Size;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

const HEIGHT: Record<Size, number> = {
  sm: 40,
  md: 48,
  lg: 56,
};

export function Button({
  variant,
  size = 'lg',
  onPress,
  disabled = false,
  loading = false,
  children,
  fullWidth = true,
  style,
}: ButtonProps) {
  const { colors, typography, spacing, radii } = useTheme();

  const FONT_SIZE: Record<Size, number> = {
    sm: typography.bodySmall,
    md: typography.body,
    lg: typography.body,
  };

  const variantStyles: Record<Variant, { bg: string; text: string; border?: string; borderWidth?: number }> = {
    primary:   { bg: colors.buttonPrimary,  text: colors.buttonPrimaryText },
    secondary: { bg: colors.surface,        text: colors.textPrimary,   border: colors.border },
    danger:    { bg: colors.errorBg,        text: colors.error,         border: colors.errorBorder },
    purple:    { bg: colors.accentPurple,   text: colors.textInverse },
    ghost:     { bg: 'transparent',         text: colors.textSecondary },
    tint:      { bg: colors.greenTintBg,    text: colors.greenTintText, border: colors.greenTintText, borderWidth: 7 },
  };

  const { bg, text, border, borderWidth } = variantStyles[variant];

  const styles = StyleSheet.create({
    base: {
      borderRadius: radii.md,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
    },
    label: {
      fontFamily: 'Inter',
      fontWeight: typography.semibold,
      textAlign: 'center',
    },
  });

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      style={[
        styles.base,
        {
          height: HEIGHT[size],
          backgroundColor: bg,
          borderColor: border ?? 'transparent',
          borderWidth: border ? 1 : 0,
          opacity: disabled ? 0.5 : 1,
          alignSelf: fullWidth ? 'stretch' : 'auto',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={text} size="small" />
      ) : typeof children === 'string' ? (
        <Text style={[styles.label, { color: text, fontSize: FONT_SIZE[size] }]}>
          {children}
        </Text>
      ) : (
        children
      )}
    </TouchableOpacity>
  );
}
