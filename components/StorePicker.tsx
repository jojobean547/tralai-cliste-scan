// The coloured store pills. UI only.

import { StoreBadge } from '@/components/ui/StoreBadge';
import { STORES } from '@/constants/stores';
import { TouchTargets } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { Pressable, View } from 'react-native';

type Props = { onPick: (store: string) => void };

export function StorePicker({ onPick }: Props) {
  const { spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {STORES.map((store) => (
        <Pressable
          key={store}
          onPress={() => onPick(store)}
          accessibilityRole="button"
          accessibilityLabel={`I'm in ${store}`}
          style={({ pressed }) => ({ minHeight: TouchTargets.minHeight, justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
        >
          <StoreBadge store={store} />
        </Pressable>
      ))}
    </View>
  );
}
