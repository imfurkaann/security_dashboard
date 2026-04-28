/**
 * Bildirim Context
 * Merkezi bildirim yönetimi
 */

import React, { createContext, useCallback, useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  NotificationType,
} from '../types/notifications';
import type {
  Notification,
  NotificationContextType,
} from '../types/notifications';
import { getNotificationConfig } from '../config/notificationConfigs';

export const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: React.ReactNode;
  maxHistorySize?: number; // Kaç eski bildirim tutulacak
}

export function NotificationProvider({
  children,
  maxHistorySize = 50,
}: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [history, setHistory] = useState<Notification[]>([]);
  const timeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});

  /**
   * Yeni bildirim ekle
   */
  const addNotification = useCallback(
    (
      notification: Omit<Notification, 'id' | 'createdAt'>
    ): string => {
      const id = uuidv4();
      const config = getNotificationConfig(notification.type);

      // Konfigürasyondan eksik verileri doldur
      const completeNotification: Notification = {
        ...notification,
        id,
        createdAt: new Date(),
        priority: notification.priority || config.priority,
        channels: notification.channels || config.channels,
        autoDismissMs: notification.autoDismissMs ?? config.autoDismissMs,
        requiresAcknowledge: notification.requiresAcknowledge ?? config.requiresAcknowledge,
      };

      setNotifications((prev) => [completeNotification, ...prev]);

      // Auto-dismiss timer kur
      if (completeNotification.autoDismissMs && !completeNotification.requiresAcknowledge) {
        const timeout = setTimeout(() => {
          removeNotification(id);
        }, completeNotification.autoDismissMs);

        timeoutsRef.current[id] = timeout;
      }

      // Audio oynat
      if (config.sound) {
        playNotificationSound();
      }

      return id;
    },
    []
  );

  /**
   * Bildirimi kaldır
   */
  const removeNotification = useCallback((id: string) => {
    // Timer'ı temizle
    if (timeoutsRef.current[id]) {
      clearTimeout(timeoutsRef.current[id]);
      delete timeoutsRef.current[id];
    }

    // Bildirimi bul ve history'e taşı
    setNotifications((prev) => {
      const notification = prev.find((n) => n.id === id);
      if (notification) {
        setHistory((prevHistory) => {
          const updated = [notification, ...prevHistory];
          // Eski bildirimleri sil
          return updated.slice(0, maxHistorySize);
        });
      }
      return prev.filter((n) => n.id !== id);
    });
  }, [maxHistorySize]);

  /**
   * Bildirimi onaylandı olarak işaretle
   */
  const acknowledgeNotification = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, acknowledged: true } : n))
    );

    // 2 saniye sonra kaldır
    setTimeout(() => {
      removeNotification(id);
    }, 2000);
  }, [removeNotification]);

  /**
   * Tüm bildirimleri temizle
   */
  const clearAll = useCallback(() => {
    Object.values(timeoutsRef.current).forEach(clearTimeout);
    timeoutsRef.current = {};
    setNotifications([]);
  }, []);

  const value: NotificationContextType = {
    notifications,
    addNotification,
    removeNotification,
    acknowledgeNotification,
    clearAll,
    history,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

/**
 * Bildirim sesini oynat
 * Farklı öncelikler için farklı sesler
 */
function playNotificationSound() {
  try {
    // HTML5 Audio API ile basit ses
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800; // Hz
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (error) {
    console.warn('Audio play failed:', error);
  }
}
