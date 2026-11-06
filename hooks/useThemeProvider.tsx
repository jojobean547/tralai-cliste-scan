import { Colors, getRadii, getSpacing, getTypography } from '@/constants/theme';
import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';

interface ThemeContextValue {
  colors: typeof Colors.light | typeof Colors.dark;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: Colors.light,
  isDark: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  
  const isDark = scheme === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;

  return (
    <ThemeContext.Provider value={{ colors, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const { colors, isDark } = useContext(ThemeContext);
  const typography = getTypography();
  const spacing = getSpacing();
  const radii = getRadii();
  return { colors, isDark, typography, spacing, radii };
}
