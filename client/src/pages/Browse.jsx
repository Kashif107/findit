import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { errMsg } from '../api.js';
import ItemCard from '../components/ItemCard.jsx';
import Loader from '../components/Loader.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { CATEGORIES } from '../constants.js';

const EMPTY = { q: '', type: '', category: '', from: '', to: '' };

export default function Browse() {
  const [filters, setFilters] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const set = (k) => (e) => { setFilters((f) => ({ ...f, [k]: e.target.value })); setPage(1); };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => { // debounce typing
      try {
        const params = Object.fromEntries(Object.entries({ ...filters, page, limit: 12 }).filter(([, v]) => v !== ''));
        const { data } = await api.get('/items', { params });
        if (!cancelled) setData(data);
      } catch (err) {
        if (!cancelled) toast.error(errMsg(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [filters, page]);

  const filtered = Object.values(filters).some(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Lost something? Found something?</h1>
          <p className="text-slate-500">Post it once. We compare it with everything else on campus and tell you about likely matches.</p>
        </div>
        <Link to="/post" className="btn-primary">Post an item</Link>
      </div>

      <div className="panel grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <input className="input lg:col-span-2" placeholder="Search title, description or place" aria-label="Search" value={filters.q} onChange={set('q')} />
        <select className="input" aria-label="Type" value={filters.type} onChange={set('type')}>
          <option value="">Lost &amp; found</option><option value="lost">Lost</option><option value="found">Found</option>
        </select>
        <select className="input" aria-label="Category" value={filters.category} onChange={set('category')}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <input type="date" className="input" aria-label="From date" value={filters.from} onChange={set('from')} />
          <span className="text-slate-400">–</span>
          <input type="date" className="input" aria-label="To date" value={filters.to} onChange={set('to')} />
        </div>
        {filtered && <button className="btn-ghost sm:col-span-2 lg:col-span-5 lg:justify-self-start" onClick={() => { setFilters(EMPTY); setPage(1); }}>Clear filters</button>}
      </div>

      {loading ? <Loader /> : data.items.length === 0 ? (
        <EmptyState title={filtered ? 'Nothing matches those filters' : 'No posts yet'} hint={filtered ? 'Try a broader search or clear the filters.' : 'Be the first to post a lost or found item.'}
          action={<Link to="/post" className="btn-primary">Post an item</Link>} />
      ) : (
        <>
          <p className="text-sm text-slate-500">{data.total} open post{data.total === 1 ? '' : 's'}</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.items.map((item) => <ItemCard key={item._id} item={item} />)}
          </div>
          {data.pages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <span className="text-sm text-slate-500">Page {page} of {data.pages}</span>
              <button className="btn-ghost" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
