import { BasketProvider } from '@/hooks/useBasket';
import { ClubCardsProvider } from '@/hooks/useClubCards';
import { HistoryProvider } from '@/hooks/useHistory';
import { ThemeProvider } from '@/hooks/useTheme';
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ClubCardsProvider>
        <BasketProvider>
          <HistoryProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </HistoryProvider>
        </BasketProvider>
      </ClubCardsProvider>
    </ThemeProvider>
  );
}