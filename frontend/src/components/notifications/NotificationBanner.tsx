/**
 * NotificationBanner Component
 * Sayfanın üstünde banner olarak gösteri
 */

import { useEffect } from 'react';
import { NotificationPriority } from '../../types/notifications';
import type { Notification } from '../../types/notifications';
import { getPriorityColorClasses } from '../../config/notificationConfigs';
import { X } from 'lucide-react';

interface NotificationBannerProps {
  notification: Notification;
  onClose: () => void;
  onAcknowledge: () => void;
}

export default function NotificationBanner({
  notification,
  onClose,
  onAcknowledge,
}: NotificationBannerProps) {
  const colors = getPriorityColorClasses(notification.priority);

  useEffect(() => {
    if (notification.requiresAcknowledge) {
      return;
    }

    if (notification.autoDismissMs) {
      const timer = setTimeout(onClose, notification.autoDismissMs);
      return () => clearTimeout(timer);
    }
  }, [notification, onClose]);

  return (
    <div
      className={`
        w-full border-b-2 shadow-md p-4 animate-in slide-in-from-top
        ${colors.bg} ${colors.border}
      `}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Icon & Content */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {notification.icon && (
            <div className={`flex-shrink-0 text-2xl`}>
              {notification.icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className={`font-bold ${colors.text}`}>
              {notification.title}
            </h3>
            <p className={`text-sm ${colors.text} opacity-90`}>
              {notification.message}
            </p>
          </div>
        </div>

        {/* Action Button */}
        {notification.action && (
          <button
            onClick={() => {
              notification.action?.callback();
              if (notification.requiresAcknowledge) {
                onAcknowledge();
              } else {
                onClose();
              }
            }}
            className={`
              px-4 py-2 rounded font-semibold text-white text-sm flex-shrink-0
              hover:opacity-90 transition
              ${
                notification.priority === NotificationPriority.CRITICAL
                  ? 'bg-red-600 hover:bg-red-700'
                  : notification.priority === NotificationPriority.HIGH
                    ? 'bg-orange-600 hover:bg-orange-700'
                    : 'bg-blue-600 hover:bg-blue-700'
              }
            `}
          >
            {notification.action.label}
          </button>
        )}

        {/* Close Button */}
        <button
          onClick={onClose}
          className={`flex-shrink-0 ${colors.text} hover:opacity-70 transition`}
          aria-label="Kapat"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
}
