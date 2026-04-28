// Bildirim Tipi
export enum NotificationType {
  QR_VISITOR_CHECKIN = 'qr_visitor_checkin',
  QR_SGK_UPLOAD = 'qr_sgk_upload',
  SYSTEM_ERROR = 'system_error',
  SYSTEM_WARNING = 'system_warning',
  SYSTEM_INFO = 'system_info',
  RECORD_CREATED = 'record_created',
  RECORD_UPDATED = 'record_updated',
  RECORD_DELETED = 'record_deleted',
  DATA_SYNC = 'data_sync',
  DATA_CONFLICT = 'data_conflict',
  WHATSAPP_SENT = 'whatsapp_sent',
  WHATSAPP_FAILED = 'whatsapp_failed',
  ADMIN_ACTION = 'admin_action',
}

// Öncelik Seviyesi
export enum NotificationPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  NORMAL = 'normal',
  LOW = 'low',
}

// Bildirim Kanalı
export enum NotificationChannel {
  TOAST = 'toast',
  MODAL = 'modal',
  BANNER = 'banner',
  AUDIO = 'audio',
}

// Konfigürasyon
export interface NotificationConfig {
  type: NotificationType;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  autoDismissMs?: number;
  requiresAcknowledge?: boolean;
  icon?: string;
  sound?: boolean;
  persistInHistory?: boolean;
}

// Bildirim
export interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  title: string;
  message: string;
  icon?: string;
  action?: {
    label: string;
    callback: () => void;
  };
  metadata?: Record<string, any>;
  createdAt: Date;
  autoDismissMs?: number;
  requiresAcknowledge?: boolean;
  acknowledged?: boolean;
}

// Context Tipi
export interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => string;
  removeNotification: (id: string) => void;
  acknowledgeNotification: (id: string) => void;
  clearAll: () => void;
  history: Notification[];
}

// Event Tipi
export interface NotificationEvent {
  eventType: NotificationType;
  priority?: NotificationPriority;
  title: string;
  message: string;
  metadata?: Record<string, any>;
}
