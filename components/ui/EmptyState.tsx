
import { useTheme } from '@/hooks/useTheme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, subtitle, action }: EmptyStateProps) {
  const { colors, typography, spacing } = useTheme();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xxl,
    },
    iconWrap: { marginBottom: spacing.xl },
    title: {
      fontFamily: 'Inter',
      fontSize: typography.heading2,
      fontWeight: typography.semibold,
      textAlign: 'center',
      marginBottom: spacing.xl,
    },
    subtitle: {
      fontFamily: 'Inter',
      fontSize: typography.body,
      fontWeight: typography.regular,
      textAlign: 'center',
      marginBottom: spacing.xl,
    },
    actionWrap: { marginTop: spacing.xl, alignSelf: 'stretch' },
  });

  return (
    <View style={styles.container}>
      {icon && <View style={styles.iconWrap}>{icon}</View>}
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      {subtitle && (
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      )}
      {action && <View style={styles.actionWrap}>{action}</View>}
    </View>
  );
}
