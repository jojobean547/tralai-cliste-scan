// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tralaí Cliste Contributors
//
// The History screen: finished shops grouped by day, with a total for each day.
// Tap a shop to see its items. Shops are saved by "Finish shop" in the basket;
// the rules are in lib/history.ts, the storage in hooks/useHistory.tsx.

import { AppAlert } from '@/components/ui/AppAlert';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { StoreBadge } from '@/components/ui/StoreBadge';
import { TouchTargets } from '@/constants/theme';
import { useAlert } from '@/hooks/useAlert';
import { useHistory } from '@/hooks/useHistory';
import { useTheme } from '@/hooks/useTheme';
import { euro } from '@/lib/basketDisplay';
import { describeShopLine, groupByDay, timeLabel, type Shop } from '@/lib/history';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, SectionList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HistoryScreen() {
  const { colors, typography, spacing } = useTheme();
  const { shops, loaded, remove } = useHistory();
  const { showAlert, alertProps } = useAlert();
  const [open, setOpen] = useState<string | null>(null); // the shop whose items are showing

  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  const days = groupByDay(shops, new Date());
  const sections = days.map((d) => ({ ...d, data: d.shops }));

  const confirmDelete = (shop: Shop) =>
    showAlert({
      title: 'Delete this shop?',
      message: `Removes ${shop.store} ${euro(shop.total)} from your history.`,
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => remove(shop.id) },
      ],
    });

  const renderShop = (shop: Shop) => {
    const isOpen = open === shop.id;
    const time = timeLabel(new Date(shop.finished_at));
    const count = shop.item_count === 1 ? '1 item' : `${shop.item_count} items`;
    return (
      <Card style={{ paddingVertical: spacing.sm }}>
        <Pressable
          onPress={() => setOpen(isOpen ? null : shop.id)}
          accessibilityRole="button"
          accessibilityState={{ expanded: isOpen }}
          accessibilityLabel={`${shop.store}, ${time}, ${count}, ${euro(shop.total)}. ${isOpen ? 'Hide' : 'Show'} items.`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: TouchTargets.minHeight }}
        >
          <View style={{ flex: 1, gap: spacing.xs }}>
            <View style={{ flexDirection: 'row' }}>
              <StoreBadge store={shop.store} size="sm" />
            </View>
            <Text style={{ fontSize: typography.bodySmall, color: colors.textSecondary }}>
              {time} · {count}{shop.saving > 0 ? ` · saved ${euro(shop.saving)}` : ''}
            </Text>
          </View>
          <Text style={{ fontSize: typography.heading3, fontWeight: typography.bold, color: colors.textPrimary }}>{euro(shop.total)}</Text>
          <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={22} color={colors.textSecondary} />
        </Pressable>

        {isOpen && (
          <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.sm, paddingTop: spacing.sm, gap: spacing.sm }}>
            {shop.lines.map((line, i) => {
              const d = describeShopLine(line, i + 1);
              return (
                <View key={line.item.id} style={{ flexDirection: 'row', gap: spacing.md }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: typography.body, color: colors.textPrimary }}>{d.title}</Text>
                    {!!d.deal && <Text style={{ fontSize: typography.caption, color: colors.textSecondary }}>{d.deal}</Text>}
                  </View>
                  <Text style={{ fontSize: typography.body, color: colors.textPrimary }}>{d.total}</Text>
                </View>
              );
            })}
            <Pressable
              onPress={() => confirmDelete(shop)}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${shop.store} shop`}
              style={{ alignSelf: 'flex-start', minHeight: TouchTargets.minHeight, justifyContent: 'center' }}
            >
              <Text style={{ fontSize: typography.bodySmall, fontWeight: typography.semibold, color: colors.error }}>Delete this shop</Text>
            </Pressable>
          </View>
        )}
      </Card>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      {shops.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="time-outline" size={96} color={colors.primaryGreen} />}
          title="No shops yet"
          subtitle={'When you finish shopping, tap "Finish shop" in your basket to save it here'}
        />
      ) : (
        <>
          <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}>
            <Text style={{ fontSize: typography.heading1, fontWeight: typography.bold, color: colors.textPrimary }}>History</Text>
          </View>
          <SectionList
            sections={sections}
            keyExtractor={(shop) => shop.id}
            stickySectionHeadersEnabled={false}
            contentContainerStyle={{ padding: spacing.xl, paddingTop: spacing.sm }}
            renderSectionHeader={({ section }) => (
              <View
                accessibilityRole="header"
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: spacing.lg, marginBottom: spacing.sm }}
              >
                <Text style={{ fontSize: typography.heading3, fontWeight: typography.bold, color: colors.textPrimary }}>{section.label}</Text>
                <Text style={{ fontSize: typography.heading3, fontWeight: typography.bold, color: colors.primaryGreen }}>
                  {section.shops.length > 1 ? `Total ${euro(section.total)}` : ''}
                </Text>
              </View>
            )}
            renderItem={({ item }) => renderShop(item)}
            ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          />
        </>
      )}
      <AppAlert {...alertProps} />
    </SafeAreaView>
  );
}
