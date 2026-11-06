import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StoreBadge } from '@/components/ui/StoreBadge';
import { useTheme } from '@/hooks/useTheme';
import { Text, View } from 'react-native';

export default function ScanScreen() {
  const { colors, typography, spacing } = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg, backgroundColor: colors.background }}>
      <StoreBadge store="Tesco" />
      <Card>
        <Text style={{ fontSize: typography.body, color: colors.textPrimary }}>This is a Card</Text>
      </Card>
      <Button variant="tint" onPress={() => {}}>Scan price label</Button>
      <Button variant="secondary" onPress={() => {}}>Type the price in instead</Button>
      <Button variant="primary" onPress={() => {}}>Add to basket</Button>
    </View>
  );
}