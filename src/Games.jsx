import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api.js';
import { t, apiError } from './i18n.js';
import { Icon } from './icons.jsx';
import { WordImg } from './WordPicture.jsx';

// Three small games built from the student's own vocabulary (GET /api/homework/game-words).
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const tx = (w) => ((localStorage.getItem('lang') || 'en') === 'ru' ? (w.ru || w.uz) : (w.uz || w.ru)) || '';

function Done({ score, total, onAgain, onBack }) {
  return (
    <div className="gm-done">
      <Icon name="trophy" size={46} className="gold" />
      <h3>{score}/{total}</h3>
      <p className="muted">{score === total ? t('gmPerfect') : t('gmWellDone')}</p>
      <div className="acts" style={{ justifyContent: 'center' }}>
        <button className="dbtn" onClick={onAgain}><Icon name="undo" size={16} /> {t('gmAgain')}</button>
        <button className="dbtn ghost" onClick={onBack}>{t('back')}</button>
      </div>
    </div>
  );
}

// ---- Word Match: tap an English word and its translation ----
function Match({ words, onBack }) {
  const mk = () => { const pick = shuffle(words).slice(0, 6); return { pairs: pick, left: shuffle(pick), right: shuffle(pick) }; };
  const [g, setG] = useState(mk);
  const [a, setA] = useState(null); const [b, setB] = useState(null);
  const [okIds, setOk] = useState([]); const [bad, setBad] = useState(false); const [moves, setMoves] = useState(0);
  const lock = useRef(false);
  const choose = (side, w) => {
    if (lock.current || okIds.includes(w.id)) return;
    const na = side === 'a' ? w : a, nb = side === 'b' ? w : b;
    setA(na); setB(nb);
    if (na && nb) {
      setMoves((m) => m + 1);
      if (na.id === nb.id) { setOk((o) => [...o, na.id]); setA(null); setB(null); }
      else { lock.current = true; setBad(true); setTimeout(() => { setA(null); setB(null); setBad(false); lock.current = false; }, 650); }
    }
  };
  const again = () => { setG(mk()); setOk([]); setA(null); setB(null); setMoves(0); };
  if (okIds.length === g.pairs.length) return <Done score={g.pairs.length} total={g.pairs.length} onAgain={again} onBack={onBack} />;
  const cls = (side, w) => 'gm-tile' + (okIds.includes(w.id) ? ' ok' : (side === 'a' ? a : b) && (side === 'a' ? a : b).id === w.id ? (bad ? ' bad' : ' sel') : '');
  return (
    <div>
      <p className="muted small" style={{ textAlign: 'center' }}>{t('gmMatchHint')} · {okIds.length}/{g.pairs.length} · {moves}</p>
      <div className="gm-match">
        <div>{g.left.map((w) => <button key={w.id} type="button" className={cls('a', w)} onClick={() => choose('a', w)}>{w.word}</button>)}</div>
        <div>{g.right.map((w) => <button key={w.id} type="button" className={cls('b', w)} onClick={() => choose('b', w)}>{tx(w)}</button>)}</div>
      </div>
    </div>
  );
}

// ---- Quick Quiz: pick the translation of the English word (10 questions) ----
function Quiz({ words, onBack }) {
  const mk = () => shuffle(words).slice(0, 10).map((w) => ({ w, opts: shuffle([w, ...shuffle(words.filter((x) => x.id !== w.id && tx(x) !== tx(w))).slice(0, 3)]) }));
  const [qs, setQs] = useState(mk); const [i, setI] = useState(0); const [pick, setPick] = useState(null); const [score, setScore] = useState(0);
  const again = () => { setQs(mk()); setI(0); setPick(null); setScore(0); };
  if (i >= qs.length) return <Done score={score} total={qs.length} onAgain={again} onBack={onBack} />;
  const q = qs[i];
  const answer = (o) => { if (pick) return; setPick(o.id); if (o.id === q.w.id) setScore((s) => s + 1); };
  return (
    <div className="gm-quiz">
      <div className="mcqbar"><i style={{ width: Math.round((i / qs.length) * 100) + '%' }} /></div>
      <p className="muted small" style={{ textAlign: 'center' }}>{i + 1}/{qs.length}</p>
      <div className="gm-pic"><WordImg url={q.w.image_url} provider={q.w.image_provider} size={96} word={q.w.word} /></div>
      <h3 className="gm-q">{q.w.word}</h3>
      <div className="gm-opts">
        {q.opts.map((o) => <button key={o.id} type="button" className={'gm-tile' + (pick ? (o.id === q.w.id ? ' ok' : o.id === pick ? ' bad' : '') : '')} onClick={() => answer(o)}>{tx(o)}</button>)}
      </div>
      {pick && <button type="button" className="dbtn gm-next" autoFocus onClick={() => { setPick(null); setI(i + 1); }}>{t('continueBtn')}</button>}
    </div>
  );
}

// ---- Word Scramble: build the English word from shuffled letters ----
function Scramble({ words, onBack }) {
  const usable = useMemo(() => words.filter((w) => w.word.replace(/\s/g, '').length >= 3), [words]);
  const mk = () => shuffle(usable).slice(0, 8).map((w) => { const L = [...w.word.replace(/\s/g, '')]; let s = shuffle(L.map((c, k) => ({ c, k }))); if (L.length > 1 && s.map((x) => x.c).join('') === L.join('')) s = [...s].reverse(); return { w, letters: s }; });
  const [qs, setQs] = useState(mk); const [i, setI] = useState(0); const [used, setUsed] = useState([]); const [fb, setFb] = useState(null); const [score, setScore] = useState(0);
  const again = () => { setQs(mk()); setI(0); setUsed([]); setFb(null); setScore(0); };
  if (!qs.length) return <p className="muted">{t('gmNoWords')}</p>;
  if (i >= qs.length) return <Done score={score} total={qs.length} onAgain={again} onBack={onBack} />;
  const q = qs[i]; const target = q.w.word.replace(/\s/g, '');
  const built = used.map((k) => q.letters.find((x) => x.k === k).c).join('');
  const add = (x) => { if (fb || used.includes(x.k)) return; const nu = [...used, x.k]; setUsed(nu); if (nu.length === q.letters.length) { const ok = nu.map((k) => q.letters.find((y) => y.k === k).c).join('').toLowerCase() === target.toLowerCase(); setFb(ok ? 'ok' : 'bad'); if (ok) setScore((s) => s + 1); } };
  const nextQ = () => { setUsed([]); setFb(null); setI(i + 1); };
  return (
    <div className="gm-quiz">
      <div className="mcqbar"><i style={{ width: Math.round((i / qs.length) * 100) + '%' }} /></div>
      <p className="muted small" style={{ textAlign: 'center' }}>{i + 1}/{qs.length}</p>
      <div className="gm-pic"><WordImg url={q.w.image_url} provider={q.w.image_provider} size={96} word={q.w.word} /></div>
      <h3 className="gm-q">{tx(q.w)}</h3>
      <div className={'twboxes' + (fb === 'ok' ? ' good' : fb === 'bad' ? ' wrong' : '')}>
        {q.letters.map((_, k) => <span key={k} className={'twbox' + (built[k] ? ' has' : '')}>{built[k] || ''}</span>)}
      </div>
      <div className="gm-letters">
        {q.letters.map((x) => <button key={x.k} type="button" className="gm-letter" disabled={used.includes(x.k) || !!fb} onClick={() => add(x)}>{x.c}</button>)}
      </div>
      <div className="acts" style={{ justifyContent: 'center' }}>
        {!fb && <button type="button" className="dbtn ghost" disabled={!used.length} onClick={() => setUsed(used.slice(0, -1))}><Icon name="undo" size={16} /> {t('gmUndo')}</button>}
        {fb === 'bad' && <span className="twright">{t('rightWas')}: <b>{q.w.word}</b></span>}
        {fb && <button type="button" className="dbtn gm-next" autoFocus onClick={nextQ}>{t('continueBtn')}</button>}
      </div>
    </div>
  );
}

const GAMES = { gWordMatch: Match, gQuickQuiz: Quiz, gScramble: Scramble };

export default function Games({ game, onBack, onPick, onVocab }) {
  const key = GAMES[game] ? game : null;
  const [words, setWords] = useState(null); const [err, setErr] = useState('');
  useEffect(() => { if (!key) return; api('/api/homework/game-words').then((r) => setWords(r.words || [])).catch((e) => { setErr(apiError(e)); setWords([]); }); }, [key]);
  if (!key) return (
    <div className="dcard gm">
      <div className="hwtop"><h3 className="hwtitle">{t('gmPick')}</h3></div>
      <div className="gm-hub">{[['gWordMatch', 'target'], ['gQuickQuiz', 'zap'], ['gScramble', 'shuffle']].map(([k, ic]) => <button key={k} type="button" onClick={() => onPick && onPick(k)}><Icon name={ic} size={34} />{t(k)}</button>)}</div>
    </div>
  );
  const G = GAMES[key];
  return (
    <div className="dcard gm">
      <div className="hwtop"><h3 className="hwtitle">{t(key)}</h3></div>
      {err && <div className="err">{err}</div>}
      {words === null ? <p className="muted">{t('loading')}</p>
        : words.length < 3 ? <><p className="muted">{t('gmNoWords')}</p>{onVocab && <button type="button" className="dbtn" onClick={onVocab}>{t('gmOpenVocab')}</button>}</>
        : <G words={words} onBack={onBack} />}
    </div>
  );
}
