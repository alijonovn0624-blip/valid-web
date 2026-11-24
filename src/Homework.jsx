import { useEffect, useMemo, useRef, useState } from 'react';
import { api, API } from './api';
import { Icon } from './icons.jsx';
import { VocabCelebration, MissionComplete } from './Celebrate.jsx';
import { t, apiError } from './i18n.js';
import { iso, longDay, dayLabel, Ava } from './ui.jsx';
import { Modal, MistakesModal } from './Pages.jsx';
import { WordPicture, PosTag, IconCredits } from './WordPicture.jsx';
import { useClock, fmtCountdown, fmtWhen, fmtTime, lessonLeft, buildCourse } from './lock.js';

const speak = (w, lang = 'en-US') => { try { const u = new SpeechSynthesisUtterance(w); u.lang = lang; u.rate = 0.9; const v = window.speechSynthesis.getVoices().find((x) => x.lang.replace('_', '-') === lang); if (v) u.voice = v; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); } catch { /* speech not supported */ } };
const artFor = (w) => { let n = 0; for (const c of String(w)) n = (n * 31 + c.charCodeAt(0)) % 997; return API + '/avatars/a' + String((n % 12) + 1).padStart(2, '0') + '.svg'; };
const media = (u) => (!u ? '' : u.startsWith('http') ? u : API + u);
const upload = (file) => { const fd = new FormData(); fd.append('file', file); return api('/api/homework/upload', { method: 'POST', body: fd }); };
const KIND_LABEL = { choice: 'hwKindChoice', gapfill: 'hwKindGap', complete: 'hwKindComplete', order: 'hwKindOrder', text: 'hwKindText' };

/* =====================  Admin: create + manage  /  Teacher: read-only  ===================== */
const emptyEx = (kind = 'choice') => ({ kind, instruction: '', question: '', options: ['', '', ''], correct: 0, answer: '' });
const emptyWord = () => ({ word: '', uz: '', ru: '', definition: '', example: '', imageUrl: '', imageCredit: '', imageProvider: '', imageAssetId: '', imageStyle: '', imageAttributionUrl: '', imageRef: '', pos: '', busy: false, looked: false, imgState: '', cands: [], picker: false });
const LETTER = (i) => String.fromCharCode(65 + i);

function UnlockPanel({ id }) {
  const [rows, setRows] = useState(null); const [err, setErr] = useState('');
  const load = () => api(`/api/homework/${id}/unlocks`).then((r) => setRows(r.students)).catch((x) => setErr(apiError(x)));
  useEffect(() => { load(); }, [id]);
  const flip = async (s) => {
    try { await api(`/api/homework/${id}/unlocks`, { method: 'PUT', body: { studentId: s.id, unlocked: !s.unlocked } }); setRows((a) => a.map((x) => (x.id === s.id ? { ...x, unlocked: !x.unlocked } : x))); }
    catch (x) { setErr(apiError(x)); }
  };
  return (
    <div className="unl">
      <h4><Icon name="lock" size={16} /> {t('hwUnlockTitle')}</h4>
      <p className="muted small">{t('hwUnlockNote')}</p>
      {err && <div className="err">{err}</div>}
      <div className="unl-list">{(rows || []).map((s) => (
        <div key={s.id} className={'unl-row ' + (s.unlocked ? 'on' : '')}><span>{s.full_name}</span>
          <label className="hwswitch"><input type="checkbox" checked={s.unlocked} onChange={() => flip(s)} /> <span>{s.unlocked ? t('hwUnlockOpen') : t('hwUnlockLocked')}</span></label></div>
      ))}</div>
    </div>
  );
}

function HomeworkDetail({ id, onClose, isAdmin, onDeleted }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const del = async () => {
    if (!confirm(t('hwDeleteQ'))) return;
    try { await api('/api/homework/' + id, { method: 'DELETE' }); onDeleted && onDeleted(); onClose(); } catch (x) { setErr(x.code === 'HAS_ANSWERS' ? t('hwHasAnswers') : apiError(x)); }
  };
  useEffect(() => { api('/api/homework/' + id).then(setD).catch((x) => setErr(apiError(x))); }, [id]);
  return (
    <Modal title={d ? `${d.unit ? d.unit + ' · ' : ''}${d.title}` : t('hwExercises')} onClose={onClose}>
      {err && <div className="err">{err}</div>}
      {!d && !err && <p className="muted">{t('loading')}</p>}
      {d && (
        <div className="hwdetail">
          <p className="muted small">{d.group_name} · {longDay(d.due_date)}</p>
          {isAdmin && <button type="button" className="dbtn danger" onClick={del}><Icon name="trash" size={15} /> {t('remove')}</button>}
          {isAdmin && <label className="hwswitch"><input type="checkbox" checked={d.video_enabled !== false} onChange={async (ev) => { const on = ev.target.checked; try { await api('/api/homework/' + id, { method: 'PUT', body: { videoEnabled: on } }); setD({ ...d, video_enabled: on }); } catch (x) { setErr(apiError(x)); } }} /> <span>{t('hwIncludeVideo')}</span></label>}
          {isAdmin && <UnlockPanel id={id} />}
          {d.video_url && <p className="small"><Icon name="play" size={14} /> {t('hwPartVideo')}: <a href={media(d.video_url)} target="_blank" rel="noopener noreferrer">{d.video_url.split('/').pop()}</a>{d.video_description ? ' — ' + d.video_description : ''}</p>}
          {d.exercises.map((e, i) => (
            <div key={e.id} className="hwex"><small className="muted">{t(KIND_LABEL[e.kind] || 'hwKindText')}</small>{e.instruction && <small className="hwinstr">{e.instruction}</small>}<b>{i + 1}. {e.question}</b>
              {e.options && e.kind === 'choice' && <ul>{e.options.map((o) => <li key={o} className={o === e.answer ? 'ok' : ''}>{o}</li>)}</ul>}
              {e.options && e.kind === 'order' && <small className="muted">{e.options.join(' · ')}</small>}
              <small className="muted">{t('hwCorrect')}: <b>{e.answer}</b></small></div>
          ))}
          {d.words.length > 0 && <><h4>{t('hwPartVocab')} ({d.words.length})</h4>
            <div className="hwwordlist">{d.words.map((w) => <span key={w.id} className="fchipg">{w.image_url && <img src={media(w.image_url)} alt="" />}{w.word} — {(w.translations && Object.values(w.translations).join(' / ')) || w.translation}{w.definition ? ` · ${w.definition}` : ''}</span>)}</div></>}
        </div>
      )}
    </Modal>
  );
}

function ExerciseEditor({ x, i, setEx, remove }) {
  const set = (patch) => setEx(i, patch);
  return (
    <div className="hwex edit">
      <div className="dtools">
        <b>{i + 1}.</b>
        <select value={x.kind} onChange={(e) => set({ kind: e.target.value })}>
          {['choice', 'gapfill', 'complete', 'order'].map((k) => <option key={k} value={k}>{t(KIND_LABEL[k])}</option>)}
        </select>
        <button type="button" className="dbtn ghost" onClick={() => remove(i)} aria-label={t('remove')}><Icon name="trash" size={15} /></button>
      </div>
      {(x.kind === 'gapfill' || x.kind === 'complete') && (
        <label className="hwinstr-ed">{t('hwInstruction')} <span className="req">*</span>
          <textarea rows={2} value={x.instruction || ''} maxLength={300} required placeholder={x.kind === 'gapfill' ? t('hwInstrPhGap') : t('hwInstrPhComplete')} onChange={(e) => set({ instruction: e.target.value })} />
        </label>
      )}
      <input type="text" value={x.question} maxLength={500} placeholder={x.kind === 'gapfill' ? t('hwGapHint') : x.kind === 'order' ? t('hwOrderHint') : t('hwQuestion')} onChange={(e) => set({ question: e.target.value })} />
      {x.kind === 'choice' && (
        <>
          {x.options.map((o, k) => (
            <div key={k} className={'hwopt' + (x.correct === k ? ' right' : '')}>
              <b className="optletter">{LETTER(k)}</b>
              <input type="text" value={o} maxLength={200} placeholder={`${t('hwOption')} ${LETTER(k)}`} onChange={(e) => set({ options: x.options.map((y, m) => (m === k ? e.target.value : y)) })} />
              <label className="optcorrect"><input type="radio" name={'c' + i} checked={x.correct === k} onChange={() => set({ correct: k })} /> {t('hwCorrectShort')}</label>
            </div>
          ))}
          {x.options.length < 6 && <button type="button" className="dbtn ghost" onClick={() => set({ options: [...x.options, ''] })}>+ {t('hwAddOption')}</button>}
          <small className="muted">{t('hwPickCorrect')}</small>
        </>
      )}
      {x.kind === 'gapfill' && <><input type="text" value={x.answer} maxLength={300} placeholder={t('hwCorrect')} onChange={(e) => set({ answer: e.target.value })} /><small className="muted">{t('hwAcceptedHint')}</small></>}
      {x.kind === 'complete' && <><input type="text" value={x.answer} maxLength={300} placeholder={t('hwCorrect')} onChange={(e) => set({ answer: e.target.value })} /><small className="muted">{t('hwAcceptedHint')}</small></>}
      {x.kind === 'order' && <><input type="text" value={x.answer} maxLength={300} placeholder={t('hwSentenceAnswer')} onChange={(e) => set({ answer: e.target.value })} /><small className="muted">{t('hwOrderNote')}</small></>}
    </div>
  );
}

function HomeworkForm({ groups, onCreated }) {
  const [f, setF] = useState({ groupId: '', unitNo: '', lessonNo: '', title: '', dueDate: iso(new Date()), description: '', videoUrl: '', videoDescription: '' });
  const [videoOn, setVideoOn] = useState(false);
  const [words, setWords] = useState([]);
  const [exs, setExs] = useState([]);
  const [vBusy, setVBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setEx = (i, patch) => setExs((l) => l.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const setW = (i, patch) => setWords((l) => l.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const pickImage = async (i, file) => {
    if (!file) return; setW(i, { busy: true });
    try { const r = await upload(file); setW(i, { imageUrl: r.url, imageCredit: '', busy: false }); } catch (x) { setErr(apiError(x)); setW(i, { busy: false }); }
  };
  // typing an English word fills translation, definition, example and picture automatically (editable afterwards)
  const lookup = async (i) => {
    const w = words[i]; if (!w || !w.word.trim() || w.looked) return;
    setW(i, { busy: true, looked: true });
    try {
      const r = await api('/api/homework/lookup', { method: 'POST', body: { word: w.word } });
      if (!(r.translations && (r.translations.uz || r.translations.ru))) setErr(t('hwLookupNoTr'));
      setWords((l) => l.map((x, j) => (j === i ? { ...x, busy: false, uz: x.uz || (r.translations && r.translations.uz) || '', ru: x.ru || (r.translations && r.translations.ru) || '',
        definition: x.definition || r.definition || '', example: x.example || r.example || '', imageUrl: x.imageUrl || r.imageUrl || '', imageCredit: x.imageUrl ? x.imageCredit : (r.imageCredit || ''), phonetic: x.phonetic || r.phonetic || '', imageProvider: x.imageUrl ? x.imageProvider : (r.imageProvider || ''), imageRef: x.imageUrl ? x.imageRef : (r.imageRef || ''), pos: x.pos || r.pos || '', imgState: (x.imageUrl || r.imageUrl) ? 'ok' : 'none' } : x)));
    } catch (x) { setW(i, { busy: false }); setErr(apiError(x)); }
  };
  // picture suggestions (Pexels / Unsplash through the backend): search, pick, or upload your own
  const findImages = async (i, provider = '') => {
    const w = words[i]; if (!w || !w.word.trim()) return;
    setW(i, { imgState: 'loading', picker: true, cands: [] });
    try {
      const r = await api('/api/homework/image-search?word=' + encodeURIComponent(w.word) + (provider ? '&provider=' + provider : ''));
      setW(i, { imgState: r.results.length ? 'ok' : !r.configured ? 'unconfigured' : 'none', cands: r.results, selectedId: r.selected ? r.selected.id : '', lastProvider: provider });
    } catch { setW(i, { imgState: 'error', cands: [], lastProvider: provider }); }
  };
  const chooseImg = async (i, c) => {
    setW(i, { busy: true });
    try {
      const r = await api('/api/homework/image-pick', { method: 'POST', body: { word: words[i].word, id: c.id, provider: c.provider, style: c.style, attributionUrl: c.attributionUrl } });
      if (r.provider === 'icons8') setW(i, { imageUrl: r.url, imageCredit: 'Icons8', imageProvider: 'icons8', imageAssetId: r.assetId, imageStyle: r.style || '', imageAttributionUrl: r.attributionUrl || '', busy: false, picker: false, imgState: 'ok' });
      else setW(i, { imageUrl: r.url, imageCredit: r.credit, imageProvider: '', imageRef: '', imageAssetId: '', imageStyle: '', imageAttributionUrl: '', busy: false, picker: false, imgState: 'ok' });
    } catch (x) { setW(i, { busy: false, imgState: 'error' }); setErr(apiError(x)); }
  };
  const pickVideo = async (file) => {
    if (!file) return; setVBusy(true); setErr('');
    try { const r = await upload(file); setF((c) => ({ ...c, videoUrl: r.url })); } catch (x) { setErr(apiError(x)); }
    setVBusy(false);
  };
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (!f.groupId) return setErr(t('chooseGroup'));
    if (!f.unitNo || !f.lessonNo) return setErr(t('hwUnitNo') + ' / ' + t('hwLessonNo'));
    const exercises = exs.map((x) => (x.kind === 'choice'
      ? { kind: 'choice', question: x.question, options: x.options.filter((o) => o.trim()), answer: x.options[x.correct] || '' }
      : { kind: x.kind, question: x.question, answer: x.answer, instruction: (x.kind === 'gapfill' || x.kind === 'complete') ? x.instruction : undefined }));
    const bi = exs.findIndex((x) => (x.kind === 'gapfill' || x.kind === 'complete') && !String(x.instruction || '').trim());
    if (bi >= 0) return setErr(`${bi + 1}. ${t('hwInstrMissing')}`);
    const wl = words.filter((w) => w.word.trim()).map((w) => ({ word: w.word, imageUrl: w.imageProvider === 'icons8' ? undefined : (w.imageUrl || undefined), imageCredit: w.imageCredit || undefined, imageProvider: w.imageProvider || undefined, imageRef: w.imageRef || undefined, pos: w.pos || undefined, imageAssetId: w.imageAssetId || undefined, imageStyle: w.imageStyle || undefined, imageAttributionUrl: w.imageAttributionUrl || undefined, definition: w.definition, example: w.example, phonetic: w.phonetic || undefined, translations: { uz: w.uz, ru: w.ru } }));
    setBusy(true);
    try {
      await api('/api/homework', { method: 'POST', body: { groupId: Number(f.groupId), unitNo: Number(f.unitNo), lessonNo: Number(f.lessonNo), title: f.title, dueDate: f.dueDate, description: f.description, videoEnabled: videoOn, videoUrl: videoOn ? (f.videoUrl || undefined) : undefined, videoDescription: videoOn ? f.videoDescription : undefined, words: wl, exercises } });
      const ln = Number(f.lessonNo), un = Number(f.unitNo); // next lesson is pre-selected: 3.1 -> 3.2 -> 3.3 -> 4.1
      setF({ ...f, unitNo: ln >= 3 ? Math.min(12, un + 1) : un, lessonNo: ln >= 3 ? 1 : ln + 1, title: '', description: '', videoUrl: '', videoDescription: '' }); setWords([]); setExs([]); onCreated();
    } catch (x) { setErr(apiError(x)); }
    setBusy(false);
  };
  return (
    <form className="dcard groupform" onSubmit={submit}>
      <h3><Icon name="plus" size={18} /> {t('hwCreate')}</h3>
      <p className="muted small">{t('hwRewards')}</p>
      <div className="gfgrid">
        <label>{t('group')} *<select value={f.groupId} onChange={set('groupId')} required><option value="">{t('chooseGroup')}</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
        <label>{t('hwUnitNo')} *<select value={f.unitNo} onChange={set('unitNo')} required><option value="">–</option>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{t('unitWord')} {i + 1}</option>)}</select></label>
        <label>{t('hwLessonNo')} *<select value={f.lessonNo} onChange={set('lessonNo')} required><option value="">–</option>{[1, 2, 3].map((n) => <option key={n} value={n}>{f.unitNo ? `${f.unitNo}.${n}` : n}</option>)}</select></label>
        <label>{t('hwTitle')} *<input type="text" value={f.title} maxLength={120} onChange={set('title')} required /></label>
        <label>{t('hwLessonDate')} *<input type="date" value={f.dueDate} onChange={set('dueDate')} required /></label>
        <label className="wide">{t('hwDescription')}<input type="text" value={f.description} maxLength={500} onChange={set('description')} /></label>
      </div>

      <h4>1. {t('hwPartVocab')} <small className="muted">({words.length})</small></h4>
      <p className="muted small">{t('hwAutoNote')}</p>
      {words.map((w, i) => (
        <div key={i} className="hwwordcard">
          <div className="dtools">
            <input type="text" value={w.word} placeholder={t('hwEnglishWord')} maxLength={100} onChange={(e) => setW(i, { word: e.target.value, looked: false })} onBlur={() => lookup(i)} />
            <button type="button" className="dbtn ghost" onClick={() => { setW(i, { looked: false }); setTimeout(() => lookup(i), 0); }} disabled={w.busy || !w.word.trim()}>{w.busy ? t('loading') : t('hwAutoFill')}</button>
            <button type="button" className="dbtn ghost" onClick={() => setWords((l) => l.filter((_, j) => j !== i))} aria-label={t('remove')}><Icon name="trash" size={15} /></button>
          </div>
          <div className="hwwordbody">
            <div className="wpicwrap">
              <WordPicture word={w.word} value={w} busy={w.busy} onChange={(p) => setW(i, { ...p, imgState: 'ok' })} onUpload={async (file) => (await upload(file)).url} />
              <span className="wimgbtns"><button type="button" className="dbtn ghost small" disabled={!w.word.trim() || w.imgState === 'loading'} onClick={() => findImages(i, 'icons8')}><Icon name="find" size={14} /> {t('hwFind3d')}</button></span>
            </div>
            <div className="wfields">
              <input type="text" value={w.uz} placeholder={t('hwUz')} maxLength={200} onChange={(e) => setW(i, { uz: e.target.value })} />
              <input type="text" value={w.ru} placeholder={t('hwRu')} maxLength={200} onChange={(e) => setW(i, { ru: e.target.value })} />
              <input type="text" value={w.definition} placeholder={t('hwDefinition')} maxLength={300} onChange={(e) => setW(i, { definition: e.target.value })} />
              <input type="text" value={w.example} placeholder={t('hwExample')} maxLength={300} onChange={(e) => setW(i, { example: e.target.value })} />
              {w.imageCredit && <small className="muted">{t('hwPhotoCredit')}: {w.imageCredit}</small>}
            </div>
          </div>
          {w.picker && (
            <div className="imgpick">
              {w.imgState === 'loading' && <p className="muted small">{t('loading')}</p>}
              {w.imgState === 'error' && <p className="err">{w.lastProvider === 'icons8' ? t('hwIcons8Down') : t('hwImageError')} <a onClick={() => findImages(i, w.lastProvider || '')}>{t('retry')}</a></p>}
              {w.imgState === 'unconfigured' && <p className="muted small">{w.lastProvider === 'icons8' ? t('hwIcons8NoKey') : t('hwImageNoKey')}</p>}
              {w.imgState === 'none' && <p className="muted small">{t('hwNoImageFound')}</p>}
              {w.cands.length > 0 && <div className="imggrid">{w.cands.map((c) => <button type="button" key={c.id} className={w.selectedId === c.id ? 'on' : ''} onClick={() => chooseImg(i, c)} title={c.credit}><img src={c.thumb} alt="" loading="lazy" /></button>)}</div>}
              <button type="button" className="dbtn ghost small" onClick={() => setW(i, { picker: false })}>{t('close')}</button>
            </div>
          )}
        </div>
      ))}
      <div><button type="button" className="dbtn ghost" onClick={() => setWords((l) => [...l, emptyWord()])}><Icon name="plus" size={15} /> {t('hwAddWord')}</button></div>

      <h4>2. {t('hwPartVideo')}</h4>
      <label className="hwswitch"><input type="checkbox" checked={videoOn} onChange={(e) => setVideoOn(e.target.checked)} /> <span>{t('hwIncludeVideo')}</span></label>
      {videoOn && <>
      <div className="dtools">
        <label className="dbtn ghost">{vBusy ? t('loading') : <><Icon name="play" size={15} /> {t('hwUploadVideo')}</>}<input type="file" hidden accept="video/mp4,video/webm,video/quicktime" onChange={(e) => { pickVideo(e.target.files[0]); e.target.value = ''; }} /></label>
        <input type="text" value={f.videoUrl} placeholder={t('hwVideoUrl')} onChange={set('videoUrl')} />
      </div>
      {f.videoUrl && <p className="okmsg small"><Icon name="ok" size={14} /> {f.videoUrl.split('/').pop()}</p>}
      <textarea rows={3} value={f.videoDescription} maxLength={2000} placeholder={t('hwVideoDesc')} onChange={set('videoDescription')} />
      </>}

      <h4>3. {t('hwExercises')} <small className="muted">({exs.length}) · {t('hwOptional')}</small></h4>
      {exs.map((x, i) => <ExerciseEditor key={i} x={x} i={i} setEx={setEx} remove={(k) => setExs((l) => l.filter((_, j) => j !== k))} />)}
      <div className="acts">
        <button type="button" className="dbtn ghost" onClick={() => setExs((l) => [...l, emptyEx()])}><Icon name="plus" size={15} /> {t('hwAddEx')}</button>
      </div>
      {err && <div className="err">{err}</div>}
      <div><button className="dbtn" disabled={busy || vBusy}>{busy ? t('loading') : t('hwCreate')}</button></div>
    </form>
  );
}

export function HomeworkStaff({ isAdmin, groups, onOpen }) {
  const [msg, setMsg] = useState('');
  const [k, setK] = useState(0);
  return (
    <>
      {isAdmin && <HomeworkForm groups={groups} onCreated={() => { setMsg(t('hwCreated')); setK((x) => x + 1); }} />}
      {msg && <div className="dnote">{msg}</div>}
      <HomeworkMatrix key={k} groups={groups} isAdmin={isAdmin} onOpen={onOpen} />
    </>
  );
}

/* Homework progress table: ALL homework as columns (scrolls sideways), the student names stay frozen on the left. Read-only. */
const toneOf = (p) => (p < 50 ? 'red' : p < 70 ? 'yellow' : 'green');
export function HomeworkMatrix({ groups, gid: gidProp = '', isAdmin, onOpen }) {
  const [gid, setGid] = useState(gidProp);
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [mist, setMist] = useState(null);
  const [view, setView] = useState(null);
  const [k, setK] = useState(0);
  useEffect(() => {
    setD(null); setErr('');
    api('/api/teacher/homework-matrix' + (gid ? '?groupId=' + gid : '')).then(setD).catch((x) => setErr(apiError(x)));
  }, [gid, k]);
  return (
    <div className="dcard">
      <h3><Icon name="homework" size={20} /> {t('homeworkProgress')}</h3>
      <div className="dtools">
        <select value={gid} onChange={(e) => setGid(e.target.value)} aria-label={t('group')}>
          <option value="">{t('allGroups')}</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>
      <div className="chiprow">
        <span className="hwkey red">&lt; 50%</span><span className="hwkey yellow">50–69%</span><span className="hwkey green">≥ 70%</span>
        <span className="muted small">{t('hwMatrixHint')}</span>
      </div>
      {err && <div className="err">{err}</div>}
      {!d && !err && <p className="muted">{t('loading')}</p>}
      {d && d.homework.length === 0 && <p className="muted">{t('noHomework')}</p>}
      {d && d.homework.length > 0 && (
        <div className="mxwrap">
          <table className="mx">
            <thead><tr>
              <th className="stickycol"><span className="ico-inline"><Icon name="users" size={16} /> {t('student')}</span></th>
              {d.homework.map((w) => (
                <th key={w.id}><button type="button" className="mxhead" onClick={() => setView(w.id)} title={`${w.title} · ${w.group_name}`}><b>{w.unit || w.title}</b><small>{dayLabel(w.due_date)[0]}</small></button></th>
              ))}
            </tr></thead>
            <tbody>
              {d.rows.map((s, i) => (
                <tr key={s.id}>
                  <td className="stickycol"><span className="who clickable" onClick={() => onOpen && onOpen(s.id)}><em className="rown">{i + 1}</em><Ava u={s} size={30} /> <span className="nm">{s.full_name}</span></span></td>
                  {d.homework.map((w) => {
                    const p = s.cells[w.id];
                    const hasNote = p === 0 && s.notes[w.due_date];
                    return (
                      <td key={w.id}>
                        {p === undefined || p === null
                          ? <span className="hwcircle2 none">–</span>
                          : <button type="button" className={'hwcircle2 ' + toneOf(p) + (hasNote ? ' hasnote' : '')} title={`${w.title}${hasNote ? ' · ' + t('reason_' + s.notes[w.due_date]) : ''} — ${t('hwMistakes')}`}
                              onClick={() => setMist({ id: s.id, name: `${s.full_name} · ${w.title}`, hid: w.id, date: w.due_date })}>{p}%</button>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {mist && <MistakesModal sid={mist.id} name={mist.name} from={mist.date} to={mist.date} hid={mist.hid} onClose={() => setMist(null)} />}
      {view && <HomeworkDetail id={view} isAdmin={isAdmin} onDeleted={() => setK((x) => x + 1)} onClose={() => setView(null)} />}
    </div>
  );
}

/* =====================  Student  ===================== */
const Back = ({ onClick }) => <button type="button" className="dbtn ghost backbtn" onClick={onClick}><Icon name="back" size={16} /> {t('back')}</button>;
const curLang = () => localStorage.getItem('lang') || 'uz';
const tr = (w, k) => (w.translations && w.translations[k]) || (k === 'uz' ? w.translation : '') || '';
const otherTrans = (w) => { const m = (w.translations) || {}; const cur = curLang(); const o = ['uz', 'ru'].filter((k) => k !== (m[cur] ? cur : 'uz') && m[k]).map((k) => m[k]); return o[0] || ''; };
const trans = (w) => (w.translations && (w.translations[curLang()] || w.translations.uz || w.translations.ru)) || w.translation;
const RewardBanner = ({ r }) => (r ? <div className="rewardbar"><Icon name="coins" size={18} /> {t('hwEarned')} <b>+{r.coins}</b> {t('coins')}{r.points ? <> · <Icon name="star" size={16} /> <b>+{r.points}</b> {t('points')}</> : null}</div> : null);

export function SavedWords({ onClose }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { api('/api/homework/saved/words').then(setRows).catch(() => setRows([])); }, []);
  return (
    <Modal title={<span className="ico-inline"><Icon name="bookmark" size={18} /> {t('hwSaved')}</span>} onClose={onClose}>
      {!rows && <p className="muted">{t('loading')}</p>}
      {rows && rows.length === 0 && <p className="muted">{t('hwNoSaved')}</p>}
      {rows && rows.map((w) => <div key={w.id} className="drow"><b>{w.word}</b><span>{w.translation}</span></div>)}
    </Modal>
  );
}

/* ---- exercise answer inputs by type ---- */
function AnswerInput({ e, val, setVal, disabled, onEnter, picked, setPicked }) {
  if (e.kind === 'choice')
    return <div className="hwchoices">{e.options.map((o, k) => <button key={o} type="button" disabled={disabled} className={'choice' + (val === o ? ' on' : '')} onClick={() => setVal(o)}><b className="optletter">{LETTER(k)}.</b> <span className="opttext">{o}</span><span className="optradio" aria-hidden="true">{val === o && <Icon name="check" size={14} strokeWidth={3} />}</span></button>)}</div>;
  if (e.kind === 'order') {
    return (
      <div className="hworder">
        <div className="hwline">{picked.length === 0 ? <span className="muted">{t('hwTapWords')}</span> : picked.map((ix, k) => <button key={k} type="button" disabled={disabled} className="tok on" onClick={() => setPicked(picked.filter((_, m) => m !== k))}>{e.options[ix]}</button>)}</div>
        <div className="hwbank">{e.options.map((o, ix) => <button key={ix} type="button" disabled={disabled || picked.includes(ix)} className="tok" onClick={() => setPicked([...picked, ix])}>{o}</button>)}</div>
        {picked.length > 0 && !disabled && <button type="button" className="dbtn ghost" onClick={() => setPicked([])}>{t('hwReset')}</button>}
      </div>
    );
  }
  if (e.kind === 'gapfill') {
    const mm = e.question.match(/_+/);
    const before = mm ? e.question.slice(0, mm.index) : e.question + ' ', after = mm ? e.question.slice(mm.index + mm[0].length) : '';
    return (
      <div className="hwgap">{before}<input type="text" value={val} disabled={disabled} onChange={(x) => setVal(x.target.value)} onKeyDown={(x) => x.key === 'Enter' && onEnter()} className="gapinput" autoComplete="off" />{after}</div>
    );
  }
  return <input type="text" value={val} disabled={disabled} onChange={(x) => setVal(x.target.value)} onKeyDown={(x) => x.key === 'Enter' && onEnter()} placeholder={t('hwYourAnswer')} autoComplete="off" />;
}

function Runner({ hw, onBack, onChanged }) {
  const all = hw.exercises;
  const [ans, setAns] = useState(() => { const m = {}; hw.mine.answers.forEach((a) => { m[a.exercise_id] = a; }); return m; });
  const [keys, setKeys] = useState(hw.mine.keys_left);
  const [draft, setDraft] = useState({});   // exercise id -> { val, picked }
  const [res, setRes] = useState({});       // exercise id -> { ok, val } (result of the last check)
  const [shown, setShown] = useState({});   // exercise id -> answer revealed with a key
  const [keyDlg, setKeyDlg] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [reward, setReward] = useState(null);
  const [queue, setQueue] = useState(null);   // ids of the mistakes that are being repeated (null = the first round)
  const [report, setReport] = useState(null); // { ok, bad, wrong } after "Check answers"
  const [done, setDone] = useState(false);    // congratulations screen
  const [first, setFirst] = useState(null);     // result of the first check (for the final statistics)
  const [practice, setPractice] = useState(false); // repeating a finished unit: the server pays nothing and changes nothing
  const ex = queue ? all.filter((x) => queue.includes(x.id)) : all;
  const isClean = (x) => !!(ans[x.id] && ans[x.id].is_correct);
  const isKeyed = (x) => !!(ans[x.id] && ans[x.id].used_key);
  const isDone = (x) => isClean(x) || isKeyed(x);
  const settled = (x) => !practice && isDone(x); // in practice mode every exercise is open again
  const [i, setI] = useState(() => { const k = all.findIndex((x) => !(hw.mine.answers.find((a) => a.exercise_id === x.id && (a.is_correct || a.used_key)))); return k < 0 ? 0 : k; });
  const e = ex[i];
  const d = (e && draft[e.id]) || { val: '', picked: [] };
  const setVal = (v) => setDraft((m) => ({ ...m, [e.id]: { val: v, picked: [] } }));
  const setPicked = (arr) => setDraft((m) => ({ ...m, [e.id]: { picked: arr, val: arr.map((ix) => e.options[ix]).join(' ') } }));
  const has = (x) => !!(draft[x.id] && draft[x.id].val.trim());
  const answered = ex.filter((x) => settled(x) || has(x)).length;
  const pending = ex.filter((x) => !settled(x) && has(x) && !(res[x.id] && res[x.id].val === draft[x.id].val)); // new or edited answers still to check
  const go = (n) => { setI(n); setErr(''); };
  const base = (x) => `/api/homework/${hw.id}/exercises/${x.id}`;
  const last = i >= ex.length - 1;

  // "Check answers" (only on the last exercise): the server checks everything, then the mistakes are repeated
  const checkAll = async () => {
    if (busy || answered < ex.length) return; setBusy(true); setErr('');
    const next = {}; let rw = null;
    try {
      for (const x of pending) {
        const val = draft[x.id].val;
        const r = await api(base(x) + '/answer', { method: 'POST', body: { answer: val } });
        if (r.reward) rw = r.reward;
        next[x.id] = { ok: !!r.correct, val };
        if (r.practice) continue;
        if (r.correct) setAns((a) => ({ ...a, [x.id]: { ...(a[x.id] || {}), exercise_id: x.id, is_correct: true } }));
      }
    } catch (x) { setErr(apiError(x)); setBusy(false); return; }
    const merged = { ...res, ...next };
    setRes(merged); if (rw) setReward(rw);
    const okNow = (x) => settled(x) || !!(merged[x.id] && merged[x.id].ok && draft[x.id] && merged[x.id].val === draft[x.id].val);
    const wrong = ex.filter((x) => !okNow(x)).map((x) => x.id);
    setReport({ ok: ex.length - wrong.length, bad: wrong.length, wrong });
    if (!queue && !first) setFirst({ ok: ex.length - wrong.length, total: ex.length });
    if (wrong.length === 0) setDone(true);
    onChanged(); setBusy(false);
  };
  const fixMistakes = () => {
    const ids = report.wrong;
    setDraft((m) => { const n = { ...m }; ids.forEach((id) => { delete n[id]; }); return n; });
    setRes((m) => { const n = { ...m }; ids.forEach((id) => { delete n[id]; }); return n; });
    setQueue(ids); setReport(null); setI(0); setErr('');
  };
  const again = () => { setPractice(true); setDraft({}); setRes({}); setQueue(null); setReport(null); setDone(false); setFirst(null); setReward(null); setI(0); };
  const useKey = async () => {
    setBusy(true); setErr('');
    try {
      const r = await api(base(e) + '/reveal', { method: 'POST' });
      setKeys(r.keys_left);
      if (!r.free) setAns((a) => ({ ...a, [e.id]: { ...(a[e.id] || {}), exercise_id: e.id, used_key: true, is_correct: false } }));
      setShown((s) => ({ ...s, [e.id]: r.answer }));
      if (r.reward) setReward(r.reward);
      onChanged();
    } catch (x) { setErr(x.code === 'NO_KEYS' ? t('hwNoKeys') : apiError(x)); if (x.code === 'NO_KEYS') setKeys(0); }
    setBusy(false); setKeyDlg(false);
  };
  const okCount = all.filter(isClean).length;
  const finished = all.length > 0 && all.every(isDone);

  if (done) return <MissionComplete total={first ? first.total : all.length} correct={first ? first.ok : all.length} onContinue={onBack} />;
  if (report && report.bad > 0) return (
    <div className="dcard">
      <div className="hwtop"><Back onClick={onBack} /></div>
      <RewardBanner r={reward} />
      <div className="hwdone">
        <h2>{t('hwRoundDone')}</h2>
        <div className="vstats"><div className="ok"><b>{report.ok}</b><small>{t('correctN')}</small></div><div className="bad"><b>{report.bad}</b><small>{t('incorrectN')}</small></div></div>
        <p className="muted">{t('hwMistakesNote')}</p>
        <div className="acts" style={{ justifyContent: 'center' }}><button type="button" className="dbtn startbtn" onClick={fixMistakes}>{t('fixMistakes')} ({report.bad})</button></div>
      </div>
    </div>
  );
  return (
    <div className="dcard">
      <div className="hwtop"><Back onClick={onBack} />
        <button type="button" className="keychip click" onClick={() => setKeyDlg(true)} title={t('hwKeys')} aria-label={t('hwUseKeyTitle')}><Icon name="key" size={18} /> {keys}</button></div>
      <RewardBanner r={reward} />
      {finished && !practice && !queue && <div className="dnote"><b>{t('hwFinished')}</b> · {t('hwResult')}: {Math.round((okCount / all.length) * 100)}% <button type="button" className="dbtn ghost" style={{ marginLeft: 10 }} onClick={again}><Icon name="undo" size={15} /> {t('practiceAgain')}</button></div>}
      {practice && !queue && <div className="dnote"><Icon name="info" size={15} /> {t('practiceNote')}</div>}
      {queue && <div className="dnote"><Icon name="info" size={15} /> {t('hwMistakesRound')}: <b>{queue.length}</b></div>}
      {e && (
        <div className="hwq">
          <p className="muted small">{i + 1} / {ex.length} · {t(KIND_LABEL[e.kind] || 'hwKindText')}</p>
          {e.instruction && <p className="hwinstr">{e.instruction}</p>}
          {e.kind !== 'gapfill' && <h3>{e.question}</h3>}
          <AnswerInput e={e} val={d.val} setVal={setVal} disabled={isClean(e) && !practice && !queue} onEnter={() => !last && go(i + 1)} picked={d.picked} setPicked={setPicked} />
          {isClean(e) && !practice && !queue && <p className="okmsg"><Icon name="ok" size={16} /> {t('hwCorrectMsg')}</p>}
          {isKeyed(e) && !practice && <p className="hwreveal"><Icon name="key" size={16} /> {t('hwAnswerIs')}: <b>{shown[e.id] || '—'}</b></p>}
          {err && <div className="err">{err}</div>}
        </div>
      )}
      <div className="hwcheckbar">
        <span className="muted small">{answered} / {ex.length} {t('hwAnswered')}</span>
        <span className="hwnav">
          {i > 0 && <button type="button" className="dbtn ghost" onClick={() => go(i - 1)} aria-label={t('back')}><Icon name="prev" size={16} /></button>}
          {!last
            ? <button type="button" className="dbtn" onClick={() => go(i + 1)}>{t('hwNext')} <Icon name="chevR" size={16} /></button>
            : <button type="button" className="dbtn startbtn" disabled={busy || answered < ex.length || (pending.length === 0 && !ex.some((x) => !settled(x)))} onClick={checkAll}><Icon name="ok" size={16} /> {busy ? t('loading') : t('hwCheckAll')}</button>}
        </span>
      </div>
      {keyDlg && e && (
        <Modal title={<span className="ico-inline"><Icon name="key" size={18} /> {t('hwUseKeyTitle')}</span>} onClose={() => setKeyDlg(false)}>
          {isDone(e) ? <p>{t('hwKeyNotNeeded')}</p> : keys <= 0 ? <p>{t('hwNoKeys')}</p> : <p>{t('hwUseKeyText')} ({i + 1}). {t('hwKeys')}: <b>{keys}</b></p>}
          <span className="acts">
            {!isDone(e) && keys > 0 && <button className="dbtn" disabled={busy} onClick={useKey}>{t('hwUseKey')}</button>}
            <button className="dbtn ghost" onClick={() => setKeyDlg(false)}>{t('cancel')}</button>
          </span>
        </Modal>
      )}
    </div>
  );
}

/* ---- Part 1: vocabulary: swipe cards -> Start -> multiple choice "Pick the right meaning" ---- */
const nrm = (v) => String(v || '').trim().toLowerCase();
const shuf = (a) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
// one right meaning + up to two wrong ones taken from the other words of the same unit (never a duplicate of the right one)
function buildOptions(w, all) {
  const right = trans(w);
  const wrong = shuf([...new Set(all.filter((x) => x.id !== w.id).map(trans).filter((v) => v && nrm(v) !== nrm(right)))]).slice(0, 2);
  return shuf([right, ...wrong]);
}
// the example sentence with the word highlighted (like "I'm the new hire!")
function Highlight({ text, word }) {
  const esc = String(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = String(text).split(new RegExp('(' + esc + ')', 'i'));
  return <>{parts.map((p, i) => (nrm(p) === nrm(word) ? <b key={i} className="mhl">{p}</b> : <span key={i}>{p}</span>))}</>;
}

function VocabFlow({ hw, onBack, onChanged }) {
  const words = hw.words;
  const practice = hw.mine.parts.some((p) => p.part === 'vocab'); // a finished unit: only look at the cue cards again, nothing is asked or paid
  const [phase, setPhase] = useState('cards'); // cards -> review -> test -> results (-> cards of the wrong words -> test ...)
  const [correct, setCorrect] = useState(new Set()); // words answered right in THIS attempt (every visit starts from the beginning)
  const [mode, setMode] = useState('all'); // all | fix (cue cards of the wrong words only)
  const [kind, setKind] = useState('first'); // first round | automatic retry of the wrong ones | fix round
  const [cards, setCards] = useState(words);
  const [idx, setIdx] = useState(0);
  const [testList, setTestList] = useState(words);
  const [cur, setCur] = useState(0);
  const [typed, setTyped] = useState('');
  const [fb, setFb] = useState(null); // null | 'ok' | 'bad'
  const [cele, setCele] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState({});
  const inRef = useRef(null);
  const touch = useRef(null);
  const inFix = mode === 'fix';
  const step = (d) => { const n = idx + d; if (n < 0) return; if (n >= cards.length) { setPhase('review'); return; } setIdx(n); };
  const save = async (w) => { try { const r = await api(`/api/homework/${hw.id}/words/${w.id}/save`, { method: 'POST' }); setSaved((m) => ({ ...m, [w.id]: r.saved })); } catch {} };
  // words the server does not yet count as correct = the "mistakes" list (correct ones never come back)
  const wrongWords = (set = correct) => words.filter((w) => !set.has(w.id));
  const start = () => { if (mode === 'fix') { const todo = wrongWords(); setTestList(todo.length ? todo : words); setKind('fix'); } else { setTestList(words); setKind('first'); } setCur(0); setTyped(''); setFb(null); setErr(''); setPhase('test'); };
  const w = testList[cur];
  const c = cards[idx];
  const slots = w ? [...w.word] : [];
  const need = slots.filter((ch) => ch !== ' ').length;
  const givenOf = (val) => { let k = 0; return slots.map((ch) => (ch === ' ' ? ' ' : val[k++] || '')).join(''); };
  useEffect(() => { if (phase === 'test' && !fb && inRef.current) inRef.current.focus(); }, [phase, cur, fb]);
  // the answer is checked by the server as soon as the last letter is typed (no Check button)
  const check = async (val) => {
    if (busy || fb || !w || val.length < need) return; setBusy(true); setErr('');
    try {
      const r = await api(`/api/homework/${hw.id}/words/${w.id}/check`, { method: 'POST', body: { answer: givenOf(val) } });
      if (r.correct) { setFb('ok'); setCorrect((x) => new Set([...x, w.id])); onChanged(); } else setFb('bad');
    } catch (x) { setErr(apiError(x)); }
    setBusy(false);
  };
  const next = () => {
    setTyped(''); setFb(null);
    if (cur < testList.length - 1) { setCur(cur + 1); return; }
    const wrong = wrongWords();
    if (kind === 'first' && wrong.length) { setKind('retry'); setTestList(wrong); setCur(0); } // the wrong ones come back once, right after the first round
    else setPhase('results');
  };
  const fix = () => { const todo = wrongWords(); setMode('fix'); setCards(todo); setIdx(0); setPhase('cards'); };
  const finish = async () => {
    if (practice) { setCele(true); return; } // a repeat of a finished unit pays nothing and changes nothing
    setBusy(true); setErr('');
    try { await api(`/api/homework/${hw.id}/words/finish`, { method: 'POST' }); onChanged(); setCele(true); setBusy(false); }
    catch (x) { setErr(apiError(x)); setBusy(false); }
  };
  const nCorrect = words.filter((x) => correct.has(x.id)).length;
  if (cele) return <VocabCelebration total={words.length} correct={nCorrect} onContinue={onBack} />;
  return (
    <div className="dcard">
      <div className="hwtop"><Back onClick={onBack} /><h3 className="hwtitle">{t('hwPartVocab')}</h3></div>
      {phase === 'cards' && c && (
        <div className="vstep" onTouchStart={(e) => { touch.current = e.touches[0].clientX; }} onTouchEnd={(e) => { if (touch.current === null) return; const dx = e.changedTouches[0].clientX - touch.current; touch.current = null; if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1); }}>
          <p className="muted small">{inFix && <b>{t('fixMistakes')} · </b>}{idx + 1}/{cards.length}</p>
          <div className="vdots">{cards.map((x, k) => <i key={x.id} className={k === idx ? 'on' : k < idx ? 'seen' : ''} />)}</div>
          <div className="vcard big">
            <div className={'vblob' + (c.image_provider === 'openmoji' || c.image_provider === 'iconify' ? ' vicon' : '')}>{c.image_url ? <img src={media(c.image_url)} alt={c.word} onError={(e) => { e.currentTarget.src = artFor(c.word); e.currentTarget.className = 'vart'; }} /> : <img className="vart" src={artFor(c.word)} alt="" />}
            {c.image_provider === 'icons8' && c.image_attribution_url && <a className="vcredit" href={c.image_attribution_url} target="_blank" rel="noopener noreferrer">Icons8</a>}</div>
            <div className="vwordrow"><b className="vword">{c.word}</b>{c.pos && <PosTag pos={c.pos} full />}
              <button type="button" className="gbtn speak accent" onClick={() => speak(c.word, 'en-US')} aria-label="US"><Icon name="volume" size={22} /><small>US</small></button>
              <button type="button" className="gbtn speak accent" onClick={() => speak(c.word, 'en-GB')} aria-label="British"><Icon name="volume" size={22} /><small>UK</small></button></div>
            {c.phonetic && <span className="vphon">{c.phonetic}</span>}
            <span className="vtr"><small className="vlang">UZ</small> {tr(c, 'uz')}</span>
            <span className="vtr"><small className="vlang">RU</small> {tr(c, 'ru')}</span>
            {c.definition && <span className="vdef">{c.definition}</span>}
            {c.example && <span className="vex">“{c.example}”</span>}
            {c.image_credit && <small className="vcredit">{c.image_provider === 'openmoji' || c.image_provider === 'iconify' ? <IconCredits className="inl" /> : <>{t('hwPhotoCredit')}: {c.image_credit}</>}</small>}
            <button type="button" className="gbtn vsave" onClick={() => save(c)} aria-label={t('hwSaved')}><Icon name="bookmark" size={20} fill={(saved[c.id] !== undefined ? saved[c.id] : c.saved) ? 'currentColor' : 'none'} /></button>
          </div>
          <div className="acts" style={{ justifyContent: 'center' }}>
            <button className="dbtn ghost" disabled={idx === 0} onClick={() => step(-1)}><Icon name="prev" size={18} /> {t('back')}</button>
            <button className="dbtn" onClick={() => step(1)}>{t('continueBtn')} <Icon name="chevR" size={16} /></button>
          </div>
        </div>
      )}
      {phase === 'review' && (
        <div className="vend">
          <div className="dnote"><b>{t('hwSeenAll')}</b> ({cards.length})</div>
          <>
            <div className="acts" style={{ justifyContent: 'center' }}>
              <button className="dbtn ghost" onClick={() => { setIdx(0); setPhase('cards'); }}><Icon name="undo" size={16} /> {t('hwReview')}</button>
              <button className="dbtn startbtn" onClick={start}>{t('hwContinue')} <Icon name="chevR" size={16} /></button>
            </div>
            <p className="muted small" style={{ textAlign: 'center' }}>{t('hwContinueNote')}</p></>
        </div>
      )}
      {phase === 'test' && w && (
        <div className="mcq">
          <div className="mcqtop">
            <button type="button" className="mcqx" onClick={onBack} aria-label={t('close')}><Icon name="close" size={22} /></button>
            <div className="mcqbar"><i style={{ width: Math.round(((cur + (fb ? 1 : 0)) / testList.length) * 100) + '%' }} /></div>
            <span className="mcqpos">{cur + 1}/{testList.length}</span>
          </div>
          {kind === 'retry' && <p className="dnote" style={{ textAlign: 'center' }}><b>{t('retryRound')}</b></p>}
          <h3 className="mcqtitle">{t('typeEnglish')}</h3>
          <div className="mcqcard tw">
            <div className="twprompt"><b>{tr(w, 'uz')}</b><b className="ru">{tr(w, 'ru')}</b></div>
          </div>
          <div className={'twboxes' + (fb === 'ok' ? ' good' : fb === 'bad' ? ' wrong' : '')} onClick={() => inRef.current && inRef.current.focus()}>
            {(() => { let k = 0; return slots.map((ch, j) => ch === ' ' ? <span key={j} className="twgap" /> : (() => { const at = k++; return <span key={j} className={'twbox' + (typed[at] ? ' has' : '') + (!fb && at === Math.min(typed.length, need - 1) ? ' cur' : '')}>{typed[at] || ''}</span>; })()); })()}
            <input ref={inRef} className="twinput" value={typed} maxLength={need} autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false} disabled={busy || !!fb} aria-label={t('typeEnglish')}
              onChange={(e) => { const v = e.target.value.replace(/\s/g, '').slice(0, need); setTyped(v); check(v); }} />
          </div>
          {err && <div className="err">{err} <button type="button" className="dbtn ghost" onClick={() => check(typed)}>{t('retry')}</button></div>}
          {fb && <button type="button" className="mcqcont tw-next" autoFocus onClick={next}>{t('continueBtn')}</button>}
        </div>
      )}
      {phase === 'results' && (
        <div className="vend vresult">
          <div className="dnote"><b>{nCorrect === words.length ? t('allCorrect') : t('wordsDone')}</b></div>
          <div className="vstats">
            <div><b>{words.length}</b><small>{t('totalWords')}</small></div>
            <div className="ok"><b>{nCorrect}</b><small>{t('correctN')}</small></div>
            <div className="bad"><b>{words.length - nCorrect}</b><small>{t('incorrectN')}</small></div>
          </div>
          {err && <div className="err">{err}</div>}
          <div className="acts" style={{ justifyContent: 'center' }}>
            {words.length - nCorrect > 0 && <button className="dbtn ghost" disabled={busy} onClick={fix}><Icon name="undo" size={16} /> {t('fixMistakes')}</button>}
            <button className="dbtn startbtn" disabled={busy} onClick={finish}>{t('hwFinish')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Part 2: video lesson (the whole video must be watched; skipping ahead is blocked) ---- */
function VideoLesson({ hw, onBack, onChanged }) {
  const done0 = hw.mine.parts.some((p) => p.part === 'video');
  const [done, setDone] = useState(done0);
  const [reward, setReward] = useState(null);
  const [err, setErr] = useState('');
  const max = useRef(0);
  const ended = async () => {
    try { const r = await api(`/api/homework/${hw.id}/video/complete`, { method: 'POST' }); setDone(true); if (r.reward) setReward(r.reward); onChanged(); } catch (x) { setErr(apiError(x)); }
  };
  return (
    <div className="dcard">
      <div className="hwtop"><Back onClick={onBack} /><h3 className="hwtitle">{t('hwPartVideo')}</h3></div>
      <video className="hwvideo" src={media(hw.video_url)} controls controlsList="nodownload" playsInline
        onTimeUpdate={(e) => { if (!e.target.seeking) max.current = Math.max(max.current, e.target.currentTime); }}
        onSeeking={(e) => { if (!done && e.target.currentTime > max.current + 1) e.target.currentTime = max.current; }}
        onEnded={() => !done && ended()} />
      {!done && <p className="muted small"><Icon name="info" size={14} /> {t('hwWatchAll')}</p>}
      {done && <div className="dnote"><Icon name="ok" size={16} /> {t('hwVideoDone')}</div>}
      <RewardBanner r={reward} />
      {err && <div className="err">{err}</div>}
      {hw.video_description && <p className="hwdesc">{hw.video_description}</p>}
    </div>
  );
}

const overallPct = (hw) => {
  const wv = hw.words.length > 0, vd = !!hw.video_url, ex = hw.exercises.length > 0;
  const den = (ex ? 60 : 0) + (wv ? 20 : 0) + (vd ? 20 : 0);
  if (!den) return 0;
  const okW = hw.mine.words.filter((x) => x.correct).length, okE = hw.mine.answers.filter((a) => a.is_correct).length;
  const videoDone = hw.mine.parts.some((p) => p.part === 'video');
  return Math.round((100 * ((ex ? (60 * okE) / hw.exercises.length : 0) + (wv ? (20 * okW) / hw.words.length : 0) + (vd && videoDone ? 20 : 0))) / den);
};

function Unit({ id, onBack, onListChanged }) {
  const [hw, setHw] = useState(null);
  const [err, setErr] = useState('');
  const [sub, setSub] = useState('');
  const [saved, setSaved] = useState(false);
  const load = () => api('/api/homework/' + id).then(setHw).catch((x) => setErr(apiError(x)));
  useEffect(() => { load(); }, [id]);
  if (err) return <div className="dcard"><Back onClick={onBack} /><p className="err">{err}</p></div>;
  if (!hw) return <div className="dcard"><Back onClick={onBack} /><p className="muted">{t('loading')}</p></div>;
  const leave = () => { setSub(''); load(); onListChanged(); };
  if (sub === 'run') return <Runner hw={hw} onBack={leave} onChanged={onListChanged} />;
  if (sub === 'vocab') return <VocabFlow hw={hw} onBack={leave} onChanged={onListChanged} />;
  if (sub === 'video') return <VideoLesson hw={hw} onBack={leave} onChanged={onListChanged} />;
  const parts = hw.mine.parts.map((p) => p.part);
  const okWords = hw.mine.words.filter((x) => x.correct).length;
  const okEx = hw.mine.answers.filter((a) => a.is_correct).length;
  const R = hw.mine.rewards;
  const U = hw.mine.unlocked || { vocab: true, video: true, exercises: true };
  const Card = ({ icon, title, sub: subtxt, pct, partKey, onClick, off, locked, coins, why }) => (
    <button type="button" className={'hwcard ex' + (off || locked ? ' off' : '')} disabled={off || locked} onClick={onClick}>
      <span className="hwcircle"><Icon name={off || locked ? 'lock' : icon} size={22} /></span>
      <span className="hwtxt"><b>{title}</b><small>{off ? t('hwNotAdded') : locked ? why : subtxt}</small>{!off && !locked && pct !== null && <span className="hwprog"><i style={{ width: pct + '%' }} /></span>}</span>
      <span className="hwpct">{parts.includes(partKey) ? <Icon name="ok" size={22} /> : !off && !locked && pct !== null ? pct + '%' : ''}{!off && <small className="coinchip"><Icon name="coins" size={13} /> {coins}</small>}</span>
    </button>
  );
  const total = overallPct(hw);
  return (
    <>
      <div className="hwtop"><Back onClick={onBack} />
        <h2 className="hwtitle">{hw.unit ? `${t('unitWord')} ${hw.unit}` : hw.title}</h2>
        <span className="hwicons"><span className="keychip" title={t('hwKeys')}><Icon name="key" size={18} /> {hw.mine.keys_left}</span>
          <button type="button" className="gbtn" onClick={() => setSaved(true)} aria-label={t('hwSaved')}><Icon name="bookmark" size={20} /></button></span></div>
      {hw.unit && <p className="muted">{hw.title}</p>}
      <Card icon="star" title={`1. ${t('hwPartVocab')}`} sub={`${hw.words.length} ${t('hwWords')}`} pct={hw.words.length ? Math.round((okWords / hw.words.length) * 100) : 0} partKey="vocab" off={hw.words.length === 0} coins={R.vocab} onClick={() => setSub('vocab')} />
      <Card icon="play" title={`2. ${t('hwPartVideo')}`} sub={t('hwWatchAll')} pct={null} partKey="video" off={!hw.video_url} locked={!U.video} why={t('hwLockedVocab')} coins={R.video} onClick={() => setSub('video')} />
      <Card icon="homework" title={`3. ${t('hwExercises')}`} sub={`${hw.exercises.length} ${t('hwTasks')}`} pct={hw.exercises.length ? Math.round((okEx / hw.exercises.length) * 100) : 0} partKey="exercises" off={hw.exercises.length === 0} locked={!U.exercises} why={hw.video_url ? t('hwLockedVideo') : t('hwLockedVocab')} coins={R.exercises} onClick={() => setSub('run')} />
      {saved && <SavedWords onClose={() => setSaved(false)} />}
    </>
  );
}

const GRADS = ['linear-gradient(160deg,#4aa3e0,#1d5fa8)', 'linear-gradient(160deg,#9b6bd6,#3d3a9e)', 'linear-gradient(160deg,#35b58a,#1d6f6b)', 'linear-gradient(160deg,#e08a4a,#a8431d)'];
const starsFor = (p) => (p >= 80 ? 3 : p >= 50 ? 2 : p > 0 ? 1 : 0);

/* What the student sees of one unit right now:
   open   - can be done (and repeated any time, the % never goes down and no coins are paid twice)
   live   - THIS unit's offline lesson is running: red bar that drains until the lock ends
   locked - its lesson has not happened yet, or another offline lesson is running: lock + countdown
   empty  - the teacher has not published this lesson yet            exam - final exam (closed) */
function unitState(it, nowMs) {
  if (it.kind === 'exam') return { state: 'exam' };
  if (it.kind === 'empty') return { state: 'empty' };
  const h = it.h;
  if (h.locked && (!h.opens_at || Date.parse(h.opens_at) > nowMs)) {
    const remaining = h.opens_at ? Date.parse(h.opens_at) - nowMs : 0;
    return h.lock_reason === 'lesson_now' ? { state: 'live', reason: h.lock_reason, remaining, left: lessonLeft(h, nowMs) } : { state: 'locked', reason: h.lock_reason, remaining };
  }
  return { state: 'open', pct: h.pct ?? 0 };
}

function LockInfo({ it, nowMs, onClose }) {
  const s = unitState(it, nowMs);
  const h = it.h;
  const title = it.kind === 'exam' ? t('finalExam') : `${t('unitWord')} ${it.label}`;
  return (
    <Modal title={<span className="ico-inline"><Icon name="lock" size={18} /> {title}</span>} onClose={onClose}>
      {s.state === 'exam' && <p>{t('examLockedNote')}</p>}
      {s.state === 'empty' && <><p><b>{t('notPublished')}</b></p><p className="muted">{t('notPublishedNote')}</p></>}
      {(s.state === 'locked' || s.state === 'live') && (
        <>
          <p className="lockwhen"><span className="muted small">{t('opensOn')}</span><b>{fmtWhen(h.opens_at)}</b></p>
          <p className="lockwhen"><span className="muted small">{t('opensIn')}</span><b className="lockcount">{fmtCountdown(s.remaining)}</b></p>
          <p className="muted">{s.reason === 'lesson' ? t('lockedInLesson') : t('opensAfterLesson')}</p>
        </>
      )}
      {s.state === 'open' && <p>{t('hwUnit')}: {it.label}</p>}
      <span className="acts"><button className="dbtn" onClick={onClose}>{t('close')}</button></span>
    </Modal>
  );
}

export function StudentHomework({ me, onDeep }) {
  const [list, setList] = useState(null);
  const [st, setSt] = useState(null);
  const [serverNow, setServerNow] = useState(null);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(null);
  const [saved, setSaved] = useState(false);
  const [noGroup, setNoGroup] = useState(false);
  const [sel, setSel] = useState(null);
  const [info, setInfo] = useState(null);
  const [rk, setRk] = useState({});
  const [grpName, setGrpName] = useState('');
  const rail = useRef(null);
  const lastReload = useRef(0);
  const clock = useClock(serverNow);
  const nowMs = clock();
  const load = () => Promise.all([api('/api/homework'), api('/api/homework/lock-status').catch(() => null)]) // an older server without lock-status must not hide the units
    .then(([l, s]) => { setList(l); setSt(s); setServerNow(s && s.server_now); setErr(''); lastReload.current = Date.now(); })
    .catch((x) => setErr(apiError(x)));
  useEffect(() => { load(); api('/api/points/ranking').then(setRk).catch(() => {}); api('/api/community/groups').then((g) => { setNoGroup(g.length === 0); setGrpName(g[0] ? g[0].name : ''); }).catch(() => {}); const id = setInterval(load, 60000); return () => clearInterval(id); }, []);
  useEffect(() => { onDeep && onDeep(open !== null); }, [open]);

  const course = useMemo(() => buildCourse(list), [list]);
  const flat = useMemo(() => course.flatMap((g) => g.items), [course]);
  // the moment a lock runs out (or a lesson starts) the list is fetched again, so the card opens without a manual refresh
  const sec = Math.floor(nowMs / 1000);
  useEffect(() => {
    if (!list || !st || Date.now() - lastReload.current < 2500) return;
    const expired = list.some((h) => h.locked && h.opens_at && Date.parse(h.opens_at) <= nowMs) || (st && st.in_lesson && Date.parse(st.opens_at) <= nowMs)
      || (st && !st.in_lesson && st.next_lesson_start && Date.parse(st.next_lesson_start) <= nowMs);
    if (expired) load();
  }, [sec]);

  // start on the first unit that can be done and is not finished yet
  useEffect(() => {
    if (!list || sel !== null) return;
    const states = flat.map((it) => unitState(it, nowMs));
    let k = states.findIndex((x) => x.state === 'open' && x.pct < 100);
    if (k < 0) { const opens = states.map((x, i) => (x.state === 'open' ? i : -1)).filter((i) => i >= 0); k = opens.length ? opens[opens.length - 1] : 0; }
    setSel(k);
  }, [list]);
  useEffect(() => { if (sel !== null) centre(sel, false); }, [sel === null, !!list]);
  function centre(i, smooth = true) {
    const el = rail.current; const c = el && el.children[i]; if (!c) return;
    el.scrollTo({ left: c.offsetLeft - (el.clientWidth - c.offsetWidth) / 2, behavior: smooth ? 'smooth' : 'auto' });
  }
  const onScroll = () => {
    const el = rail.current; if (!el || !el.children.length) return;
    const mid = el.scrollLeft + el.clientWidth / 2; let best = 0, d = 1e9;
    [...el.children].forEach((c, i) => { const dist = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid); if (dist < d) { d = dist; best = i; } });
    if (best !== sel) setSel(best);
  };
  if (open) return <Unit id={open} onBack={() => { setOpen(null); load(); }} onListChanged={load} />;

  // yellow ring round the avatar = progress of the whole level (12 units x 3 lessons), it fills slowly
  const pctOf = (it) => { if (it.kind !== 'hw') return 0; const x = unitState(it, nowMs); return x.state === 'open' ? x.pct : 0; };
  const selGroup = course.find((g) => g.items.some((x) => x.i === sel));
  const ringItems = flat.filter((x) => x.kind !== 'exam'); // the whole level (12 units): the ring is full when the level is finished
  const ringPct = ringItems.length ? Math.round(ringItems.reduce((a, x) => a + pctOf(x), 0) / ringItems.length) : 0;
  const clickCard = (it) => {
    if (it.i !== sel) { setSel(it.i); centre(it.i); return; }
    const s = unitState(it, nowMs);
    if (s.state === 'open') setOpen(it.h.id); else setInfo(it);
  };
  const anyContent = list && list.some((h) => h.exercise_count > 0 || h.word_count > 0 || h.has_video);
  return (
    <div className="lessons">
      <div className="hwtop"><h2 className="hwtitle">{t('lessons')}</h2>
        <button type="button" className="gbtn" onClick={() => setSaved(true)} aria-label={t('hwSaved')}><Icon name="bookmark" size={20} /></button></div>
      {st && st.in_lesson && (
        <div className="lbanner live" role="status">
          <Icon name="lock" size={22} />
          <div><b>{t('lessonRunning')}</b><small>{t('lessonRunningNote')}</small></div>
          <span className="lbcount"><small>{t('opensIn')}</small><b>{fmtCountdown(Date.parse(st.opens_at) - nowMs)}</b></span>
        </div>
      )}
      {st && !st.in_lesson && st.next_lesson_start && (
        <div className="lbanner" role="status">
          <Icon name="clock" size={20} />
          <div><b>{t('nextLessonIn')}</b><small>{fmtWhen(st.next_lesson_start)}</small></div>
          <span className="lbcount"><b>{fmtCountdown(Date.parse(st.next_lesson_start) - nowMs)}</b></span>
        </div>
      )}
      {st && !st.has_schedule && <p className="muted small">{t('noScheduleNote')}</p>}
      <div className="lhead">
        <span className="lring" style={{ '--p': ringPct }} title={ringPct + '%'} role="img" aria-label={ringPct + '%'}>
          <span className="lavatar">{me && me.avatar_url ? <img src={API + me.avatar_url} alt="" /> : <b>{me ? (me.full_name || '?')[0] : '?'}</b>}</span>
        </span>
        <div className="ltiles">
          <div className="ltile"><Icon name="trophy" size={26} className="lt-g" /><span><b>{rk.group_rank ? '#' + rk.group_rank : '–'}</b><small>{t('hwGroupRank')}</small></span></div>
          <div className="ltile"><Icon name="trophy" size={26} className="lt-b" /><span><b>{rk.global_rank ? '#' + rk.global_rank : '–'}</b><small>{t('hwOverallRank')}</small></span></div>
          <div className="ltile"><Icon name="star" size={26} fill="currentColor" className="lt-y" /><span><b>{me ? me.points : 0}</b><small>{t('points')}</small></span></div>
          <div className="ltile"><Icon name="users" size={26} className="lt-o" /><span><b className="grpn">{grpName || '–'}</b><small>{t('hwLevel')}</small></span></div>
        </div>
      </div>
      {err && <div className="err">{err}</div>}
      {!list && !err && <p className="muted">{t('loading')}</p>}
      {list && noGroup && <p className="muted">{t('notInGroup')}</p>}
      {list && !noGroup && !anyContent && <p className="muted">{t('noHomework')}</p>}
      {list && !noGroup && (
        <>
          <div className="lrail" ref={rail} onScroll={onScroll}>
            {flat.map((it) => {
              const s = unitState(it, nowMs); const h = it.h;
              const grad = it.kind === 'exam' ? undefined : GRADS[(parseInt(it.label, 10) - 1 + 4) % 4 || 0];
              const stars = s.state === 'open' ? starsFor(s.pct) : 0;
              return (
                <button key={it.key} type="button" className={'lcard' + (it.i === sel ? ' cur' : '') + (s.state !== 'open' ? ' lockd' : '') + (it.kind === 'exam' ? ' exam' : '')} style={grad ? { background: grad } : undefined} onClick={() => clickCard(it)}>
                  <b className="lnum">{it.kind === 'exam' ? <Icon name="trophy" size={46} /> : it.label}</b>
                  <span className="lname">{it.kind === 'exam' ? t('finalExam') : h ? h.title : t('notPublished')}</span>
                  <small className="ldate">{it.kind === 'exam' ? t('examMainSpeaking') : h ? longDay(h.due_date) : ' '}</small>
                  <span className="lstars">{[0, 1, 2].map((k) => <Icon key={k} name="star" size={k === 1 ? 64 : 46} strokeWidth={1.4} fill={k < stars ? '#ffcc00' : 'rgba(255,255,255,.25)'} className={'lstar s' + k} />)}</span>
                  {s.state === 'open'
                    ? <span className="lpct"><i style={{ width: s.pct + '%' }} /><em>{s.pct}%</em></span>
                    : (
                      <span className="lpctwrap">
                        <span className={'lpct lockd' + (s.state === 'live' ? ' live' : '')}>{s.state === 'live' && <i className="red" style={{ width: Math.round(s.left * 100) + '%' }} />}<em><Icon name="lock" size={22} /></em></span>
                        <small className="lcount">{s.state === 'locked' || s.state === 'live' ? fmtCountdown(s.remaining) : t('comingSoon')}</small>
                      </span>
                    )}
                </button>
              );
            })}
          </div>
          {(() => {
            const n = flat.length, W = 13; const a0 = n <= W ? 0 : Math.min(Math.max((sel === null ? 0 : sel) - 6, 0), n - W);
            return (
              <div className="ldots" role="tablist" aria-label={t('lessons')}>
                {flat.slice(a0, a0 + W).map((it) => (
                  <button key={it.key} type="button" role="tab" aria-selected={it.i === sel} aria-label={it.kind === 'exam' ? t('finalExam') : it.label} className={'ldot' + (it.i === sel ? ' on' : '')} onClick={() => { setSel(it.i); centre(it.i); }} />
                ))}
              </div>
            );
          })()}
        </>
      )}
      {info && <LockInfo it={info} nowMs={nowMs} onClose={() => setInfo(null)} />}
      {saved && <SavedWords onClose={() => setSaved(false)} />}
    </div>
  );
}

/* Dashboard page (admin: create + manage; teacher: read-only list + progress) */
export const HomeworkPage = HomeworkStaff;

/* =====================  Student: Coins / Points pages (earned per homework, click for the breakdown)  ===================== */
const PART_NAME = { vocab: 'hwPartVocab', video: 'hwPartVideo', exercises: 'hwExercises' };
export function StudentRewards({ mode = 'coins' }) {
  const [d, setD] = useState(null);
  const [other, setOther] = useState([]);
  const [err, setErr] = useState('');
  const [sel, setSel] = useState(null);
  const isCoins = mode === 'coins';
  useEffect(() => {
    api('/api/homework/coins').then(setD).catch((x) => setErr(apiError(x)));
    api('/api/points/me').then((r) => setOther(r.filter((x) => !String(x.reason).startsWith('homework:') && Number(isCoins ? x.coins_delta : x.points_delta) !== 0))).catch(() => {});
  }, [mode]);
  const val = (o) => (isCoins ? o.coins : o.points);
  const max = (o) => (isCoins ? o.max_coins : o.max_points);
  const unitName = (r) => `${r.unit ? t('unitWord') + ' ' + r.unit + ' · ' : ''}${r.title}`;
  return (
    <div className="dcard">
      <h3><Icon name={isCoins ? 'coins' : 'star'} size={20} /> {isCoins ? t('coins') : t('points')}</h3>
      {err && <div className="err">{err}</div>}
      {!d && !err && <p className="muted">{t('loading')}</p>}
      {d && (
        <>
          <div className="rewtotal"><Icon name={isCoins ? 'coins' : 'star'} size={30} fill={isCoins ? 'none' : 'currentColor'} /><b>{isCoins ? d.total_coins : d.total_points}</b><small className="muted">{isCoins ? t('hwCoinsNote') : t('hwPointsNote')}</small></div>
          {d.rows.length === 0 && <p className="muted">{t('noHomework')}</p>}
          <div className="rewtable">
            {d.rows.map((r) => (
              <button key={r.id} type="button" className="rewrow" onClick={() => setSel(r)}>
                <span className="rewname"><b>{unitName(r)}</b><small className="muted">{longDay(r.due_date)}</small></span>
                <span className="rewnum">{val(r)}<small className="muted"> / {max(r)}</small></span>
                <Icon name="chevR" size={16} />
              </button>
            ))}
            {other.map((o) => (
              <div key={o.id} className="rewrow static"><span className="rewname"><b>{o.reason}</b><small className="muted">{new Date(o.created_at).toLocaleDateString()}</small></span><span className="rewnum">{Number(isCoins ? o.coins_delta : o.points_delta) > 0 ? '+' : ''}{isCoins ? o.coins_delta : o.points_delta}</span></div>
            ))}
          </div>
        </>
      )}
      {sel && (
        <Modal title={unitName(sel)} onClose={() => setSel(null)}>
          <p className="muted small">{t('hwBreakdown')}</p>
          {sel.parts.map((p) => (
            <div key={p.part} className={'drow' + (p.done ? '' : ' undone')}>
              <span className="ico-inline"><Icon name={p.done ? 'ok' : 'lock'} size={16} /> {t(PART_NAME[p.part])}</span>
              <span>{p.done ? <b>+{isCoins ? p.coins : p.points}</b> : <span className="muted">0 / {isCoins ? p.max_coins : p.max_points}</span>}</span>
            </div>
          ))}
          <div className="drow"><b>{t('hwTotal')}</b><b>{val(sel)} / {max(sel)}</b></div>
        </Modal>
      )}
    </div>
  );
}
