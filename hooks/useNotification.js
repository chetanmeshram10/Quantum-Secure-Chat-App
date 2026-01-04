import { useState, useCallback, useEffect } from 'react';

export function useNotification() {
  const [permission, setPermission] = useState('default');

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if ('Notification' in window) {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    }
    return 'denied';
  }, []);

  const showNotification = useCallback((title, options = {}) => {
    if (permission === 'granted') {
      const notification = new Notification(title, {
        icon: '/chat-icon.png',
        badge: '/chat-icon.png',
        ...options,
      });

      // Play sound
      const audio = new Audio('/notification.mp3');
      audio.play().catch(() => {});

      // Auto close after 5 seconds
      setTimeout(() => notification.close(), 5000);

      return notification;
    }
  }, [permission]);

  return { permission, requestPermission, showNotification };
}