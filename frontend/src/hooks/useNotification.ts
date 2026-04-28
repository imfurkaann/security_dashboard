/**
 * useNotification Hook
 * Herhangi yerden bildirim göndermek için kullanılır
 */

import { useContext } from 'react';
import { NotificationContext } from '../context/NotificationContext';
import {
  NotificationType,
  NotificationPriority,
  NotificationChannel,
} from '../types/notifications';
import { getNotificationConfig } from '../config/notificationConfigs';

export function useNotification() {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }

  return {
    /**
     * Basit bildirim gönder
     * @example
     * notify({
     *   type: NotificationType.RECORD_CREATED,
     *   title: 'Başarılı',
     *   message: 'Kayıt oluşturuldu'
     * })
     */
    notify: (options: {
      type: NotificationType;
      title: string;
      message: string;
      icon?: string;
      action?: { label: string; callback: () => void };
      metadata?: Record<string, any>;
    }) => {
      const config = getNotificationConfig(options.type);

      return context.addNotification({
        type: options.type,
        priority: config.priority,
        channels: config.channels,
        title: options.title,
        message: options.message,
        icon: options.icon || config.icon,
        action: options.action,
        metadata: options.metadata,
        autoDismissMs: config.autoDismissMs,
        requiresAcknowledge: config.requiresAcknowledge,
      });
    },

    /**
     * Başarı bildirimi
     */
    success: (title: string, message: string) => {
      return context.addNotification({
        type: NotificationType.RECORD_CREATED,
        priority: NotificationPriority.NORMAL,
        channels: [NotificationChannel.TOAST],
        title,
        message,
        icon: '✓',
        autoDismissMs: 5000,
      });
    },

    /**
     * Hata bildirimi
     */
    error: (title: string, message: string) => {
      return context.addNotification({
        type: NotificationType.SYSTEM_ERROR,
        priority: NotificationPriority.HIGH,
        channels: [NotificationChannel.TOAST, NotificationChannel.BANNER],
        title,
        message,
        icon: '❌',
        autoDismissMs: 8000,
      });
    },

    /**
     * Uyarı bildirimi
     */
    warning: (title: string, message: string) => {
      return context.addNotification({
        type: NotificationType.SYSTEM_WARNING,
        priority: NotificationPriority.HIGH,
        channels: [NotificationChannel.TOAST],
        title,
        message,
        icon: '⚠️',
        autoDismissMs: 6000,
      });
    },

    /**
     * Info bildirimi
     */
    info: (title: string, message: string) => {
      return context.addNotification({
        type: NotificationType.SYSTEM_INFO,
        priority: NotificationPriority.LOW,
        channels: [NotificationChannel.TOAST],
        title,
        message,
        icon: 'ℹ️',
        autoDismissMs: 4000,
      });
    },

    /**
     * Kritik bildirim (Acknowledge gerekli)
     */
    critical: (title: string, message: string, onAcknowledge?: () => void) => {
      return context.addNotification({
        type: NotificationType.SYSTEM_ERROR,
        priority: NotificationPriority.CRITICAL,
        channels: [NotificationChannel.MODAL, NotificationChannel.BANNER, NotificationChannel.AUDIO],
        title,
        message,
        icon: '🚨',
        requiresAcknowledge: true,
        action: onAcknowledge
          ? { label: 'Anladım', callback: onAcknowledge }
          : undefined,
      });
    },

    // Context methodlarını direkt expose et
    addNotification: context.addNotification,
    removeNotification: context.removeNotification,
    acknowledgeNotification: context.acknowledgeNotification,
    clearAll: context.clearAll,
    getNotifications: () => context.notifications,
    getHistory: () => context.history,
  };
}
