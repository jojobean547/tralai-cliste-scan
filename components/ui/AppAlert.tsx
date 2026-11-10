
import { useTheme } from '@/hooks/useTheme';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AppAlertProps {
  visible: boolean;
  title: string;
  message?: string;
  buttons: AlertButton[];
  onDismiss: () => void;
}

export function AppAlert({ visible, title, message, buttons, onDismiss }: AppAlertProps) {
  const { colors, typography, spacing, radii } = useTheme();

  const styles = StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    card: {
      width: '85%',
      borderRadius: radii.lg,
      borderWidth: 0.5,
      padding: spacing.xl,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 8,
    },
    title: {
      fontSize: typography.heading1,
      fontWeight: '600',
      fontFamily: 'Inter',
    },
    message: {
      fontSize: typography.body,
      fontFamily: 'Inter',
      marginTop: spacing.sm,
      lineHeight: typography.body * 1.5,
    },
    buttonRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: spacing.xl,
      gap: spacing.lg,
      flexWrap: 'wrap',
    },
    buttonBase: {
      fontSize: typography.body,
      fontFamily: 'Inter',
      paddingVertical: 4,
    },
    buttonBold: {
      fontWeight: '600',
    },
  });

  const handleButtonPress = (btn: AlertButton) => {
    onDismiss();
    // Defer onPress so the modal has closed before any follow-up alert is shown
    if (btn.onPress) setTimeout(btn.onPress, 0);
  };

  const buttonTextColor = (btn: AlertButton) => {
    if (btn.style === 'destructive') return colors.error;
    if (btn.style === 'cancel') return colors.textSecondary;
    return colors.primaryGreen;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        {/* Inner Pressable blocks backdrop dismissal when card is tapped */}
        <Pressable
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              shadowColor: '#000',
            },
          ]}
        >
          <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
          {!!message && (
            <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
          )}
          <View style={styles.buttonRow}>
            {buttons.map((btn, i) => (
              <Pressable
                key={i}
                onPress={() => handleButtonPress(btn)}
                hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
              >
                <Text
                  style={[
                    styles.buttonBase,
                    { color: buttonTextColor(btn) },
                    btn.style !== 'cancel' && styles.buttonBold,
                  ]}
                >
                  {btn.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

