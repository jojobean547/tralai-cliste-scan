// A grid of category icons. Tap one to pick it, tap it again to clear it. UI only.

import { CATEGORIES, type CategoryId } from '@/constants/categories';
import { useTheme } from '@/hooks/useTheme';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, Text, View } from 'react-native';

type Props = {
  value: CategoryId | null;
  onChange: (id: CategoryId | null) => void;
};

export function CategoryPicker({ value, onChange }: Props) {
  const { colors, typography, spacing, radii } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {CATEGORIES.map((c) => {
        const selected = c.id === value;
        return (
          <Pressable
            key={c.id}
            onPress={() => onChange(selected ? null : c.id)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={c.label}
            style={{
              width: '31%',
              minHeight: 76,
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.xs,
              padding: spacing.xs,
              borderRadius: radii.md,
              borderWidth: selected ? 2 : 1,
              borderColor: selected ? colors.primaryGreen : colors.border,
              backgroundColor: selected ? colors.greenTintBg : colors.surface,
            }}
          >
            <MaterialCommunityIcons
              name={c.icon as keyof typeof MaterialCommunityIcons.glyphMap}
              size={28}
              color={selected ? colors.primaryGreen : colors.textSecondary}
            />
            <Text
              numberOfLines={2}
              style={{ fontSize: typography.caption, textAlign: 'center', color: selected ? colors.primaryGreen : colors.textPrimary }}
            >
              {c.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
