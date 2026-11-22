import { useEffect, useState } from 'react';
import { api, API } from './api.js';
import { t, apiError } from './i18n.js';
import { Icon } from './icons.jsx';

const media = (u) => (!u ? '' : u.startsWith('http') ? u : API + u);
const speak = (w, lang = 'en-US') => { try { const u = new SpeechSynthesisUtterance(w); u.lang = lang; u.rate = 0.9; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); } catch {} };
const tr = (w) => ((localStorage.getItem('lang') || 'en') === 'ru' ? (w.ru || w.uz) : (w.uz || w.ru)) || '';

/* ---------------- student: themes -> word table with "+" ---------------- */
export function VocabStudent() {
  const [themes, setThemes] = useState(null); const [open, setOpen] = useState(null); const [data, setData] = useState(null); const [err, setErr] = useState('');
  const loadThemes = () => api('/api/vocab/themes').then(setThemes).catch((e) => { setErr(apiError(e)); setThemes([]); });
  useEffect(() => { loadThemes(); }, []);
  const openTheme = (id) => { setOpen(id); setData(null); api('/api/vocab/themes/' + id).then(setData).catch((e) => setErr(apiError(e))); };
  const toggle = async (w) => {
    try { const r = await api(`/api/vocab/words/${w.id}/pick`, { method: 'POST' }); setData((d) => ({ ...d, words: d.words.map((x) => (x.id === w.id ? { ...x, picked: r.picked } : x)) })); }
    catch (e) { setErr(apiError(e)); }
  };
  if (open) {
    return (
      <div className="dcard vocab">
        <div className="hwtop"><button type="button" className="dbtn ghost" onClick={() => { setOpen(null); loadThemes(); }}><Icon name="back" size={16} /> {t('vocThemes')}</button><h3 className="hwtitle">{data ? data.name : ''}</h3></div>
        {err && <div className="err">{err}</div>}
        {!data ? <p className="muted">{t('loading')}</p> : data.words.length === 0 ? <p className="muted">{t('vocEmpty')}</p> : (
          <>
            <p className="muted small">{t('vocHint')}</p>
            <table className="vt"><tbody>
              {data.words.map((w) => (
                <tr key={w.id}>
                  <td className="vt-img">{w.image_url ? <img src={media(w.image_url)} alt="" /> : null}</td>
                  <td className="vt-w"><b>{w.word}</b><button type="button" className="gbtn speak" onClick={() => speak(w.word)} aria-label="US"><Icon name="volume" size={16} /></button>{w.phonetic && <small className="muted"> {w.phonetic}</small>}{w.definition && <small className="vt-def">{w.definition}</small>}</td>
                  <td className="vt-t">{tr(w)}</td>
                  <td className="vt-p"><button type="button" className={'vt-plus' + (w.picked ? ' on' : '')} onClick={() => toggle(w)} aria-label={w.picked ? t('vocAdded') : t('vocAdd')} title={w.picked ? t('vocAdded') : t('vocAdd')}><Icon name={w.picked ? 'check' : 'plus'} size={20} strokeWidth={3} /></button></td>
                </tr>
              ))}
            </tbody></table>
          </>
        )}
      </div>
    );
  }
  return (
    <div className="dcard vocab">
      <div className="hwtop"><h3 className="hwtitle">{t('vocabLists')}</h3></div>
      <p className="muted small">{t('vocIntro')}</p>
      {err && <div className="err">{err}</div>}
      {themes === null ? <p className="muted">{t('loading')}</p> : themes.length === 0 ? <p className="muted">{t('vocNoThemes')}</p> : (
        <div className="vtheme-grid">
          {themes.map((x) => (
            <button type="button" key={x.id} className="vtheme" onClick={() => openTheme(x.id)}>
              <b>{x.name}</b><small>{x.word_count} {t('hwWords')}{x.picked_count ? ` · ${x.picked_count} ✓` : ''}</small><Icon name="chevR" size={16} className="vtheme-ch" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- admin: themes and their words ---------------- */
const EMPTY = { word: '', uz: '', ru: '', definition: '', example: '', phonetic: '', imageUrl: '', imageCredit: '' };
function WordEditor({ themeId, init, onSaved, onCancel }) {
  const [f, setF] = useState(init || EMPTY); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [seed, setSeed] = useState(1);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const autofill = async () => {
    if (!f.word.trim()) return; setBusy(true); setErr('');
    try {
      const r = await api('/api/homework/lookup', { method: 'POST', body: { word: f.word } });
      setF((x) => ({ ...x, uz: (r.translations && r.translations.uz) || x.uz, ru: (r.translations && r.translations.ru) || x.ru, definition: r.definition || x.definition, example: r.example || x.example, phonetic: r.phonetic || x.phonetic, imageUrl: r.imageUrl || x.imageUrl, imageCredit: r.imageUrl ? r.imageCredit : x.imageCredit }));
      setSeed(1);
    } catch (e) { setErr(apiError(e)); }
    setBusy(false);
  };
  const newPic = async () => {
    if (!f.word.trim()) return; const n = (seed % 4) + 1; setBusy(true); setErr('');
    try { const r = await api('/api/homework/image-pick', { method: 'POST', body: { word: f.word, id: String(n), provider: 'ai' } }); setSeed(n); setF((x) => ({ ...x, imageUrl: r.url, imageCredit: r.credit })); }
    catch (e) { setErr(apiError(e)); }
    setBusy(false);
  };
  const save = async () => {
    setBusy(true); setErr('');
    try {
      if (init && init.id) await api('/api/vocab/words/' + init.id, { method: 'PUT', body: f });
      else await api(`/api/vocab/themes/${themeId}/words`, { method: 'POST', body: f });
      onSaved();
    } catch (e) { setErr(apiError(e)); setBusy(false); }
  };
  return (
    <div className="vedit">
      <div className="vedit-row">
        <input type="text" value={f.word} placeholder={t('hwEnglishWord')} maxLength={100} onChange={set('word')} />
        <button type="button" className="dbtn ghost" disabled={busy || !f.word.trim()} onClick={autofill}>{busy ? t('loading') : t('hwAutoFill')}</button>
      </div>
      <div className="vedit-body">
        <div className="vedit-pic">
          {f.imageUrl ? <img src={media(f.imageUrl)} alt="" /> : <div className="vedit-ph" />}
          <button type="button" className="dbtn ghost small" disabled={busy || !f.word.trim()} onClick={newPic}>{t('vocNewPic')}</button>
        </div>
        <div className="vedit-f">
          <input type="text" value={f.uz} placeholder="Uzbek" onChange={set('uz')} />
          <input type="text" value={f.ru} placeholder="Russian" onChange={set('ru')} />
          <input type="text" value={f.definition} placeholder="Definition" onChange={set('definition')} />
          <input type="text" value={f.example} placeholder="Example sentence" onChange={set('example')} />
        </div>
      </div>
      {err && <div className="err">{err}</div>}
      <div className="acts"><button type="button" className="dbtn" disabled={busy || !f.word.trim()} onClick={save}>{t('save')}</button>{onCancel && <button type="button" className="dbtn ghost" onClick={onCancel}>{t('cancel')}</button>}</div>
    </div>
  );
}

export function VocabAdmin() {
  const [themes, setThemes] = useState([]); const [open, setOpen] = useState(null); const [data, setData] = useState(null); const [name, setName] = useState(''); const [err, setErr] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | word object
  const load = () => api('/api/vocab/themes').then(setThemes).catch((e) => setErr(apiError(e)));
  const loadTheme = (id) => api('/api/vocab/themes/' + id).then(setData).catch((e) => setErr(apiError(e)));
  useEffect(() => { load(); }, []);
  const add = async () => { if (!name.trim()) return; try { const r = await api('/api/vocab/themes', { method: 'POST', body: { name } }); setName(''); await load(); setOpen(r.id); loadTheme(r.id); } catch (e) { setErr(apiError(e)); } };
  const delTheme = async (id) => { if (!confirm(t('confirmDelete'))) return; await api('/api/vocab/themes/' + id, { method: 'DELETE' }).catch((e) => setErr(apiError(e))); setOpen(null); setData(null); load(); };
  const delWord = async (id) => { if (!confirm(t('confirmDelete'))) return; await api('/api/vocab/words/' + id, { method: 'DELETE' }).catch((e) => setErr(apiError(e))); loadTheme(open); load(); };
  if (open && data) {
    return (
      <div className="dcard vocab">
        <div className="hwtop"><button type="button" className="dbtn ghost" onClick={() => { setOpen(null); setData(null); setEditing(null); }}><Icon name="back" size={16} /> {t('vocThemes')}</button><h3 className="hwtitle">{data.name}</h3>
          <button type="button" className="dbtn danger" onClick={() => delTheme(open)} aria-label="Delete"><Icon name="trash" size={16} /></button></div>
        {err && <div className="err">{err}</div>}
        {editing ? <WordEditor themeId={open} init={editing === 'new' ? null : { id: editing.id, word: editing.word, uz: editing.uz || '', ru: editing.ru || '', definition: editing.definition || '', example: editing.example || '', phonetic: editing.phonetic || '', imageUrl: editing.image_url || '', imageCredit: editing.image_credit || '' }}
          onSaved={() => { setEditing(null); loadTheme(open); load(); }} onCancel={() => setEditing(null)} />
          : <div className="acts"><button type="button" className="dbtn" onClick={() => setEditing('new')}><Icon name="plus" size={16} /> {t('vocAddWord')}</button></div>}
        <table className="vt"><tbody>
          {data.words.map((w) => (
            <tr key={w.id}>
              <td className="vt-img">{w.image_url ? <img src={media(w.image_url)} alt="" /> : null}</td>
              <td className="vt-w"><b>{w.word}</b><small className="vt-def">{w.definition}</small></td>
              <td className="vt-t">{w.uz}{w.ru ? ' / ' + w.ru : ''}</td>
              <td className="vt-p"><button type="button" className="dbtn ghost small" onClick={() => setEditing(w)}>{t('edit')}</button> <button type="button" className="dbtn ghost small" onClick={() => delWord(w.id)}><Icon name="trash" size={14} /></button></td>
            </tr>
          ))}
        </tbody></table>
      </div>
    );
  }
  return (
    <div className="dcard vocab">
      <div className="hwtop"><h3 className="hwtitle">{t('vocabLists')}</h3></div>
      {err && <div className="err">{err}</div>}
      <div className="vedit-row"><input type="text" value={name} placeholder={t('vocThemeName')} maxLength={80} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} /><button type="button" className="dbtn" onClick={add}><Icon name="plus" size={16} /> {t('vocAddTheme')}</button></div>
      <div className="vtheme-grid">
        {themes.map((x) => (
          <button type="button" key={x.id} className="vtheme" onClick={() => { setOpen(x.id); loadTheme(x.id); }}><b>{x.name}</b><small>{x.word_count} {t('hwWords')}</small><Icon name="chevR" size={16} className="vtheme-ch" /></button>
        ))}
      </div>
    </div>
  );
}
