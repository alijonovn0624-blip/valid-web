import { useEffect, useRef, useState } from 'react';
import { api, API } from './api.js';
import { t, apiError } from './i18n.js';
import { Icon } from './icons.jsx';

export const media = (u) => (!u ? '' : u.startsWith('http') ? u : API + u);
export const POS = ['noun', 'verb', 'adjective', 'adverb', 'phrasal verb', 'phrase', 'preposition', 'pronoun', 'conjunction', 'interjection'];
const POS_SHORT = { noun: 'n.', verb: 'v.', adjective: 'adj.', adverb: 'adv.', 'phrasal verb': 'phr. v.', phrase: 'phr.', preposition: 'prep.', pronoun: 'pron.', conjunction: 'conj.', interjection: 'interj.' };

/* word type badge: noun / verb / adjective / adverb ... */
export function PosTag({ pos, full }) {
  if (!pos) return null;
  const k = pos.split(' ')[0];
  return <small className={'pos pos-' + k} title={pos}>{full ? pos : (POS_SHORT[pos] || pos)}</small>;
}

/* one illustration, always in the same square tile (same size, same background); default placeholder when there is none */
export function WordImg({ url, provider, size = 64, word = '' }) {
  const [bad, setBad] = useState(false);
  useEffect(() => { setBad(false); }, [url]);
  const ok = url && !bad;
  return (
    <span className={'wtile' + (ok && !provider ? ' photo' : '')} style={{ width: size, height: size }}>
      {ok ? <img src={media(url)} alt={word} loading="lazy" onError={() => setBad(true)} /> : <span className="wtile-ph" aria-hidden="true"><Icon name="image" size={Math.round(size * 0.42)} /></span>}
    </span>
  );
}

/* small attribution line (OpenMoji licence: CC BY-SA 4.0) */
export function IconCredits({ className = '' }) {
  return (
    <span className={'iconcredits ' + className}>
      {t('icIllustrations')}: <a href="https://openmoji.org" target="_blank" rel="noopener noreferrer">OpenMoji</a> (<a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>)
      {' · '}<a href="https://iconify.design" target="_blank" rel="noopener noreferrer">Iconify</a> (Fluent Emoji, Noto, Twemoji)
    </span>
  );
}

/*
  Admin tool used inside every vocabulary word editor.
  value = { imageUrl, imageCredit, imageProvider, imageRef, pos }   onChange(patch)
  - typing the English word searches OpenMoji + Iconify by meaning and shows the best match at once
  - nothing suitable -> no picture is selected, alternative suggestions are shown instead
  - the admin can search by hand, pick any suggestion (SVG or PNG), upload an own picture or remove it
*/
export function WordPicture({ word, value, onChange, onUpload, busy: parentBusy }) {
  const [sugg, setSugg] = useState([]); const [state, setState] = useState(''); // '' | loading | auto | none | error
  const [q, setQ] = useState(''); const [fmt, setFmt] = useState('svg'); const [err, setErr] = useState(''); const [wait, setWait] = useState(false);
  const seq = useRef(0); const manual = useRef(false); const last = useRef(String(word || '').trim().toLowerCase()); const valRef = useRef(value);
  valRef.current = value;

  const run = async (w, mq) => {
    const my = ++seq.current; setState('loading'); setErr('');
    try {
      const r = await api('/api/icons/search?' + (mq ? 'q=' + encodeURIComponent(mq) : 'word=' + encodeURIComponent(w)));
      if (my !== seq.current) return;
      setSugg(r.suggestions || []);
      if (!mq) {
        if (r.best && !manual.current) {
          const v = valRef.current || {};
          onChange({ imageUrl: r.best.url, imageCredit: r.best.credit, imageProvider: r.best.provider, imageRef: r.best.ref, ...(r.pos && !v.pos ? { pos: r.pos } : {}) });
          setState('auto');
        } else {
          if (r.pos && !(valRef.current || {}).pos) onChange({ pos: r.pos });
          setState(r.best ? 'auto' : 'none');
        }
      } else setState((r.suggestions || []).length ? 'manual' : 'none');
    } catch (e) { if (my === seq.current) { setState('error'); setErr(apiError(e)); } }
  };
  // typing a new word searches by itself (after a short pause)
  useEffect(() => {
    const w = String(word || '').trim();
    if (w.toLowerCase() === last.current) return;
    last.current = w.toLowerCase(); manual.current = false;
    if (w.length < 2) { setSugg([]); setState(''); return; }
    const h = setTimeout(() => run(w, ''), 700);
    return () => clearTimeout(h);
  }, [word]); // eslint-disable-line react-hooks/exhaustive-deps
  // opening an existing word: show alternatives without touching the saved picture
  useEffect(() => { const w = String(word || '').trim(); if (w.length >= 2) { manual.current = true; run(w, ''); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = async (c) => {
    manual.current = true; setWait(true); setErr('');
    try {
      const r = await api('/api/icons/pick', { method: 'POST', body: { provider: c.provider, ref: c.ref, format: fmt } });
      onChange({ imageUrl: r.url, imageCredit: r.credit, imageProvider: r.provider, imageRef: r.ref });
    } catch (e) { setErr(apiError(e)); }
    setWait(false);
  };
  const doUpload = async (file) => {
    if (!file || !onUpload) return; manual.current = true; setWait(true); setErr('');
    try { const url = await onUpload(file); onChange({ imageUrl: url, imageCredit: '', imageProvider: '', imageRef: '' }); } catch (e) { setErr(apiError(e)); }
    setWait(false);
  };
  const v = value || {};
  return (
    <div className="wpic">
      <div className="wpic-main">
        <WordImg url={v.imageUrl} provider={v.imageProvider} size={96} word={word} />
        <div className="wpic-side">
          <label className="wpic-pos">{t('icWordType')}
            <select value={v.pos || ''} onChange={(e) => onChange({ pos: e.target.value })}><option value="">–</option>{POS.map((p) => <option key={p} value={p}>{p}</option>)}</select>
          </label>
          <span className="wpic-btns">
            <label className="dbtn ghost small"><Icon name="image" size={14} /> {t('hwUpload')}<input type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(e) => { doUpload(e.target.files[0]); e.target.value = ''; }} /></label>
            {v.imageUrl && <button type="button" className="dbtn ghost small" onClick={() => { manual.current = true; onChange({ imageUrl: '', imageCredit: '', imageProvider: '', imageRef: '' }); }}>{t('remove')}</button>}
          </span>
          {v.imageCredit && <small className="muted">{v.imageCredit}</small>}
        </div>
      </div>
      <p className="muted small wpic-status">
        {state === 'loading' ? t('icSearching') : state === 'auto' ? t('icAuto') : state === 'none' ? t('icNone') : state === 'manual' ? t('icPick') : state === 'error' ? '' : ''}
      </p>
      <div className="wpic-search">
        <input type="text" value={q} placeholder={t('icSearchPh')} maxLength={60} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (q.trim()) run(word, q.trim()); } }} />
        <button type="button" className="dbtn ghost small" disabled={!q.trim() || state === 'loading'} onClick={() => run(word, q.trim())}><Icon name="find" size={14} /> {t('icSearch')}</button>
        <span className="wpic-fmt" role="group" aria-label="format">{['svg', 'png'].map((f) => <button type="button" key={f} className={fmt === f ? 'on' : ''} onClick={() => setFmt(f)}>{f.toUpperCase()}</button>)}</span>
      </div>
      {err && <div className="err">{err}</div>}
      {sugg.length > 0 && (
        <div className="wpic-grid">
          {sugg.map((c) => (
            <button type="button" key={c.provider + c.ref} className={'wpic-opt' + (v.imageRef === c.ref && v.imageProvider === c.provider ? ' on' : '')} disabled={wait || parentBusy} onClick={() => choose(c)} title={`${c.label} · ${c.provider}`}>
              <img src={c.thumb} alt={c.label} loading="lazy" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
              <small>{c.label}</small>
            </button>
          ))}
        </div>
      )}
      <IconCredits />
    </div>
  );
}
