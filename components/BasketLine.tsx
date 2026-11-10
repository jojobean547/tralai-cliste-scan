// One line on the Basket screen. UI only: the text comes ready-made from
// lib/basketDisplay.ts, and the buttons call back to the screen.

import { Card } from '@/components/ui/Card';
import { StoreBadge } from '@/components/ui/StoreBadge';
import { TouchTargets } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import type { LineDisplay } from '@/lib/basketDisplay';
import { Pressable, Text, View } from 'react-native';

type Props = {
  line: LineDisplay;
  quantity: number;
  store: string;
  onDecrease: () => void;
  onIncrease: () => void;
};

export function BasketLine({ line, quantity, store, onDecrease, onIncrease }: Props) {
  const { colors, typography, spacing, radii } = useTheme();

  // Big square buttons, at least 56 points, for older shoppers
  const stepButton = {
    width: TouchTargets.minWidth,
    height: TouchTargets.minHeight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  const stepLabel = { fontSize: typography.heading2, fontWeight: typography.semibold, color: colors.textPrimary };
  const small = { fontSize: typography.bodySmall, color: colors.textSecondary, marginTop: spacing.xs };

  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm }}>
        <Text style={{ flex: 1, fontSize: typography.body, fontWeight: typography.semibold, color: colors.textPrimary }}>
          {line.title}
        </Text>
        <StoreBadge store={store} size="sm" />
      </View>

      <Text style={small}>{line.eachText}</Text>
      {!!line.clubText && <Text style={small}>{line.clubText}</Text>}
      {!!line.dealText && (
        <Text style={{ ...small, color: colors.primaryGreen, fontWeight: typography.semibold }}>{line.dealText}</Text>
      )}
      {!!line.dealNote && <Text style={{ ...small, fontStyle: 'italic' }}>{line.dealNote}</Text>}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Pressable
            onPress={onDecrease}
            accessibilityRole="button"
            accessibilityLabel={quantity === 1 ? `Remove ${line.title}` : `One fewer ${line.title}`}
            style={stepButton}
          >
            <Text style={stepLabel}>−</Text>
          </Pressable>
          <Text
            accessibilityLabel={`Quantity ${quantity}`}
            style={{ minWidth: 32, textAlign: 'center', fontSize: typography.heading2, fontWeight: typography.bold, color: colors.textPrimary }}
          >
            {quantity}
          </Text>
          <Pressable
            onPress={onIncrease}
            accessibilityRole="button"
            accessibilityLabel={`One more ${line.title}`}
            style={stepButton}
          >
            <Text style={stepLabel}>+</Text>
          </Pressable>
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: typography.heading3, fontWeight: typography.bold, color: colors.textPrimary }}>
            {line.totalText}
          </Text>
          {!!line.savingText && (
            <Text style={{ fontSize: typography.bodySmall, color: colors.success, fontWeight: typography.semibold }}>
              {line.savingText}
            </Text>
          )}
        </View>
      </View>
    </Card>
  );
}
