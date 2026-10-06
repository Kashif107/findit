import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';

const EVENTS = ['new-match', 'claim-update', 'notification'];

export default function useNotifications({ toastOnEvent = false } = {}) {
  const { user } = useAuth();
  const socket = useSocket();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await api.get('/notifications');
      setItems(data.notifications);
      setUnread(data.unreadCount);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!socket) return;
    const handler = (p) => {
      if (!p?.notification) return;
      setItems((prev) => [p.notification, ...prev.filter((n) => n._id !== p.notification._id)]);
      setUnread((u) => u + 1);
      if (toastOnEvent) toast(p.notification.message, { icon: '🔔' });
    };
    EVENTS.forEach((e) => socket.on(e, handler));
    return () => EVENTS.forEach((e) => socket.off(e, handler));
  }, [socket, toastOnEvent]);

  const markAllRead = useCallback(async () => {
    await api.patch('/notifications/read');
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
  }, []);

  return { items, unread, loading, markAllRead, reload: load };
}
