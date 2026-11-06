import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useTheme } from '@/hooks/useTheme';
import { Text, View } from 'react-native';

export default function ScanScreen() {
  const { colors, typography, spacing } = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg, backgroundColor: colors.background }}>
      <Card>
        <Text style={{ fontSize: typography.body, color: colors.textPrimary }}>This is a Card</Text>
      </Card>
      <Button variant="tint" onPress={() => {}}>Scan price label</Button>
      <Button variant="secondary" onPress={() => {}}>Type the price in instead</Button>
      <Button variant="primary" onPress={() => {}}>Add to basket</Button>
    </View>
  );
}