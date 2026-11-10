import { BasketLine } from '@/components/BasketLine';
import { AppAlert } from '@/components/ui/AppAlert';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAlert } from '@/hooks/useAlert';
import { useBasket } from '@/hooks/useBasket';
import { useClubCards } from '@/hooks/useClubCards';
import { useTheme } from '@/hooks/useTheme';
import { cardsWorthSwitchingOn, describeLine, euro } from '@/lib/basketDisplay';
import Ionicons from '@expo/vector-icons/Ionicons';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function BasketScreen() {
  const { colors, typography, spacing } = useTheme();
  const { items, loaded, updateQuantity, removeItem, clearBasket, total, itemCount, saving } = useBasket();
  const { hasClubCard } = useClubCards();
  const { showAlert, alertProps } = useAlert();

  // Removing needs a second tap, so a slip of the finger doesn't lose an item
  const confirmRemove = (id: string) =>
    showAlert({
      title: 'Remove this item?',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeItem(id) },
      ],
    });

  const confirmClear = () =>
    showAlert({
      title: 'Clear the whole basket?',
      message: 'This removes every item.',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear basket', style: 'destructive', onPress: clearBasket },
      ],
    });

  // For a moment at start-up while the saved basket is read
  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  const cardsToSwitchOn = cardsWorthSwitchingOn(items, hasClubCard);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      {items.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="basket-outline" size={96} color={colors.primaryGreen} />}
          title="Your basket is empty"
          subtitle={'Scan a price label and tap "Add to basket" to start your total'}
        />
      ) : (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}>
            <Text style={{ fontSize: typography.heading1, fontWeight: typography.bold, color: colors.textPrimary }}>Basket</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
              <Text style={{ fontSize: typography.body, color: colors.textSecondary }}>
                {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </Text>
              {/* Up here, away from the total, so it isn't tapped by mistake. Still asks before clearing. */}
              <Pressable
                onPress={confirmClear}
                accessibilityRole="button"
                accessibilityLabel="Clear basket"
                hitSlop={8}
                style={({ pressed }) => ({ minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.xs, opacity: pressed ? 0.6 : 1 })}
              >
                <Text style={{ fontSize: typography.body, fontWeight: typography.semibold, color: colors.error }}>Clear</Text>
              </Pressable>
            </View>
          </View>

          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}
            renderItem={({ item, index }) => (
              <BasketLine
                line={describeLine(item, index + 1, hasClubCard)}
                quantity={item.quantity}
                store={item.store_name}
                onDecrease={() =>
                  item.quantity === 1 ? confirmRemove(item.id) : updateQuantity(item.id, item.quantity - 1)
                }
                onIncrease={() => updateQuantity(item.id, item.quantity + 1)}
              />
            )}
          />

          <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, gap: spacing.sm, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text style={{ fontSize: typography.heading3, color: colors.textPrimary }}>Total</Text>
              <Text style={{ fontSize: typography.heading1, fontWeight: typography.bold, color: colors.textPrimary }}>
                {euro(total)}
              </Text>
            </View>
            {saving > 0 && (
              <Text style={{ fontSize: typography.body, color: colors.success, fontWeight: typography.semibold }}>
                You save {euro(saving)} with deals and club prices
              </Text>
            )}
            {cardsToSwitchOn.length > 0 && (
              <Text style={{ fontSize: typography.bodySmall, color: colors.textSecondary }}>
                Have {cardsToSwitchOn.join(' or ')}? Turn it on in Settings to use club prices.
              </Text>
            )}
          </View>
        </>
      )}
      <AppAlert {...alertProps} />
    </SafeAreaView>
  );
}
