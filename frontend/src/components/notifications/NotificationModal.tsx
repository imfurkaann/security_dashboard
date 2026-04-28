/**
 * NotificationModal Component
 * Ortada modal olarak gösteri
 */

import { NotificationPriority } from '../../types/notifications';
import type { Notification } from '../../types/notifications';
import { getPriorityColorClasses } from '../../config/notificationConfigs';
import { AlertCircle, AlertTriangle, Info, CheckCircle } from 'lucide-react';

interface NotificationModalProps {
  notification: Notification;
  onClose: () => void;
  onAcknowledge: () => void;
}

export default function NotificationModal({
  notification,
  onClose,
  onAcknowledge,
}: NotificationModalProps) {
  const colors = getPriorityColorClasses(notification.priority);

  const getIconComponent = () => {
    switch (notification.priority) {
      case NotificationPriority.CRITICAL:
        return <AlertCircle className="w-12 h-12 text-red-600" />;
      case NotificationPriority.HIGH:
        return <AlertTriangle className="w-12 h-12 text-orange-600" />;
      case NotificationPriority.NORMAL:
        return <CheckCircle className="w-12 h-12 text-emerald-600" />;
      case NotificationPriority.LOW:
        return <Info className="w-12 h-12 text-blue-600" />;
      default:
        return <Info className="w-12 h-12 text-gray-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div
        className={`
          w-full max-w-md rounded-2xl border-2 shadow-2xl p-6
          ${colors.bg} ${colors.border}
          animate-in zoom-in-95 fade-in duration-200
        `}
      >
        {/* Icon */}
        <div className="flex justify-center mb-4">
          {getIconComponent()}
        </div>

        {/* Title */}
        <h2 className={`text-xl font-bold text-center ${colors.text} mb-2`}>
          {notification.title}
        </h2>

        {/* Message */}
        <p className={`text-center ${colors.text} opacity-90 mb-6`}>
          {notification.message}
        </p>

        {/* Action Buttons */}
        <div className="space-y-3">
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
                w-full px-4 py-3 rounded-lg font-semibold text-white
                transition hover:opacity-90
                ${
                  notification.priority === NotificationPriority.CRITICAL
                    ? 'bg-red-600 hover:bg-red-700'
                    : notification.priority === NotificationPriority.HIGH
                      ? 'bg-orange-600 hover:bg-orange-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                }
              `}
            >
              {notification.action.label}
            </button>
          )}

          <button
            onClick={() => (notification.requiresAcknowledge ? onAcknowledge() : onClose())}
            className={`
              w-full px-4 py-3 rounded-lg font-semibold
              transition hover:opacity-80
              ${colors.bg} ${colors.border} border-2 ${colors.text}
            `}
          >
            {notification.requiresAcknowledge ? 'Anladım' : 'Kapat'}
          </button>
        </div>
      </div>
    </div>
  );
}
