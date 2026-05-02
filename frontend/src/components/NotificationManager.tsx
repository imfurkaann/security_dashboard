/**
 * NotificationManager Component
 * Tüm bildirimleri her kanalda render et
 */

import { useContext } from 'react';
import { NotificationContext } from '../context/NotificationContext';
import { NotificationChannel, NotificationPriority } from '../types/notifications';
import { getPriorityColorClasses } from '../config/notificationConfigs';
import NotificationToast from './notifications/NotificationToast';
import NotificationModal from './notifications/NotificationModal';
import NotificationBanner from './notifications/NotificationBanner';

export default function NotificationManager() {
  const context = useContext(NotificationContext);

  if (window.location.pathname.startsWith('/qr')) {
    return null;
  }

  if (!context) {
    return null;
  }

  const { notifications, removeNotification, acknowledgeNotification } = context;

  // Kanalara göre filtrele
  const toastNotifications = notifications.filter((n) =>
    n.channels.includes(NotificationChannel.TOAST)
  );

  const modalNotifications = notifications.filter((n) =>
    n.channels.includes(NotificationChannel.MODAL)
  );

  const bannerNotifications = notifications.filter((n) =>
    n.channels.includes(NotificationChannel.BANNER)
  );

  return (
    <>
      {/* TOAST NOTIFICATIONS - Sağ üst */}
      <div className="fixed top-6 right-6 z-[90] space-y-3 pointer-events-none max-w-md">
        {toastNotifications.map((notification) => (
          <div key={notification.id} className="pointer-events-auto">
            <NotificationToast
              notification={notification}
              onClose={() => removeNotification(notification.id)}
              onAcknowledge={() => acknowledgeNotification(notification.id)}
            />
          </div>
        ))}
      </div>

      {/* MODAL NOTIFICATIONS - Ortada */}
      {modalNotifications.map((notification) => (
        <NotificationModal
          key={notification.id}
          notification={notification}
          onClose={() => removeNotification(notification.id)}
          onAcknowledge={() => acknowledgeNotification(notification.id)}
        />
      ))}

      {/* BANNER NOTIFICATIONS - Üstte */}
      {bannerNotifications.length > 0 && (
        <div className="fixed top-0 left-0 right-0 z-[85] space-y-0">
          {bannerNotifications.map((notification) => (
            <NotificationBanner
              key={notification.id}
              notification={notification}
              onClose={() => removeNotification(notification.id)}
              onAcknowledge={() => acknowledgeNotification(notification.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}
