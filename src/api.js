export const API = import.meta.env.VITE_API || 'http://localhost:4000';
export const getToken = () => localStorage.getItem('token');

export async function api(path, opts = {}) {
  const isForm = opts.body instanceof FormData;
  const res = await fetch(API + path, {
    ...opts,
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {}),
    },
    body: opts.body && !isForm ? JSON.stringify(opts.body) : opts.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(typeof data.error === 'string' ? data.error : 'Xatolik yuz berdi');
    err.code = data.code;
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
