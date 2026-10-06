import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { errMsg } from '../api.js';
import ItemCard, { StatusBadge } from '../components/ItemCard.jsx';
import Loader from '../components/Loader.jsx';
import EmptyState from '../components/EmptyState.jsx';

export default function MyPosts() {
  const [items, setItems] = useState(null);

  const load = () => api.get('/items/mine').then(({ data }) => setItems(data.items)).catch((e) => { toast.error(errMsg(e)); setItems([]); });
  useEffect(() => { load(); }, []);

  async function markReturned(id) {
    try { await api.patch(`/items/${id}/status`, { status: 'returned' }); toast.success('Marked as returned'); load(); }
    catch (e) { toast.error(errMsg(e)); }
  }
  async function remove(id) {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    try { await api.delete(`/items/${id}`); toast.success('Post deleted'); load(); }
    catch (e) { toast.error(errMsg(e)); }
  }

  if (!items) return <Loader />;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-extrabold">My posts</h1><Link to="/post" className="btn-primary">Post an item</Link></div>
      {items.length === 0 ? (
        <EmptyState icon="📝" title="You haven't posted anything" hint="Lost or found something on campus? Post it and we'll look for matches." action={<Link to="/post" className="btn-primary">Post an item</Link>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <ItemCard key={item._id} item={item} footer={
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <StatusBadge status={item.status} />
                  <span className="text-slate-500">{item.matchCount} match{item.matchCount === 1 ? '' : 'es'}</span>
                  {item.embeddingStatus !== 'done' && <span className="text-xs text-amber-600">{item.embeddingStatus === 'failed' ? 'retrying…' : 'analysing…'}</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link to={`/items/${item._id}`} className="btn-ghost px-3 py-1.5">View</Link>
                  {['open', 'claimed'].includes(item.status) && <button className="btn-ghost px-3 py-1.5" onClick={() => markReturned(item._id)}>Mark returned</button>}
                  <button className="btn-ghost px-3 py-1.5 text-rose-600" onClick={() => remove(item._id)}>Delete</button>
                </div>
              </div>
            } />
          ))}
        </div>
      )}
    </div>
  );
}
