export const CATEGORIES = [
  { value: 'phone', label: 'Phone', icon: '📱' },
  { value: 'wallet', label: 'Wallet', icon: '👛' },
  { value: 'keys', label: 'Keys', icon: '🔑' },
  { value: 'bag', label: 'Bag', icon: '🎒' },
  { value: 'laptop', label: 'Laptop', icon: '💻' },
  { value: 'id_card', label: 'ID card', icon: '🪪' },
  { value: 'bottle', label: 'Bottle', icon: '🧴' },
  { value: 'clothing', label: 'Clothing', icon: '🧥' },
  { value: 'other', label: 'Other', icon: '📦' }
];
export const catInfo = (v) => CATEGORIES.find((c) => c.value === v) || CATEGORIES[CATEGORIES.length - 1];
export const fmtDate = (d) =>
  new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const fmtDateTime = (d) =>
  new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
