/**
 * Bildirim Konfigürasyonları
 * Her bildirim tipinin davranışı burada tanımlanır
 */

import {
  NotificationType,
  NotificationPriority,
  NotificationChannel,
} from '../types/notifications';
import type { NotificationConfig } from '../types/notifications';

export const notificationConfigs: Record<NotificationType, NotificationConfig> = {
  // QR İşlemleri - Normal bildirim
  [NotificationType.QR_VISITOR_CHECKIN]: {
    type: NotificationType.QR_VISITOR_CHECKIN,
    priority: NotificationPriority.NORMAL,
    channels: [NotificationChannel.TOAST],
    autoDismissMs: 8000,
    icon: '✓',
  },

  [NotificationType.QR_SGK_UPLOAD]: {
    type: NotificationType.QR_SGK_UPLOAD,
    priority: NotificationPriority.NORMAL,
    channels: [NotificationChannel.TOAST],
    autoDismissMs: 8000,
    icon: '📄',
  },

  // Sistem Hataları - Kritik
  [NotificationType.SYSTEM_ERROR]: {
    type: NotificationType.SYSTEM_ERROR,
    priority: NotificationPriority.CRITICAL,
    channels: [NotificationChannel.MODAL, NotificationChannel.BANNER, NotificationChannel.AUDIO],
    requiresAcknowledge: true,
    icon: '⚠️',
    sound: true,
    persistInHistory: true,
  },

  // Sistem Uyarıları - Yüksek
  [NotificationType.SYSTEM_WARNING]: {
    type: NotificationType.SYSTEM_WARNING,
    priority: NotificationPriority.HIGH,
    channels: [NotificationChannel.BANNER, NotificationChannel.TOAST],
    autoDismissMs: 6000,
    icon: '⚡',
    sound: true,
  },

  // Sistem Bilgi - Normal
  [NotificationType.SYSTEM_INFO]: {
    type: NotificationType.SYSTEM_INFO,
    priority: NotificationPriority.NORMAL,
    channels: [NotificationChannel.TOAST],
    autoDismissMs: 4000,
    icon: 'ℹ️',
  },

  // Kayıt İşlemleri - Normal
  [NotificationType.RECORD_CREATED]: {
    type: NotificationType.RECORD_CREATED,
    priority: NotificationPriority.NORMAL,
    channels: [NotificationChannel.TOAST],
    autoDismissMs: 5000,
    icon: '✨',
  },

  [NotificationType.RECORD_UPDATED]: {
    type: NotificationType.RECORD_UPDATED,
    priority: NotificationPriority.NORMAL,
    channels: [NotificationChannel.TOAST],
    autoDismissMs: 5000,
    icon: '🔄',
  },

  [NotificationType.RECORD_DELETED]: {
    type: NotificationType.RECORD_DELETED,
    priority: NotificationPriority.HIGH,
    channels: [NotificationChannel.TOAST, NotificationChannel.BANNER],
    autoDismissMs: 5000,
    icon: '🗑️',
  },

  // Veri Senkronizasyonu - Normal
  [NotificationType.DATA_SYNC]: {
    type: NotificationType.DATA_SYNC,
    priority: NotificationPriority.LOW,
    channels: [NotificationChannel.TOAST],
    autoDismissMs: 3000,
    icon: '🔗',
  },

  // Veri Çakışması - Yüksek
  [NotificationType.DATA_CONFLICT]: {
    type: NotificationType.DATA_CONFLICT,
    priority: NotificationPriority.HIGH,
    channels: [NotificationChannel.MODAL, NotificationChannel.BANNER],
    requiresAcknowledge: true,
    icon: '⚔️',
    persistInHistory: true,
  },

  // WhatsApp - Normal
  [NotificationType.WHATSAPP_SENT]: {
    type: NotificationType.WHATSAPP_SENT,
    priority: NotificationPriority.NORMAL,
    channels: [NotificationChannel.TOAST],
    autoDismissMs: 5000,
    icon: '💬',
  },

  [NotificationType.WHATSAPP_FAILED]: {
    type: NotificationType.WHATSAPP_FAILED,
    priority: NotificationPriority.HIGH,
    channels: [NotificationChannel.TOAST, NotificationChannel.BANNER],
    autoDismissMs: 8000,
    icon: '❌',
  },

  // Yönetim - Yüksek
  [NotificationType.ADMIN_ACTION]: {
    type: NotificationType.ADMIN_ACTION,
    priority: NotificationPriority.HIGH,
    channels: [NotificationChannel.TOAST, NotificationChannel.BANNER],
    autoDismissMs: 6000,
    icon: '🔐',
    persistInHistory: true,
  },
};

/**
 * Bildirim tipinden konfigürasyonu al
 */
export function getNotificationConfig(type: NotificationType): NotificationConfig {
  return notificationConfigs[type] || {
    type,
    priority: NotificationPriority.NORMAL,
    channels: [NotificationChannel.TOAST],
    autoDismissMs: 5000,
  };
}

/**
 * Öncelik seviyesine göre CSS renk sınıfı
 */
export function getPriorityColorClasses(priority: NotificationPriority) {
  switch (priority) {
    case NotificationPriority.CRITICAL:
      return {
        bg: 'bg-red-100',
        border: 'border-red-400',
        text: 'text-red-950',
        icon: 'text-red-600',
      };
    case NotificationPriority.HIGH:
      return {
        bg: 'bg-orange-100',
        border: 'border-orange-400',
        text: 'text-orange-950',
        icon: 'text-orange-600',
      };
    case NotificationPriority.NORMAL:
      return {
        bg: 'bg-emerald-100',
        border: 'border-emerald-400',
        text: 'text-emerald-950',
        icon: 'text-emerald-600',
      };
    case NotificationPriority.LOW:
      return {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-900',
        icon: 'text-blue-600',
      };
    default:
      return {
        bg: 'bg-gray-50',
        border: 'border-gray-200',
        text: 'text-gray-900',
        icon: 'text-gray-600',
      };
  }
}
