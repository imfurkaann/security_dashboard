/**
 * useWebSocketNotifications Hook
 * WebSocket'ten gelen olayları dinleyip bildirim gönder
 */

import { useEffect } from 'react';
import { useNotification } from './useNotification';
import { subscribeToApiMutations, type ApiMutationEvent } from '../realtime/socket';
import { NotificationType } from '../types/notifications';
import api from '../utils/api';

export function useWebSocketNotifications() {
  const { notify, error } = useNotification();

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = subscribeToApiMutations(async (event: ApiMutationEvent) => {
      if (!isMounted) return;

      // QR sayfalarinda bildirim gostermeyelim.
      if (window.location.pathname.startsWith('/qr')) return;

      // Debug: log every incoming api:mutation event
      try {
        // eslint-disable-next-line no-console
        console.debug('[useWebSocketNotifications] api:mutation event', event);
      } catch (err) {
        // ignore logging errors
      }

      try {
        // QR Ziyaretçi Kaydı
        if (
          event.path.includes('/visitor-public') &&
          !event.path.includes('/visitor-public/sgk-records') &&
          event.method === 'POST' &&
          event.statusCode === 201
        ) {
          const visitorName = event.payload?.full_name || 'Ziyaretçi';
          notify({
            type: NotificationType.QR_VISITOR_CHECKIN,
            title: '✓ Ziyaretçi Girişi',
            message: `${visitorName} giriş yaptı`,
          });
        }
        // QR SGK Belgesi
        else if (
          event.path.includes('/visitor-public/sgk-records') &&
          event.method === 'POST' &&
          event.statusCode === 201
        ) {
          const fullName = event.payload?.full_name || 'Misafir';
          const companyName = event.payload?.company_name || '';
          notify({
            type: NotificationType.QR_SGK_UPLOAD,
            title: '✓ SGK Belgesi',
            message: companyName 
              ? `${fullName} - ${companyName} belgesi yüklendi` 
              : `${fullName} belgesi yüklendi`,
          });
        }
        // Genel Hata
        else if (event.statusCode >= 500) {
          error(
            '⚠️ Sistem Hatası',
            'Sunucu tarafında bir hata oluştu. Lütfen daha sonra tekrar deneyin.'
          );
        }
      } catch (err) {
        console.error('WebSocket notification error:', err);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [notify, error]);
}
