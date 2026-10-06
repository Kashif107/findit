import { Link } from 'react-router-dom';
import useNotifications from '../hooks/useNotifications.js';
import Loader from '../components/Loader.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { fmtDateTime } from '../constants.js';

const ICON = { 'new-match': '🎯', 'claim-update': '🤝', reminder: '⏰', system: 'ℹ️' };

export default function Notifications() {
  const { items, unread, loading, markAllRead } = useNotifications();
  if (loading) return <Loader />;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Notifications</h1>
        {unread > 0 && <button className="btn-ghost" onClick={markAllRead}>Mark all read ({unread})</button>}
      </div>
      {items.length === 0 ? <EmptyState icon="🔔" title="No notifications yet" hint="You'll hear from us when a post matches or someone claims your item." /> : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {items.map((n) => (
            <li key={n._id} className={`flex gap-3 p-4 ${n.read ? '' : 'bg-brand-50/60'}`}>
              <span className="text-xl" aria-hidden>{ICON[n.type] || '🔔'}</span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${n.read ? 'text-slate-600' : 'font-medium'}`}>{n.message}</p>
                <p className="mt-0.5 text-xs text-slate-400">{fmtDateTime(n.createdAt)}</p>
              </div>
              {n.itemId && <Link to={`/items/${n.itemId}`} className="self-center text-sm font-medium text-brand-700 hover:underline">Open</Link>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
