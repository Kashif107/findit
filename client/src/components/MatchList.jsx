import { useState } from 'react';
import { Link } from 'react-router-dom';
import Loader from './Loader.jsx';
import EmptyState from './EmptyState.jsx';
import ClaimModal from './ClaimModal.jsx';
import { TypeBadge } from './ItemCard.jsx';
import { catInfo, fmtDate } from '../constants.js';

const pct = (n) => (n == null ? '–' : `${Math.max(0, Math.round(n * 100))}%`);

function ScoreBar({ score }) {
  const p = Math.max(0, Math.min(100, Math.round(score * 100)));
  const color = p >= 75 ? 'bg-emerald-500' : p >= 62 ? 'bg-amber-500' : 'bg-slate-400';
  return (
    <div className="flex items-center gap-2" title={`${p}% match`}>
      <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-200"><div className={`h-full ${color}`} style={{ width: `${p}%` }} /></div>
      <span className="text-sm font-bold tabular-nums">{p}%</span>
    </div>
  );
}

// `canClaim`: true when the viewer owns the lost post (they claim found items from here)
export default function MatchList({ state, ownerType, onChanged }) {
  const [claiming, setClaiming] = useState(null);
  const { loading, processed, embeddingStatus, matches, duplicates } = state;

  if (loading) return <Loader label="Loading matches…" />;

  return (
    <section aria-labelledby="matches-title" className="space-y-4">
      <h2 id="matches-title" className="text-lg font-bold">Possible matches</h2>

      {duplicates?.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
          ⚠️ This post looks very similar to {duplicates.length === 1 ? 'another post' : `${duplicates.length} other posts`}:{' '}
          {duplicates.map((d, i) => (
            <span key={d._id}>{i > 0 && ', '}<Link className="underline" to={`/items/${d._id}`}>{d.title}</Link></span>
          ))}
          . It was still published, but check you haven't posted it twice.
        </div>
      )}

      {!processed && embeddingStatus !== 'failed' && <Loader label="Analysing your post and looking for matches…" />}
      {embeddingStatus === 'failed' && (
        <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">Matching hit a problem. We'll retry automatically every few minutes.</p>
      )}
      {processed && matches.length === 0 && (
        <EmptyState icon="🕵️" title="No matches yet" hint="We'll notify you the moment a matching post appears." />
      )}

      <ul className="space-y-3">
        {matches.map((m) => {
          const other = m.item;
          const claimable = ownerType === 'lost' && other.type === 'found' && other.status === 'open';
          return (
            <li key={m._id} className="panel flex flex-col gap-3 sm:flex-row">
              <Link to={`/items/${other._id}`} className="shrink-0">
                {other.imageUrl
                  ? <img src={other.imageUrl} alt="" className="h-24 w-full rounded-lg object-cover sm:w-24" />
                  : <div className="flex h-24 w-full items-center justify-center rounded-lg bg-brand-50 text-3xl sm:w-24" aria-hidden>{catInfo(other.category).icon}</div>}
              </Link>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <TypeBadge type={other.type} />
                  <Link to={`/items/${other._id}`} className="truncate font-semibold hover:text-brand-700">{other.title}</Link>
                </div>
                <p className="text-sm text-slate-500">📍 {other.location} · 🗓 {fmtDate(other.dateOccurred)}</p>
                <ScoreBar score={m.score} />
                <p className="text-xs text-slate-500">
                  Text {pct(m.breakdown.text)} · Image {pct(m.breakdown.image)} · Category {pct(m.breakdown.category)} · Timing {pct(m.breakdown.time)}
                </p>
              </div>
              {claimable && <button className="btn-primary self-start sm:self-center" onClick={() => setClaiming(other)}>This is mine</button>}
            </li>
          );
        })}
      </ul>

      {claiming && <ClaimModal item={claiming} onClose={() => setClaiming(null)} onDone={onChanged} />}
    </section>
  );
}
