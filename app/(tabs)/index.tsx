import { useTheme } from '@/hooks/useTheme';
import { Text, View } from 'react-native';

export default function ScanScreen() {
  const { colors, typography } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <Text style={{ fontSize: typography.heading1, fontWeight: typography.bold, color: colors.textPrimary }}>
        Scan
      </Text>
    </View>
  );
}