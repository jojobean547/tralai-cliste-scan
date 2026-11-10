import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StoreBadge } from '@/components/ui/StoreBadge';
import { useBasket } from '@/hooks/useBasket';
import { useTheme } from '@/hooks/useTheme';
import { newLineId } from '@/lib/basket';
import { Text, View } from 'react-native';

export default function ScanScreen() {
  const { colors, typography, spacing } = useTheme();
  const { addItem, clearBasket, itemCount, total } = useBasket();
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg, backgroundColor: colors.background }}>
      <StoreBadge store="Tesco" />
      <Card>
        <Text style={{ fontSize: typography.body, color: colors.textPrimary }}>This is a Card</Text>
      </Card>
      <Button variant="tint" onPress={() => {}}>Scan price label</Button>
      <Button variant="secondary" onPress={() => {}}>Type the price in instead</Button>
      <Button variant="primary" onPress={() => {}}>Add to basket</Button>
      <Text style={{ fontSize: typography.body, color: colors.textPrimary }}>
        Basket: {itemCount} items, €{total.toFixed(2)}
      </Text>
      <Button
        variant="primary"
        onPress={() => addItem({
          id: newLineId(), product_name: 'Test beans', store_name: 'Tesco',
          price: 1.2, club_card_price: null, club_card_name: 'Tesco Clubcard',
          deal: null, quantity: 1, source: 'manual',
        })}>
        Add test item
      </Button>
      <Button variant="secondary" onPress={clearBasket}>Clear basket</Button>

    </View>
  );
}