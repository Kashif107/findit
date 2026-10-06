import { Link } from 'react-router-dom';
import { catInfo, fmtDate } from '../constants.js';

export const TypeBadge = ({ type }) => (
  <span className={`badge ${type === 'lost' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
    {type === 'lost' ? 'Lost' : 'Found'}
  </span>
);

const STATUS_STYLE = {
  open: 'bg-sky-100 text-sky-700', claimed: 'bg-amber-100 text-amber-700',
  returned: 'bg-slate-200 text-slate-700', expired: 'bg-slate-200 text-slate-500'
};
export const StatusBadge = ({ status }) => (
  <span className={`badge capitalize ${STATUS_STYLE[status] || ''}`}>{status}</span>
);

export default function ItemCard({ item, footer }) {
  const cat = catInfo(item.category);
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <Link to={`/items/${item._id}`} className="block">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.title} loading="lazy" className="h-40 w-full object-cover" />
        ) : (
          <div className="flex h-40 items-center justify-center bg-brand-50 text-5xl" aria-hidden>{cat.icon}</div>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <TypeBadge type={item.type} />
          {item.status !== 'open' && <StatusBadge status={item.status} />}
        </div>
        <Link to={`/items/${item._id}`} className="line-clamp-2 font-semibold hover:text-brand-700">{item.title}</Link>
        <p className="text-sm text-slate-500">📍 {item.location}</p>
        <p className="text-sm text-slate-500">🗓 {fmtDate(item.dateOccurred)} · {cat.label}</p>
        {footer && <div className="mt-auto pt-2">{footer}</div>}
      </div>
    </article>
  );
}
