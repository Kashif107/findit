import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { errMsg } from '../api.js';
import { CATEGORIES } from '../constants.js';

const today = () => new Date().toISOString().slice(0, 10);

export default function PostItem() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    type: 'lost', title: '', description: '', category: 'phone', location: '',
    dateOccurred: today(), timeOccurred: '', secretQuestion: '', secretDetail: ''
  });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const found = form.type === 'found';

  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pickFile(e) {
    const f = e.target.files?.[0];
    if (!f) return setFile(null);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) { toast.error('Please choose a jpeg, png or webp image.'); e.target.value = ''; return; }
    if (f.size > 5 * 1024 * 1024) { toast.error('Image must be 5 MB or smaller.'); e.target.value = ''; return; }
    setFile(f);
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = new FormData(); // no manual Content-Type: the browser sets the multipart boundary
      Object.entries(form).forEach(([k, v]) => {
        if (v === '' || (!found && k.startsWith('secret'))) return;
        body.append(k, v);
      });
      if (file) body.append('image', file);
      const { data } = await api.post('/items', body);
      toast.success('Posted! We\'re looking for matches now.');
      navigate(`/items/${data.item._id}`);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="panel mx-auto max-w-2xl space-y-5">
      <h1 className="text-xl font-bold">Post an item</h1>

      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Post type">
        {['lost', 'found'].map((t) => (
          <button type="button" key={t} role="radio" aria-checked={form.type === t} onClick={() => setForm((f) => ({ ...f, type: t }))}
            className={`rounded-lg border px-4 py-3 text-sm font-semibold ${form.type === t ? (t === 'lost' ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-emerald-500 bg-emerald-50 text-emerald-700') : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
            {t === 'lost' ? 'I lost something' : 'I found something'}
          </button>
        ))}
      </div>

      <div><label className="label" htmlFor="title">Title</label><input id="title" className="input" value={form.title} onChange={set('title')} required minLength={3} maxLength={120} placeholder="e.g. Black iPhone 13 with clear case" /></div>
      <div>
        <label className="label" htmlFor="desc">Description</label>
        <textarea id="desc" className="input min-h-28" value={form.description} onChange={set('description')} required minLength={5} maxLength={2000} placeholder="Colour, brand, marks, what was inside. More detail means better matches." />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="cat">Category</label>
          <select id="cat" className="input" value={form.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
        <div><label className="label" htmlFor="loc">Where</label><input id="loc" className="input" value={form.location} onChange={set('location')} required maxLength={200} placeholder="Building or area" /></div>
        <div><label className="label" htmlFor="date">Date {found ? 'found' : 'lost'}</label><input id="date" type="date" max={today()} className="input" value={form.dateOccurred} onChange={set('dateOccurred')} required /></div>
        <div><label className="label" htmlFor="time">Time <span className="font-normal text-slate-400">(optional)</span></label><input id="time" type="time" className="input" value={form.timeOccurred} onChange={set('timeOccurred')} /></div>
      </div>

      <div>
        <label className="label" htmlFor="image">Photo <span className="font-normal text-slate-400">(optional, jpeg/png/webp, max 5 MB)</span></label>
        <input id="image" type="file" accept="image/jpeg,image/png,image/webp" onChange={pickFile} className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:font-semibold file:text-brand-700" />
        {preview && <img src={preview} alt="Preview" className="mt-3 h-40 rounded-lg object-cover" />}
      </div>

      {found && (
        <fieldset className="space-y-4 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
          <legend className="px-1 text-sm font-semibold text-emerald-800">Verify the real owner</legend>
          <p className="text-sm text-slate-600">Ask something only the owner would know. Owners must answer before they see your contact details. The answer is never shown to anyone.</p>
          <div><label className="label" htmlFor="sq">Question</label><input id="sq" className="input" value={form.secretQuestion} onChange={set('secretQuestion')} required maxLength={200} placeholder="e.g. What is the lock screen wallpaper?" /></div>
          <div><label className="label" htmlFor="sd">Correct answer</label><input id="sd" className="input" value={form.secretDetail} onChange={set('secretDetail')} required maxLength={200} placeholder="e.g. golden retriever puppy" /></div>
        </fieldset>
      )}

      <button className="btn-primary w-full" disabled={busy}>{busy ? 'Posting…' : 'Post item'}</button>
    </form>
  );
}
