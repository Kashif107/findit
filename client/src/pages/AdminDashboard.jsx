import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { errMsg } from '../api.js';
import Loader from '../components/Loader.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { TypeBadge, StatusBadge } from '../components/ItemCard.jsx';
import { fmtDate } from '../constants.js';

const Stat = ({ label, value, hint }) => (
  <div className="panel"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-3xl font-extrabold tabular-nums">{value}</p>{hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}</div>
);

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [list, setList] = useState(null);
  const [page, setPage] = useState(1);

  const loadList = useCallback(() => api.get('/admin/items', { params: { page } }).then(({ data }) => setList(data)).catch((e) => toast.error(errMsg(e))), [page]);
  useEffect(() => { api.get('/admin/stats').then(({ data }) => setStats(data)).catch((e) => toast.error(errMsg(e))); }, []);
  useEffect(() => { loadList(); }, [loadList]);

  async function remove(id) {
    if (!window.confirm('Delete this post for everyone?')) return;
    try { await api.delete(`/admin/items/${id}`); toast.success('Post deleted'); loadList(); } catch (e) { toast.error(errMsg(e)); }
  }
  async function ban(user, banned) {
    if (!window.confirm(`${banned ? 'Ban' : 'Unban'} ${user.name}?`)) return;
    try { await api.patch(`/admin/users/${user._id}/ban`, { banned }); toast.success(banned ? 'User banned' : 'User unbanned'); loadList(); } catch (e) { toast.error(errMsg(e)); }
  }

  if (!stats || !list) return <Loader />;
  const max = Math.max(1, ...stats.postsPerDay.map((d) => d.count));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold">Admin dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total posts" value={stats.totalPosts} />
        <Stat label="Returned" value={stats.returnedCount} />
        <Stat label="Match success rate" value={`${Math.round(stats.matchSuccessRate * 100)}%`} hint={`Of ${stats.matchedPosts} posts that got a suggestion, the share claimed or returned`} />
      </div>

      <section className="panel">
        <h2 className="mb-3 font-bold">Posts per day, last 30 days</h2>
        <div className="flex h-32 items-end gap-1" role="img" aria-label="Bar chart of posts per day">
          {stats.postsPerDay.map((d) => (
            <div key={d.date} className="group relative flex-1" title={`${d.date}: ${d.count}`}>
              <div className="w-full rounded-t bg-brand-500 transition group-hover:bg-brand-700" style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count ? 4 : 1 }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-xs text-slate-400"><span>{stats.postsPerDay[0].date}</span><span>{stats.postsPerDay[29].date}</span></div>
      </section>

      <section className="space-y-3">
        <h2 className="font-bold">All posts</h2>
        {list.items.length === 0 ? <EmptyState title="No posts" /> : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">Post</th><th className="p-3">Status</th><th className="p-3">Posted by</th><th className="p-3">Date</th><th className="p-3" /></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {list.items.map((i) => (
                  <tr key={i._id}>
                    <td className="p-3"><div className="flex items-center gap-2"><TypeBadge type={i.type} /><Link className="font-medium hover:underline" to={`/items/${i._id}`}>{i.title}</Link></div></td>
                    <td className="p-3"><StatusBadge status={i.status} /></td>
                    <td className="p-3">{i.postedBy?.name}{i.postedBy?.isBanned && <span className="badge ml-2 bg-rose-100 text-rose-700">banned</span>}</td>
                    <td className="p-3 text-slate-500">{fmtDate(i.createdAt)}</td>
                    <td className="space-x-2 p-3 text-right">
                      {i.postedBy && i.postedBy.role !== 'admin' && <button className="btn-ghost px-3 py-1.5" onClick={() => ban(i.postedBy, !i.postedBy.isBanned)}>{i.postedBy.isBanned ? 'Unban' : 'Ban user'}</button>}
                      <button className="btn-danger px-3 py-1.5" onClick={() => remove(i._id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {list.pages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <span className="text-sm text-slate-500">Page {page} of {list.pages}</span>
            <button className="btn-ghost" disabled={page >= list.pages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        )}
      </section>
    </div>
  );
}
