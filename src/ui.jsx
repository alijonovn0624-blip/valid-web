import { useEffect, useRef, useState } from 'react';
import { API } from './api';
import { t, locale } from './i18n.js';

// Local calendar date as YYYY-MM-DD (never UTC-shifted)
export const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const parseIso = (s) => new Date(s + 'T00:00:00');
export const dayLabel = (s) => {
  const d = parseIso(s);
  return [d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' }), d.toLocaleDateString(locale(), { weekday: 'short' })];
};
export const longDay = (s) => { const [a, b] = dayLabel(s); return `${b}, ${a}`; };
export const daysBetween = (a, b) => Math.round((parseIso(a) - parseIso(b)) / 86400000);
export const relName = (s, today = iso(new Date())) => {
  const n = daysBetween(today, s);
  return n === 0 ? t('today') : n === 1 ? t('yesterday') : n === 2 ? t('daysAgo2') : n === 3 ? t('daysAgo3') : `${n} ${t('daysAgoN')}`;
};
export const addDays = (s, n) => { const d = parseIso(s); d.setDate(d.getDate() + n); return iso(d); };

export const Ava = ({ u, size = 34 }) =>
  u.avatar_url
    ? <img className="dava" style={{ width: size, height: size }} src={API + u.avatar_url} alt="" />
    : <span className="dava ph" style={{ width: size, height: size }}>{(u.full_name || '?')[0]}</span>;

export function Stat({ icon, tint, label, value, sub, onClick, active }) {
  const inner = (
    <>
      <div className="dico" style={{ background: tint }}>{icon}</div>
      <small>{label}</small><b>{value}</b>{sub && <em>{sub}</em>}
    </>
  );
  return onClick
    ? <button type="button" className={'dstat click' + (active ? ' on' : '')} onClick={onClick}>{inner}</button>
    : <div className="dstat">{inner}</div>;
}

export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const id = setTimeout(() => setV(value), ms); return () => clearTimeout(id); }, [value, ms]);
  return v;
}

export const STATUS_KEY = { present: 'statPresent', late: 'statLate', absent: 'statAbsent', excused: 'statExcused', unmarked: 'statUnmarked' };
export const StatusPill = ({ s }) => <span className={'spill ' + s}>{t(STATUS_KEY[s] || s)}</span>;
export const ApprovalPill = ({ s }) => <span className={'spill ap-' + s}>{t('ap_' + s)}</span>;
export const rateText = (r) => (r === null || r === undefined ? '–' : r + '%');

/* Radar / spider-web chart. Each axis = a date or week; value = attendance %.
   Periods with no attendance records (value === null) are NOT plotted as 0% or 100%: they are marked "no record". */
export function RadarChart({ points, onSelect, selected }) {
  const size = 360, c = size / 2, R = 108, n = points.length;
  if (n < 3) return <p className="muted">{t('radarNeed3')}</p>;
  const ang = (i) => -Math.PI / 2 + (2 * Math.PI * i) / n;
  const pt = (i, v) => [c + Math.cos(ang(i)) * R * v, c + Math.sin(ang(i)) * R * v];
  const ring = (v) => points.map((_, i) => pt(i, v).join(',')).join(' ');
  const have = points.map((p, i) => ({ ...p, i })).filter((p) => p.rate !== null);
  const poly = have.map((p) => pt(p.i, p.rate / 100).join(',')).join(' ');
  const small = n > 14;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="radar" role="img" aria-label={t('attRate')}>
      {[0.25, 0.5, 0.75, 1].map((v) => <polygon key={v} points={ring(v)} fill="none" stroke="var(--d-line)" />)}
      {[0.25, 0.5, 0.75, 1].map((v) => <text key={'t' + v} x={c + 3} y={c - R * v + 3} fontSize="8" fill="var(--d-muted)">{v * 100}</text>)}
      {points.map((_, i) => { const [x, y] = pt(i, 1); return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="var(--d-line)" />; })}
      {have.length >= 2 && <polygon points={poly} fill="#2d6bff44" stroke="#2d6bff" strokeWidth="2" strokeLinejoin="round" />}
      {points.map((p, i) => {
        const [lx, ly] = pt(i, 1.16);
        const [x, y] = p.rate === null ? [c, c] : pt(i, p.rate / 100);
        const sel = selected === p.key;
        return (
          <g key={p.key}>
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize={small ? 7.5 : 10} fill={p.rate === null ? 'var(--d-muted)' : 'var(--d-text)'} fontWeight={sel ? 700 : 400}>{p.short}</text>
            {p.rate !== null && <circle cx={x} cy={y} r={sel ? 5.5 : 3.5} fill="#2d6bff" stroke="#fff" strokeWidth="1" />}
            {p.rate !== null && <circle cx={x} cy={y} r="11" fill="transparent" style={{ cursor: 'pointer' }}
              onMouseEnter={() => onSelect(p.key)} onClick={() => onSelect(p.key)}><title>{p.short}: {p.rate}%</title></circle>}
          </g>
        );
      })}
    </svg>
  );
}

// Decorate API analytics points with a short axis label
export function withLabels(points, bucket) {
  return points.map((p) => {
    const [a] = dayLabel(p.key);
    return { ...p, short: bucket === 'week' ? `${t('wk')} ${a}` : a };
  });
}

export function CountdownText({ seconds }) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0'), s = String(seconds % 60).padStart(2, '0');
  return <>{m}:{s}</>;
}

// Counts down once per second without re-rendering the page; based on a target time so it stays accurate in background tabs.
export function useCountdown() {
  const [left, setLeft] = useState(0);
  const endRef = useRef(0);
  const start = (sec) => { endRef.current = Date.now() + sec * 1000; setLeft(Math.max(0, Math.ceil(sec))); };
  useEffect(() => {
    if (left <= 0) return;
    const id = setInterval(() => {
      const r = Math.max(0, Math.ceil((endRef.current - Date.now()) / 1000));
      setLeft(r);
      if (r <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [left > 0]);
  return [left, start];
}

/* Bar chart: one bar per date/week, height = attendance %. Periods with no records (rate === null) get no bar, only a "–" marker. */
export function BarChart({ points, onSelect, selected }) {
  const n = points.length;
  if (!n) return <p className="muted">{t('noRecord')}</p>;
  // Ustun kengligi ma'lumot soniga moslanadi: diagramma doim keng, markazda va bo'sh joy qoldirmaydi
  const colW = Math.min(96, Math.max(44, Math.floor(780 / n)));
  const padL = 44, padT = 22, padB = 44, H = 400, padR = 12;
  const W = padL + n * colW + padR, ph = H - padT - padB;
  const y = (v) => padT + ph - (ph * v) / 100;
  const fs = colW >= 60 ? 13 : 11;
  return (
    <div className="barwrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="barsvg" style={{ minWidth: Math.min(W, n * 34 + 60), maxWidth: Math.max(W, 900) }} role="img" aria-label={t('attRate')}>
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="var(--d-line)" />
            <text x={padL - 8} y={y(v) + 4} textAnchor="end" fontSize="12" fill="var(--d-muted)">{v}%</text>
          </g>
        ))}
        {points.map((p, i) => {
          const x = padL + i * colW + colW * 0.16, w = colW * 0.68, sel = selected === p.key;
          return (
            <g key={p.key} style={{ cursor: p.rate === null ? 'default' : 'pointer' }} onMouseEnter={() => p.rate !== null && onSelect(p.key)} onClick={() => p.rate !== null && onSelect(p.key)}>
              {p.rate !== null
                ? <rect x={x} y={y(p.rate)} width={w} height={Math.max(3, y(0) - y(p.rate))} rx="5" fill={trendColor(p.rate)} stroke={sel ? 'var(--d-text)' : 'none'} strokeWidth="2"><title>{p.short}: {p.rate}%</title></rect>
                : <text x={x + w / 2} y={y(0) - 6} textAnchor="middle" fontSize="14" fill="var(--d-muted)">–</text>}
              {p.rate !== null && <text x={x + w / 2} y={y(p.rate) - 6} textAnchor="middle" fontSize={fs} fontWeight="600" fill="var(--d-text)">{p.rate}%</text>}
              <text x={x + w / 2} y={H - 20} textAnchor="middle" fontSize={fs} fill={p.rate === null ? 'var(--d-muted)' : 'var(--d-text)'} fontWeight={sel ? 700 : 400}>{p.short}</text>
              <rect x={x - 4} y={padT} width={w + 8} height={ph + 26} fill="transparent" />
            </g>
          );
        })}
      </svg>
      <TrendLegend />
    </div>
  );
}

// Attendance trend colour: 0% red -> 50% yellow -> 100% blue (continuous, follows the real value)
export function trendColor(v) {
  const lerp = (a, b, k) => a.map((x, i) => Math.round(x + (b[i] - x) * k));
  const R = [239, 68, 68], Y = [250, 204, 21], B = [59, 130, 246];
  const c = v <= 50 ? lerp(R, Y, Math.max(0, v) / 50) : lerp(Y, B, (Math.min(100, v) - 50) / 50);
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
export function TrendLegend() {
  return (
    <div className="trendlegend" aria-hidden="true">
      <span>0%</span><i /><span>50%</span><i className="b" /><span>100%</span>
    </div>
  );
}


// Phone card layout for tables (table.dt): every cell gets the text of its column header as data-label (CSS shows it with ::before).
export function installTableLabels() {
  let queued = false;
  const apply = () => {
    queued = false;
    document.querySelectorAll('table.dt').forEach((tb) => {
      const heads = [...tb.querySelectorAll('thead th')].map((h) => h.textContent.trim());
      tb.querySelectorAll('tbody tr').forEach((tr) => [...tr.children].forEach((td, i) => {
        if (td.tagName === 'TD' && td.getAttribute('data-label') !== (heads[i] || '')) td.setAttribute('data-label', heads[i] || '');
      }));
    });
  };
  new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(apply); } }).observe(document.body, { childList: true, subtree: true });
  apply();
}
