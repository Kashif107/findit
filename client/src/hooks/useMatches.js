import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api.js';
import { useSocket } from '../context/SocketContext.jsx';

// Loads /items/:id/matches. The socket `new-match` event refreshes instantly;
// polling every 3s is the fallback until the server reports processed (or failed).
export default function useMatches(itemId, enabled = true) {
  const socket = useSocket();
  const [state, setState] = useState({ loading: true, processed: false, embeddingStatus: 'pending', matches: [], duplicates: [] });
  const stopped = useRef(false);

  const fetchOnce = useCallback(async () => {
    try {
      const { data } = await api.get(`/items/${itemId}/matches`);
      setState({ loading: false, ...data });
      if (data.processed || data.embeddingStatus === 'failed') stopped.current = true;
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, [itemId]);

  useEffect(() => {
    if (!enabled) return;
    stopped.current = false;
    fetchOnce();
    const timer = setInterval(() => { if (stopped.current) clearInterval(timer); else fetchOnce(); }, 3000);
    return () => clearInterval(timer);
  }, [enabled, fetchOnce]);

  useEffect(() => {
    if (!socket || !enabled) return;
    const onMatch = (p) => { if (p?.itemId === itemId) fetchOnce(); };
    socket.on('new-match', onMatch);
    return () => socket.off('new-match', onMatch);
  }, [socket, enabled, itemId, fetchOnce]);

  return { ...state, refresh: fetchOnce };
}
