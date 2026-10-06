import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useNotifications from '../hooks/useNotifications.js';
import { fmtDateTime } from '../constants.js';

export default function NotificationBell() {
  const { items, unread, markAllRead } = useNotifications({ toastOnEvent: true });
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button className="relative rounded-lg p-2 hover:bg-slate-100" aria-label={`Notifications, ${unread} unread`} onClick={() => setOpen((o) => !o)}>
        <span aria-hidden>🔔</span>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[90vw] rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && <button className="text-xs font-medium text-brand-700 hover:underline" onClick={markAllRead}>Mark all read</button>}
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">Nothing yet. Matches will show up here.</li>}
            {items.slice(0, 8).map((n) => (
              <li key={n._id}>
                <button
                  className={`block w-full px-4 py-3 text-left text-sm hover:bg-slate-50 ${n.read ? 'text-slate-600' : 'bg-brand-50/60 font-medium'}`}
                  onClick={() => { setOpen(false); if (n.itemId) navigate(`/items/${n.itemId}`); }}
                >
                  {n.message}
                  <span className="mt-0.5 block text-xs font-normal text-slate-400">{fmtDateTime(n.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
          <Link to="/notifications" onClick={() => setOpen(false)} className="block border-t border-slate-100 px-4 py-2 text-center text-sm font-medium text-brand-700 hover:bg-slate-50">
            View all
          </Link>
        </div>
      )}
    </div>
  );
}
