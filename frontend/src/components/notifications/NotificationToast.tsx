/**
 * NotificationToast Component
 * Sağ üst köşede gösteri
 */

import { useEffect } from 'react';
import { NotificationPriority } from '../../types/notifications';
import type { Notification } from '../../types/notifications';
import { getPriorityColorClasses } from '../../config/notificationConfigs';
import { X } from 'lucide-react';

interface NotificationToastProps {
  notification: Notification;
  onClose: () => void;
  onAcknowledge: () => void;
}

export default function NotificationToast({
  notification,
  onClose,
  onAcknowledge,
}: NotificationToastProps) {
  const colors = getPriorityColorClasses(notification.priority);

  useEffect(() => {
    if (notification.requiresAcknowledge) {
      return; // Manuel kapatma gerekli
    }

    if (notification.autoDismissMs) {
      const timer = setTimeout(onClose, notification.autoDismissMs);
      return () => clearTimeout(timer);
    }
  }, [notification, onClose]);

  return (
    <div
      className={`
        rounded-lg border-2 shadow-lg p-4 animate-in fade-in slide-in-from-top-2
        ${colors.bg} ${colors.border}
      `}
    >
      <div className="flex gap-3">
        {/* Icon */}
        {notification.icon && (
          <div className={`flex-shrink-0 text-xl ${colors.icon}`}>
            {notification.icon}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`font-bold text-sm md:text-base ${colors.text}`}>
            {notification.title}
          </p>
          <p className={`text-xs md:text-sm mt-1 ${colors.text} opacity-90`}>
            {notification.message}
          </p>

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
                mt-3 px-3 py-1 rounded text-xs font-semibold text-white
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
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className={`flex-shrink-0 ${colors.text} hover:opacity-70 transition`}
          aria-label="Kapat"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
