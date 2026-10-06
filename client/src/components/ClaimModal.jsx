import { useState } from 'react';
import toast from 'react-hot-toast';
import api, { errMsg } from '../api.js';

export default function ClaimModal({ item, onClose, onDone }) {
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [contact, setContact] = useState(null);
  const [note, setNote] = useState('');

  const close = () => { if (contact) onDone?.(); onClose(); };

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post(`/items/${item._id}/claim`, { answer });
      setContact(data.contact);
      toast.success('Ownership verified!');
    } catch (err) {
      const status = err.response?.status;
      if (status === 409) { toast.error('Someone else has already claimed this item.'); onDone?.(); onClose(); return; }
      if (status === 429) { setNote(errMsg(err)); toast.error('Too many wrong attempts. Please wait before trying again.'); }
      else { setNote(errMsg(err)); toast.error(errMsg(err)); }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Claim item">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        {contact ? (
          <>
            <h2 className="text-lg font-bold">You're verified 🎉</h2>
            <p className="mt-1 text-sm text-slate-600">Contact the finder to arrange the handover:</p>
            <dl className="mt-4 space-y-1 rounded-lg bg-brand-50 p-4 text-sm">
              <div><dt className="inline font-semibold">Name: </dt><dd className="inline">{contact.name}</dd></div>
              <div><dt className="inline font-semibold">Email: </dt><dd className="inline"><a className="text-brand-700 underline" href={`mailto:${contact.email}`}>{contact.email}</a></dd></div>
              {contact.phone && <div><dt className="inline font-semibold">Phone: </dt><dd className="inline">{contact.phone}</dd></div>}
            </dl>
            <button className="btn-primary mt-5 w-full" onClick={close}>Done</button>
          </>
        ) : (
          <form onSubmit={submit}>
            <h2 className="text-lg font-bold">Claim “{item.title}”</h2>
            <p className="mt-1 text-sm text-slate-600">Answer the finder's question to prove this is yours. You get 3 wrong attempts before a 1 hour lockout.</p>
            <p className="mt-4 rounded-lg bg-slate-100 p-3 text-sm font-medium">{item.secretQuestion || 'Describe a detail only the owner would know.'}</p>
            <label className="label mt-4" htmlFor="answer">Your answer</label>
            <input id="answer" className="input" value={answer} onChange={(e) => setAnswer(e.target.value)} maxLength={200} autoFocus required />
            {note && <p className="mt-2 text-sm text-rose-600" role="alert">{note}</p>}
            <div className="mt-5 flex gap-2">
              <button type="button" className="btn-ghost flex-1" onClick={close}>Cancel</button>
              <button className="btn-primary flex-1" disabled={busy || !answer.trim()}>{busy ? 'Checking…' : 'Submit claim'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
