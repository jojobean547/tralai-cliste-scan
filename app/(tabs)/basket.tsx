import { EmptyState } from '@/components/ui/EmptyState';
import { useTheme } from '@/hooks/useTheme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';

export default function BasketScreen() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <EmptyState
        icon={<Ionicons name="basket-outline" size={96} color={colors.primaryGreen} />}
        title="Your basket is empty"
        subtitle={'Scan a price label and tap "Add to basket" to start your total'}
      />
    </View>
  );
}