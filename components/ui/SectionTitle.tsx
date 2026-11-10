
import { useTheme } from '@/hooks/useTheme';
import React from 'react';
import { StyleSheet, Text, TextStyle } from 'react-native';

interface SectionTitleProps {
  children: React.ReactNode;
  style?: TextStyle;
}

export function SectionTitle({ children, style }: SectionTitleProps) {
  const { colors, typography, spacing } = useTheme();

  const styles = StyleSheet.create({
    title: {
      fontFamily: 'Inter',
      fontSize: typography.heading2,
      fontWeight: typography.semibold,
      marginBottom: spacing.md,
    },
  });

  return (
    <Text style={[styles.title, { color: colors.textPrimary }, style]}>
      {children}
    </Text>
  );
}
