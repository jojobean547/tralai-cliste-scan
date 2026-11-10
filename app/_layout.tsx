import { BasketProvider } from '@/hooks/useBasket';
import { ClubCardsProvider } from '@/hooks/useClubCards';
import { ThemeProvider } from '@/hooks/useTheme';
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ClubCardsProvider>
        <BasketProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </BasketProvider>
      </ClubCardsProvider>
    </ThemeProvider>
  );
}