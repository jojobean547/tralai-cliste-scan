
import type { AlertButton } from '@/components/ui/AppAlert';
import { useState } from 'react';

interface AlertConfig {
  title: string;
  message?: string;
  buttons: AlertButton[];
}

export function useAlert() {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<AlertConfig>({ title: '', buttons: [] });

  const showAlert = (alertConfig: AlertConfig) => {
    setConfig(alertConfig);
    setVisible(true);
  };

  const hideAlert = () => setVisible(false);

  const alertProps = {
    visible,
    title: config.title,
    message: config.message,
    buttons: config.buttons,
    onDismiss: hideAlert,
  };

  return { showAlert, hideAlert, alertProps };
}
