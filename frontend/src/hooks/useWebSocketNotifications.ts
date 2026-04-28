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
  const { notify, success, error, warning } = useNotification();

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = subscribeToApiMutations(async (event: ApiMutationEvent) => {
      if (!isMounted) return;

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
          event.method === 'POST' &&
          event.statusCode === 201
        ) {
          try {
            const res = await api.get('/visitors/records');
            const records = res.data || [];

            // Debug: log fetched visitor records
            // eslint-disable-next-line no-console
            console.debug('[useWebSocketNotifications] fetched visitors records', { length: records.length, sample: records[0] });

            if (records.length > 0) {
              const record = records.find((item: any) => {
                const entryBy = typeof item?.entry_by === 'string'
                  ? item.entry_by.toLocaleLowerCase('tr-TR')
                  : '';
                const entryByName = typeof item?.entry_by_name === 'string'
                  ? item.entry_by_name.toLocaleLowerCase('tr-TR')
                  : '';

                return entryBy.includes('misafir') || entryByName.includes('misafir');
              }) || records[0];

              notify({
                type: NotificationType.QR_VISITOR_CHECKIN,
                title: '✓ Ziyaretçi Girişi',
                message: `${record.full_name || 'Ziyaretçi'} giriş yaptı`,
              });
            } else {
              notify({
                type: NotificationType.QR_VISITOR_CHECKIN,
                title: '✓ Ziyaretçi Girişi',
                message: 'QR ile yeni ziyaretçi kaydı oluşturuldu',
              });
            }
          } catch (fetchErr) {
            // Debug: log fetch error
            // eslint-disable-next-line no-console
            console.debug('[useWebSocketNotifications] visitors fetch error', fetchErr);

            notify({
              type: NotificationType.QR_VISITOR_CHECKIN,
              title: '✓ Ziyaretçi Girişi',
              message: 'QR ile yeni ziyaretçi kaydı oluşturuldu',
            });
          }
        }
        // QR SGK Belgesi
        else if (
          event.path.includes('/sgk') &&
          event.method === 'POST' &&
          event.statusCode === 201
        ) {
          try {
            const res = await api.get('/sgk/records');
            const records = res.data || [];

            if (records.length > 0) {
              const record = records[0];
              notify({
                type: NotificationType.QR_SGK_UPLOAD,
                title: '✓ SGK Belgesi',
                message: `${record.full_name} - ${record.company_name} belgesi yüklendi`,
              });
            }
          } catch {
            notify({
              type: NotificationType.QR_SGK_UPLOAD,
              title: '✓ SGK Belgesi',
              message: 'QR ile yeni SGK belgesi kaydı oluşturuldu',
            });
          }
        }
        // Araç Kaydı Oluşturuldu
        else if (
          event.path.includes('/vehicles') &&
          event.method === 'POST' &&
          event.statusCode === 201
        ) {
          notify({
            type: NotificationType.RECORD_CREATED,
            title: '✓ Araç Kaydedildi',
            message: 'Yeni araç kaydı başarıyla oluşturuldu',
          });
        }
        // Araç Kaydı Güncellendi
        else if (
          event.path.includes('/vehicles') &&
          event.method === 'PUT' &&
          event.statusCode === 200
        ) {
          notify({
            type: NotificationType.RECORD_UPDATED,
            title: '🔄 Araç Güncellenendi',
            message: 'Araç kaydı başarıyla güncellendi',
          });
        }
        // Araç Kaydı Silindi
        else if (
          event.path.includes('/vehicles') &&
          event.method === 'DELETE' &&
          event.statusCode === 200
        ) {
          warning('🗑️ Araç Silindi', 'Araç kaydı başarıyla silindi');
        }
        // Müdür Kaydı Oluşturuldu
        else if (
          event.path.includes('/managers') &&
          event.method === 'POST' &&
          event.statusCode === 201
        ) {
          notify({
            type: NotificationType.RECORD_CREATED,
            title: '✓ Müdür Kaydedildi',
            message: 'Yeni müdür kaydı başarıyla oluşturuldu',
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
  }, [notify, success, error, warning]);
}
