// One line on the Basket screen. UI only: the text comes ready-made from
// lib/basketDisplay.ts, and the buttons call back to the screen.

import { Card } from '@/components/ui/Card';
import { StoreBadge } from '@/components/ui/StoreBadge';
import { TouchTargets } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import type { LineDisplay, LineIcon } from '@/lib/basketDisplay';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image, Pressable, Text, View } from 'react-native';

const ICON_SIZE = 56;

// The − and + buttons look compact (40 high) so the card stays short, but an
// invisible margin (hitSlop) keeps the area you can tap at the full 56 high
// for older shoppers.
const STEP_HEIGHT = 40;
const STEP_WIDTH = 48;

// The product photo if there is one, otherwise the category icon in a soft green circle
function LineIconView({ icon }: { icon: LineIcon }) {
  const { colors, radii } = useTheme();
  if (icon.kind === 'image') {
    return (
      <Image
        source={{ uri: icon.uri }}
        accessibilityIgnoresInvertColors
        style={{ width: ICON_SIZE, height: ICON_SIZE, borderRadius: radii.md, backgroundColor: colors.surfaceAlt }}
        resizeMode="contain"
      />
    );
  }
  return (
    <View
      style={{ width: ICON_SIZE, height: ICON_SIZE, borderRadius: ICON_SIZE / 2, backgroundColor: colors.greenTintBg, alignItems: 'center', justifyContent: 'center' }}
      accessible={false}
    >
      <MaterialCommunityIcons
        name={icon.name as keyof typeof MaterialCommunityIcons.glyphMap}
        size={30}
        color={colors.primaryGreen}
      />
    </View>
  );
}

type Props = {
  line: LineDisplay;
  quantity: number;
  store: string;
  onDecrease: () => void;
  onIncrease: () => void;
};

export function BasketLine({ line, quantity, store, onDecrease, onIncrease }: Props) {
  const { colors, typography, spacing, radii } = useTheme();

  const slop = Math.max(0, Math.ceil((TouchTargets.minHeight - STEP_HEIGHT) / 2));
  const hitSlop = { top: slop, bottom: slop, left: 4, right: 4 };
  const stepButton = {
    width: STEP_WIDTH,
    height: STEP_HEIGHT,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  const stepLabel = { fontSize: typography.heading3, fontWeight: typography.semibold, color: colors.textPrimary };
  const small = { fontSize: typography.bodySmall, color: colors.textSecondary, marginTop: spacing.xs };

  return (
    <Card>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <LineIconView icon={line.icon} />
        <View style={{ flex: 1 }}>
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
        </View>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Pressable
            onPress={onDecrease}
            accessibilityRole="button"
            accessibilityLabel={quantity === 1 ? `Remove ${line.title}` : `One fewer ${line.title}`}
            hitSlop={hitSlop}
            style={stepButton}
          >
            <Text style={stepLabel}>−</Text>
          </Pressable>
          <Text
            accessibilityLabel={`Quantity ${quantity}`}
            style={{ minWidth: 28, textAlign: 'center', fontSize: typography.heading3, fontWeight: typography.bold, color: colors.textPrimary }}
          >
            {quantity}
          </Text>
          <Pressable
            onPress={onIncrease}
            accessibilityRole="button"
            accessibilityLabel={`One more ${line.title}`}
            hitSlop={hitSlop}
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
