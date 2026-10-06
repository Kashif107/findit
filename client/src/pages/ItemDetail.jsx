import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { errMsg } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import useMatches from '../hooks/useMatches.js';
import Loader from '../components/Loader.jsx';
import EmptyState from '../components/EmptyState.jsx';
import MatchList from '../components/MatchList.jsx';
import ClaimModal from '../components/ClaimModal.jsx';
import { TypeBadge, StatusBadge } from '../components/ItemCard.jsx';
import { CATEGORIES, catInfo, fmtDate } from '../constants.js';

export default function ItemDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    try { const { data } = await api.get(`/items/${id}`); setData(data); setNotFound(false); }
    catch (err) { if (err.response?.status === 404 || err.response?.status === 400) setNotFound(true); else toast.error(errMsg(err)); }
  }, [id]);
  useEffect(() => { setData(null); load(); }, [load]);

  const item = data?.item;
  const isOwner = Boolean(user && item && item.postedBy?._id === user.id);
  const matchState = useMatches(id, isOwner);

  if (notFound) return <EmptyState icon="🫥" title="Post not found" hint="It may have been deleted." action={<Link className="btn-primary" to="/">Back to browse</Link>} />;
  if (!item) return <Loader />;

  async function markReturned() {
    try { await api.patch(`/items/${id}/status`, { status: 'returned' }); toast.success('Marked as returned'); load(); }
    catch (e) { toast.error(errMsg(e)); }
  }
  async function remove() {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    try { await api.delete(`/items/${id}`); toast.success('Post deleted'); navigate('/mine'); }
    catch (e) { toast.error(errMsg(e)); }
  }

  const cat = catInfo(item.category);
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="panel grid gap-6 md:grid-cols-2">
        {item.imageUrl
          ? <img src={item.imageUrl} alt={item.title} className="max-h-96 w-full rounded-lg object-cover" />
          : <div className="flex h-64 items-center justify-center rounded-lg bg-brand-50 text-7xl" aria-hidden>{cat.icon}</div>}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2"><TypeBadge type={item.type} /><StatusBadge status={item.status} /></div>
          <h1 className="text-2xl font-extrabold tracking-tight">{item.title}</h1>
          <p className="whitespace-pre-line text-slate-700">{item.description}</p>
          <dl className="space-y-1 text-sm text-slate-600">
            <div>📍 {item.location}</div>
            <div>🗓 {fmtDate(item.dateOccurred)}{item.timeOccurred && ` at ${item.timeOccurred}`}</div>
            <div>{cat.icon} {cat.label}</div>
            <div>👤 Posted by {item.postedBy?.name || 'a student'}</div>
          </dl>

          {data.contact && (
            <div className="rounded-lg bg-brand-50 p-4 text-sm">
              <p className="font-semibold">{isOwner ? 'The verified owner' : 'Finder contact'}</p>
              <p>{data.contact.name}</p>
              <p><a className="text-brand-700 underline" href={`mailto:${data.contact.email}`}>{data.contact.email}</a></p>
              {data.contact.phone && <p>{data.contact.phone}</p>}
            </div>
          )}

          {!isOwner && item.type === 'found' && item.status === 'open' && (
            data.canClaim
              ? <button className="btn-primary" onClick={() => setClaiming(true)}>This is mine: verify ownership</button>
              : <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-600">
                  {user ? 'Only owners of a matching lost post can claim this item. Post what you lost and we\'ll check.' : <>Log in and post your lost item to claim this. <Link className="underline" to="/login">Log in</Link></>}
                </p>
          )}

          {isOwner && (
            <div className="flex flex-wrap gap-2 pt-2">
              {item.status === 'open' && <button className="btn-ghost" onClick={() => setEditing((e) => !e)}>{editing ? 'Cancel edit' : 'Edit'}</button>}
              {['open', 'claimed'].includes(item.status) && <button className="btn-ghost" onClick={markReturned}>Mark returned</button>}
              <button className="btn-ghost text-rose-600" onClick={remove}>Delete</button>
            </div>
          )}
        </div>
      </div>

      {isOwner && editing && <EditForm item={item} onSaved={() => { setEditing(false); load(); matchState.refresh(); }} />}
      {isOwner && <MatchList state={matchState} ownerType={item.type} onChanged={() => { load(); matchState.refresh(); }} />}
      {claiming && <ClaimModal item={item} onClose={() => setClaiming(false)} onDone={load} />}
    </div>
  );
}

function EditForm({ item, onSaved }) {
  const [form, setForm] = useState({
    title: item.title, description: item.description, category: item.category, location: item.location,
    dateOccurred: item.dateOccurred.slice(0, 10), secretQuestion: item.secretQuestion || '', secretDetail: ''
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { ...form };
      if (item.type !== 'found' || !body.secretDetail) delete body.secretDetail; // blank = keep current answer
      if (item.type !== 'found') delete body.secretQuestion;
      await api.patch(`/items/${item._id}`, body);
      toast.success('Post updated. Re-checking matches…');
      onSaved();
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="panel space-y-4">
      <h2 className="text-lg font-bold">Edit post</h2>
      <div><label className="label" htmlFor="e-title">Title</label><input id="e-title" className="input" value={form.title} onChange={set('title')} required minLength={3} /></div>
      <div><label className="label" htmlFor="e-desc">Description</label><textarea id="e-desc" className="input min-h-24" value={form.description} onChange={set('description')} required minLength={5} /></div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div><label className="label" htmlFor="e-cat">Category</label><select id="e-cat" className="input" value={form.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
        <div><label className="label" htmlFor="e-loc">Where</label><input id="e-loc" className="input" value={form.location} onChange={set('location')} required /></div>
        <div><label className="label" htmlFor="e-date">Date</label><input id="e-date" type="date" className="input" value={form.dateOccurred} onChange={set('dateOccurred')} required /></div>
      </div>
      {item.type === 'found' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="e-q">Secret question</label><input id="e-q" className="input" value={form.secretQuestion} onChange={set('secretQuestion')} /></div>
          <div><label className="label" htmlFor="e-a">New answer <span className="font-normal text-slate-400">(blank keeps current)</span></label><input id="e-a" className="input" value={form.secretDetail} onChange={set('secretDetail')} /></div>
        </div>
      )}
      <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
    </form>
  );
}
