// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tralaí Cliste Contributors
//
// The Settings screen: which club cards the shopper has, the saved test scans,
// and about the app. The cards are kept on the phone by hooks/useClubCards.tsx;
// the basket total uses club prices and club-only deals only for the cards
// switched on here. Saved scans are in hooks/useScanLog.ts.

import { AppAlert } from '@/components/ui/AppAlert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StoreBadge } from '@/components/ui/StoreBadge';
import { clubCardChoices } from '@/constants/stores';
import { TouchTargets } from '@/constants/theme';
import { useAlert } from '@/hooks/useAlert';
import { useClubCards } from '@/hooks/useClubCards';
import { useScanLog } from '@/hooks/useScanLog';
import { useTheme } from '@/hooks/useTheme';
import { passesPriceMark, PRICE_PASS_MARK, tallyText } from '@/lib/scanLog';
import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { useFocusEffect } from 'expo-router';
import { Linking, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const CARDS = clubCardChoices();
const CONTACT = 'hello@tralaicliste.ie';

export default function SettingsScreen() {
  const { colors, typography, spacing } = useTheme();
  const { hasClubCard, setClubCard } = useClubCards();
  const version = Constants.expoConfig?.version ?? '';
  const scans = useScanLog();
  const { showAlert, alertProps } = useAlert();

  // Scans are added on the Scan tab, so count them again each time Settings opens
  useFocusEffect(scans.refresh);

  const exportScans = async () => {
    const result = await scans.exportAll();
    showAlert(
      result.ok
        ? { title: 'Scans exported', message: `${result.count} scans and their photos are in the folder "${result.folder}".`, buttons: [{ text: 'OK' }] }
        : { title: 'Nothing exported', message: result.message, buttons: [{ text: 'OK' }] },
    );
  };
  const confirmDelete = () =>
    showAlert({
      title: 'Delete saved scans?',
      message: `This deletes all ${scans.count} saved scans and their photos from this phone. Export them first if you want to keep them.`,
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: scans.deleteAll },
      ],
    });

  const pass = passesPriceMark(scans.summary.price);
  const stores = Object.entries(scans.summary.byStore).sort(([a], [b]) => a.localeCompare(b));

  const sectionTitle = { fontSize: typography.heading3, fontWeight: typography.bold, color: colors.textPrimary };
  const bodyText = { fontSize: typography.bodySmall, color: colors.textSecondary };
  const open = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  // A link row: big enough to tap, with an arrow so it looks tappable
  const linkRow = (label: string, detail: string, url: string, icon: keyof typeof Ionicons.glyphMap) => (
    <Pressable
      onPress={() => open(url)}
      accessibilityRole="link"
      accessibilityLabel={`${label}: ${detail}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: TouchTargets.minHeight, paddingVertical: spacing.sm }}
    >
      <Ionicons name={icon} size={24} color={colors.primaryGreen} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: typography.body, fontWeight: typography.semibold, color: colors.textPrimary }}>{label}</Text>
        <Text style={bodyText}>{detail}</Text>
      </View>
      <Ionicons name="open-outline" size={20} color={colors.textSecondary} />
    </Pressable>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.md }}>
        <Text style={{ fontSize: typography.heading2, fontWeight: typography.bold, color: colors.textPrimary }}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingTop: spacing.sm, gap: spacing.xl }}>
        {/* ── Club cards ── */}
        <View style={{ gap: spacing.md }}>
          <Text style={sectionTitle}>Your club cards</Text>
          <Text style={bodyText}>
            Turn on the cards you have. Your basket total then uses club card prices and club-only deals for those shops.
          </Text>

          <Card style={{ paddingVertical: spacing.xs }}>
            {CARDS.map((card, i) => {
              const on = hasClubCard(card.name);
              return (
                <Pressable
                  key={card.name}
                  onPress={() => setClubCard(card.name, !on)}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${card.name}, ${card.store}`}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 64,
                    borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border,
                  }}
                >
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <Text style={{ fontSize: typography.body, fontWeight: typography.semibold, color: colors.textPrimary }}>{card.name}</Text>
                    <View style={{ flexDirection: 'row' }}>
                      <StoreBadge store={card.store} size="sm" />
                    </View>
                  </View>
                  <Switch
                    value={on}
                    onValueChange={(v) => setClubCard(card.name, v)}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                    trackColor={{ true: colors.primaryGreen, false: colors.border }}
                  />
                </Pressable>
              );
            })}
          </Card>

          <Card variant="gold">
            <Text style={{ fontSize: typography.bodySmall, color: colors.textPrimary }}>
              {"Dunnes Stores VALUEclub discounts are taken off at the till, not printed on shelf labels, so they can't be counted in your total."}
            </Text>
          </Card>
        </View>

        {/* ── Testing the label reader ── */}
        <View style={{ gap: spacing.md }}>
          <Text style={sectionTitle}>Testing the label reader</Text>
          <Text style={bodyText}>
            Each scanned label you add to the basket is saved here with its photo, so we can check how well the reader does.
          </Text>

          <Card style={{ gap: spacing.sm }}>
            <Text style={{ fontSize: typography.body, fontWeight: typography.semibold, color: colors.textPrimary }}>
              {scans.count === 1 ? '1 scan saved' : `${scans.count} scans saved`}
              {scans.count > 0 ? ` · ${scans.sizeMb} MB` : ''}
            </Text>

            {scans.count > 0 && (
              <>
                <Text style={{ fontSize: typography.bodySmall, color: colors.textPrimary }}>
                  Shelf price right: {tallyText(scans.summary.price)}
                </Text>
                {pass !== null && (
                  <Text style={{ fontSize: typography.bodySmall, fontWeight: typography.semibold, color: pass ? colors.primaryGreen : colors.error }}>
                    {pass ? '✓ ' : ''}{pass ? 'Above' : 'Below'} the pass mark of {Math.round(PRICE_PASS_MARK * 10)} in 10
                  </Text>
                )}
                <Text style={bodyText}>Club price right: {tallyText(scans.summary.club)}</Text>
                <Text style={bodyText}>Deal right: {tallyText(scans.summary.deal)}</Text>

                <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.xs }} />
                {stores.map(([store, s]) => (
                  <Text key={store} style={bodyText}>
                    {store}: price {tallyText(s.price)}
                  </Text>
                ))}
              </>
            )}
          </Card>

          {scans.count > 0 && (
            <View style={{ gap: spacing.sm }}>
              <Button variant="primary" size="md" onPress={exportScans} loading={scans.busy}>
                Export scans to a folder
              </Button>
              <Button variant="ghost" size="md" onPress={confirmDelete} disabled={scans.busy}>
                Delete saved scans
              </Button>
            </View>
          )}
        </View>

        {/* ── About ── */}
        <View style={{ gap: spacing.md }}>
          <Text style={sectionTitle}>About Tralaí Cliste</Text>
          <Card style={{ gap: spacing.md }}>
            <Text style={{ fontSize: typography.body, color: colors.textPrimary }}>
              A free, non-profit app to help you keep track of your shopping total in Irish supermarkets.
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
              <Ionicons name="lock-closed-outline" size={22} color={colors.primaryGreen} style={{ marginTop: 2 }} />
              <Text style={{ flex: 1, fontSize: typography.bodySmall, color: colors.textPrimary }}>
                Your basket and settings stay on this phone. The only thing sent anywhere is a barcode, when you look a product up.
              </Text>
            </View>
          </Card>

          <Card style={{ paddingVertical: spacing.xs }}>
            {linkRow('Product information', 'From Open Food Facts, shared under the Open Database License', 'https://world.openfoodfacts.org', 'nutrition-outline')}
            <View style={{ height: 1, backgroundColor: colors.border }} />
            {linkRow('Contact us', CONTACT, `mailto:${CONTACT}`, 'mail-outline')}
            <View style={{ height: 1, backgroundColor: colors.border }} />
            {linkRow('Open source', 'Free software under the GNU AGPL 3.0 licence', 'https://www.gnu.org/licenses/agpl-3.0.html', 'code-slash-outline')}
          </Card>

          {!!version && <Text style={{ ...bodyText, textAlign: 'center' }}>Version {version}</Text>}
        </View>
      </ScrollView>
      <AppAlert {...alertProps} />
    </SafeAreaView>
  );
}
