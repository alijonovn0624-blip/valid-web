import { useEffect, useRef, useState } from 'react';
import { locale } from './i18n.js';

// The lesson time zone: all schedule times are Tashkent time (the server uses the same zone).
export const LESSON_TZ = 'Asia/Tashkent';

/** Ticks every second; `now()` is the SERVER's clock (so a wrong clock on the student's phone cannot open a unit early). */
export function useClock(serverNowIso) {
  const skew = useRef(0);
  const [, setTick] = useState(0);
  if (serverNowIso) skew.current = Date.parse(serverNowIso) - Date.now();
  useEffect(() => { const id = setInterval(() => setTick((n) => n + 1), 1000); return () => clearInterval(id); }, []);
  return () => Date.now() + skew.current;
}

const p2 = (n) => String(n).padStart(2, '0');
/** 93784000 -> "1d 02h 03m"; under one day -> "02:03:04" */
export function fmtCountdown(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return d > 0 ? `${d}d ${p2(h)}h ${p2(m)}m` : `${p2(h)}:${p2(m)}:${p2(x)}`;
}
/** "Wed, 25 Nov, 20:00" in lesson time */
export function fmtWhen(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(locale(), { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: LESSON_TZ });
}
export const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: LESSON_TZ }) : '');

/** Share of the lesson that is still left (1 -> 0), used for the red bar that drains while the lesson runs. */
export function lessonLeft(item, now) {
  const a = Date.parse(item.lesson_start), b = Date.parse(item.lesson_end);
  if (!a || !b || b <= a) return 0;
  return Math.min(1, Math.max(0, (b - now) / (b - a)));
}

export const UNIT_COUNT = 12;
export const LESSONS_PER_UNIT = 3;
/** [unit, lesson] of a homework: the numbers saved by the admin, else parsed from the old free-text "3.3" */
export function slotOf(h) {
  if (h.unit_no && h.lesson_no) return [h.unit_no, h.lesson_no];
  const m = String(h.unit || '').match(/(\d{1,2})\.(\d)/);
  if (m && +m[1] >= 1 && +m[1] <= UNIT_COUNT && +m[2] >= 1 && +m[2] <= LESSONS_PER_UNIT) return [+m[1], +m[2]];
  return null;
}
export const hasContent = (h) => h && (h.exercise_count > 0 || h.word_count > 0 || h.has_video);

/** The fixed course map: Unit 1..12, three lessons each, then the Final Exam. Missing lessons show as "not published yet". */
export function buildCourse(list) {
  const by = new Map(); const extra = [];
  (list || []).filter(hasContent).forEach((h) => { const s = slotOf(h); if (s && !by.has(s.join('.'))) by.set(s.join('.'), h); else extra.push(h); });
  const groups = [];
  if (extra.length) groups.push({ k: 0, items: extra.sort((a, b) => (a.due_date < b.due_date ? -1 : 1)).map((h) => ({ key: 'x' + h.id, label: h.unit || '•', h, kind: 'hw' })) });
  for (let u = 1; u <= UNIT_COUNT; u++) {
    const items = [];
    for (let l = 1; l <= LESSONS_PER_UNIT; l++) { const key = u + '.' + l; const h = by.get(key) || null; items.push({ key, label: key, h, kind: h ? 'hw' : 'empty' }); }
    groups.push({ k: u, items });
  }
  groups.push({ k: 'final', items: [{ key: 'final', label: '', h: null, kind: 'exam' }] });
  let i = 0; groups.forEach((g) => g.items.forEach((it) => { it.i = i++; }));
  return groups;
}
