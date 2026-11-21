import { useEffect, useRef, useState } from 'react';
import { api, API } from './api';
import Chat from './Chat.jsx';
import Settings from './Settings.jsx';
import { Ranking } from './Ranking.jsx';
import { StudentHomework, StudentRewards, SavedWords } from './Homework.jsx';
import Dashboard from './Dashboard.jsx';
import { t, setLang, LANGS, apiError, locale } from './i18n.js';
import { Icon, AppIcon, Status } from './icons.jsx';
import { useCountdown, CountdownText, Stat, Ava } from './ui.jsx';

const fmt = (d) => new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

/* ---------- Login / Register / Email tasdiqlash ---------- */
function Login({ onDone, theme, setTheme, lang, changeLang }) {
  const [mode, setMode] = useState('login'); // login | register | verify | pending
  const [f, setF] = useState({ fullName: '', email: '', password: '', promoCode: '' });
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [left, startTimer] = useCountdown();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  // Faqat server haqiqatan yuborganini tasdiqlasa "yuborildi" deyiladi; kutish vaqti serverdan keladi
  const delivery = (d) => {
    if (d.resendIn !== undefined) startTimer(d.resendIn);
    if (d.emailSent) setInfo(`${t('sentTo')} ${f.email}`);
    else if (d.devMode) setErr(t('devNote'));
    else setErr(t('codeNotSent'));
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setInfo('');
    if (mode !== 'verify' && !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(f.email.trim())) return setErr(t('emailInvalid'));
    if (busy) return;
    setBusy(true);
    try {
      if (mode === 'register') {
        const body = { ...f };
        if (!body.promoCode.trim()) delete body.promoCode;
        const r = await api('/api/auth/register', { method: 'POST', body });
        if (r.status === 'ok') { localStorage.setItem('token', r.token); onDone(); }
        else setMode('pending');
      } else if (mode === 'verify') {
        const r = await api('/api/auth/verify-email', { method: 'POST', body: { email: f.email, code } });
        if (r.status === 'ok') { localStorage.setItem('token', r.token); onDone(); }
        else setMode('pending');
      } else {
        const r = await api('/api/auth/login', { method: 'POST', body: { email: f.email, password: f.password } });
        localStorage.setItem('token', r.token);
        onDone();
      }
    } catch (x) {
      if (x.code === 'EMAIL_NOT_VERIFIED') {
        setMode('verify');
        const d = x.data || {};
        if (d.resendIn !== undefined) startTimer(d.resendIn);
        if (d.devMode) setErr(t('devNote'));
        else if (d.emailSent === false) setErr(t('codeNotSent'));
        else setInfo(`${t('sentTo')} ${f.email}`);
      } else if (x.code === 'PENDING_APPROVAL') setMode('pending');
      else setErr(apiError(x));
    }
    setBusy(false);
  };
  const resend = async () => {
    if (left > 0 || busy) return;
    setErr(''); setInfo(''); setBusy(true);
    try { delivery(await api('/api/auth/resend-code', { method: 'POST', body: { email: f.email } })); }
    catch (x) { if (x.data && x.data.resendIn !== undefined) startTimer(x.data.resendIn); setErr(apiError(x)); }
    setBusy(false);
  };
  const tools = (
    <div className="logintools">
      <select value={lang} onChange={(e) => changeLang(e.target.value)}>
        {LANGS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
      </select>
      <button type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="theme">{theme === 'dark' ? <Icon name="moon" size={20} /> : <Icon name="sun" size={20} />}</button>
    </div>
  );

  if (mode === 'pending')
    return (
      <div className="center authbg">{tools}<div className="card login">
        <h1 className="ico-inline"><Icon name="pending" size={28} /> {t('pendingTitle2')}</h1>
        <p className="muted">{t('pendingText')}</p>
        <button className="btn" onClick={() => { setMode('login'); setErr(''); setInfo(''); }}>{t('toLogin')}</button>
      </div></div>
    );

  return (
    <div className="center authbg">
      {tools}
      <form className="card login" onSubmit={submit}>
        <h1>Valid EduAction</h1>
        {mode === 'verify' ? (
          <>
            <p className="muted">{t('verifyPrompt')} <b>{f.email}</b></p>
            <input inputMode="numeric" maxLength={6} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} required style={{ letterSpacing: 8, textAlign: 'center', fontSize: 22 }} />
          </>
        ) : (
          <>
            <p className="muted">Keep learning, keep growing!</p>
            {mode === 'register' && <input placeholder={t('fullName')} value={f.fullName} onChange={set('fullName')} required />}
            <input type="email" placeholder={t('email')} value={f.email} onChange={set('email')} required />
            <input type="password" placeholder={t('passwordPh')} value={f.password} onChange={set('password')} required />
            {mode === 'register' && <input placeholder={t('promoPh')} value={f.promoCode} onChange={set('promoCode')} />}
          </>
        )}
        {info && <div className="note">{info}</div>}
        {err && <div className="err">{err}</div>}
        <button className="btn" disabled={busy}>{mode === 'register' ? t('registerBtn') : mode === 'verify' ? t('verifyBtn') : t('loginBtn')}</button>
        {mode === 'verify' && (
          <>
            <button type="button" className="btn ghost" disabled={left > 0 || busy} onClick={resend}>
              {left > 0 ? <>{t('resendIn')} <CountdownText seconds={left} /></> : t('resend')}
            </button>
            <a className="link" onClick={() => { setMode('register'); setErr(''); setInfo(''); setCode(''); }}>{t('changeEmail')}</a>
          </>
        )}
        <a className="link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(''); setInfo(''); }}>
          {mode === 'login' ? t('noAccount') : t('haveAccount')}
        </a>
      </form>
    </div>
  );
}

/* ---------- Story viewer ---------- */
function StoryViewer({ stories, start, onClose, isAdmin, onDeleted }) {
  const [i, setI] = useState(start);
  const [list, setList] = useState(stories);
  const s = list[i];
  useEffect(() => { api(`/api/stories/${s.id}/view`, { method: 'POST' }).catch(() => {}); }, [s.id]);
  const next = () => (i + 1 < list.length ? setI(i + 1) : onClose());
  const prev = () => i > 0 && setI(i - 1);
  const del = async () => {
    if (!confirm("Story o'chirilsinmi?")) return;
    await api(`/api/stories/${s.id}`, { method: 'DELETE' });
    onDeleted(s.id);
    const nl = list.filter((x) => x.id !== s.id);
    if (!nl.length) return onClose();
    setList(nl);
    setI(Math.min(i, nl.length - 1));
  };
  const like = async () => {
    const r = await api(`/api/stories/${s.id}/like`, { method: 'POST' });
    setList(list.map((x, k) => (k === i ? { ...x, liked: r.liked, likes: x.likes + (r.liked ? 1 : -1) } : x)));
  };
  return (
    <div className="viewer" onClick={onClose}>
      <div className="story" onClick={(e) => e.stopPropagation()}>
        <div className="bars">{list.map((_, k) => <span key={k} className={k <= i ? 'on' : ''} />)}</div>
        <button className="x" onClick={onClose} aria-label="close"><Icon name="close" size={20} /></button>
        {isAdmin && <button className="del" onClick={del} aria-label="delete"><Icon name="trash" size={16} /></button>}
        {s.media_type === 'video'
          ? <video src={API + s.media_url} autoPlay controls playsInline />
          : <img src={API + s.media_url} alt="" />}
        <div className="cap">
          {s.title && <b>{s.title}</b>}
          {s.caption && <p>{s.caption}</p>}
        </div>
        <div className="nav"><span onClick={prev} /><span onClick={next} /></div>
        <button className="like" onClick={like}><Icon name="heart" size={18} fill={s.liked ? 'currentColor' : 'none'} /> {s.likes}</button>
      </div>
    </div>
  );
}

/* ---------- Events (gorizontal) ---------- */
function EventRow({ events, user, reload }) {
  const [msg, setMsg] = useState('');
  const toggle = async (e) => {
    setMsg('');
    try { await api(`/api/events/${e.id}/register`, { method: e.joined ? 'DELETE' : 'POST' }); reload(); }
    catch (x) { setMsg(x.message); }
  };
  const del = async (e) => {
    if (!confirm("Event o'chirilsinmi?")) return;
    try { await api(`/api/events/${e.id}`, { method: 'DELETE' }); reload(); }
    catch (x) { setMsg(x.message); }
  };
  if (!events.length) return <p className="muted">Hozircha eventlar yo'q</p>;
  return (
    <>
      {msg && <div className="err">{msg}</div>}
      <div className="evrow">
        {events.map((e) => (
          <div key={e.id} className="evcard" style={e.cover_url ? { backgroundImage: `url(${API + e.cover_url})` } : undefined}>
            {user.role === 'admin' && <button className="del" onClick={() => del(e)} aria-label="delete"><Icon name="trash" size={16} /></button>}
            <div className="evinfo">
              <span className="tag">{e.category}</span>
              <b>{e.title}</b>
              <small className="ico-inline"><Icon name="calendar" size={14} /> {fmt(e.starts_at)}</small>
              {e.location && <small className="ico-inline"><Icon name="pin" size={14} /> {e.location}</small>}
              <small className="ico-inline"><Icon name="users" size={14} /> {e.registered}{e.max_participants ? ' / ' + e.max_participants : ''}</small>
              {user.role === 'student' && (
                <button className={'btn ' + (e.joined ? 'ghost' : '')} onClick={() => toggle(e)}>
                  {e.joined ? 'Bekor qilish' : 'Join'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------- Home ---------- */
/* Student dashboard (computer): progress, events, ranking, stories, vocabulary and achievements — all from real data */
function HomeDesktop({ user, nav, onHomework }) {
  const [hw, setHw] = useState(null);
  const [events, setEvents] = useState(null);
  const [rank, setRank] = useState({});
  const [board, setBoard] = useState(null);
  const [stories, setStories] = useState([]);
  const [saved, setSaved] = useState(null);
  const [savedOpen, setSavedOpen] = useState(false);
  const [openStory, setOpenStory] = useState(null);
  useEffect(() => {
    api('/api/homework').then(setHw).catch(() => setHw([]));
    api('/api/events').then(setEvents).catch(() => setEvents([]));
    api('/api/points/ranking').then(setRank).catch(() => {});
    api('/api/points/leaderboard?scope=group').then(setBoard).catch(() => setBoard([]));
    api('/api/stories').then(setStories).catch(() => {});
    api('/api/homework/saved/words').then((w) => setSaved(w.length)).catch(() => setSaved(0));
  }, []);
  const list = (hw || []).filter((h) => h.exercise_count > 0 || h.word_count > 0 || h.has_video);
  const openTasks = list.filter((h) => (!h.lesson || h.lesson.state === 'open') && (h.pct ?? 0) < 100).length;
  const overall = list.length ? Math.round(list.reduce((s, h) => s + (h.pct ?? 0), 0) / list.length) : 0;
  const part = (key, has) => { const l = list.filter(has); return { n: l.length, done: l.filter((h) => (h.my_parts || []).includes(key)).length }; };
  const parts = [[t('hwVocab'), part('vocab', (h) => h.word_count > 0)], [t('hwVideoLesson'), part('video', (h) => h.has_video)], [t('hwExercises'), part('exercises', (h) => h.exercise_count > 0)]];
  const st = (p) => (p.n === 0 ? ['–', 'idle'] : p.done === p.n ? [t('hwCompleted'), 'ok'] : p.done > 0 ? [`${t('inProgress')} · ${p.done} / ${p.n}`, 'run'] : [t('notStarted'), 'idle']);
  const upcoming = (events || []).filter((e) => new Date(e.starts_at) >= new Date(Date.now() - 3600000)).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)).slice(0, 2);
  const top = (board || []).slice(0, 3);
  const exDone = list.reduce((s, h) => s + (h.my_correct || 0), 0);
  const badges = [
    ['trophy', t('achFirst'), rank.group_rank === 1],
    ['flame', t('achStreak'), (user.streak_days || 0) >= 7],
    ['homework', t('achExercises'), exDone >= 100],
    ['star', t('achPerfect'), list.some((h) => (h.pct ?? 0) >= 100)],
  ];
  const fmtDay = (d) => new Date(d).toLocaleDateString(locale(), { month: 'short', day: 'numeric' });
  const fmtHm = (d) => new Date(d).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="sh">
      <div className="sh-stats">
        <button type="button" className="shcard" onClick={() => nav && nav('points')}><AppIcon name="points" size={44} /><span><small>{t('points')}</small><b>{user.points}</b></span></button>
        <button type="button" className="shcard" onClick={() => nav && nav('coins')}><span className="sh-coin"><Icon name="coins" size={26} /></span><span><small>{t('coins')}</small><b>{user.coins}</b></span></button>
        <button type="button" className="shcard" onClick={() => nav && nav('ranking')}><AppIcon name="ranking" size={44} /><span><small>{t('ranking')}</small><b>#{rank.group_rank ?? '-'} <em>{t('inGroup')}</em></b></span>{rank.group_rank === 1 && <Icon name="crown" size={30} className="sh-crown" />}</button>
        <button type="button" className="shcard" onClick={onHomework}><AppIcon name="homework" size={44} /><span><small>{t('myHomework')}</small><b>{openTasks} <em>{t('hwTasks')}</em></b></span><Icon name="chevR" size={20} className="sh-go" /></button>
      </div>
      <div className="sh-row3">
        <section className="shpanel">
          <div className="shph"><b><Icon name="flame" size={18} /> {t('yourProgress')}</b><span className="shbig">{overall}%</span></div>
          <div className="shbar"><i style={{ width: overall + '%' }} /></div>
          <div className="shparts">{parts.map(([name, p]) => { const [txt, cls] = st(p); return <div key={name} className="shpart"><span className={'shdot ' + cls}>{cls === 'ok' && <Icon name="check" size={12} />}</span><span>{name}</span><em className={cls}>{txt}</em></div>; })}</div>
        </section>
        <section className="shpanel">
          <div className="shph"><b><Icon name="calendar" size={18} /> {t('upcomingEvents')}</b><a onClick={() => nav && nav('events')}>{t('seeAll')} <Icon name="next" size={14} /></a></div>
          {events && upcoming.length === 0 && <p className="muted">{t('noUpcoming')}</p>}
          {upcoming.map((e) => (
            <div key={e.id} className="shev"><span className="shdate"><small>{new Date(e.starts_at).toLocaleDateString(locale(), { month: 'short' }).toUpperCase()}</small><b>{new Date(e.starts_at).getDate()}</b></span>
              <span className="shevt"><b>{e.title}</b><small><Icon name="clock" size={13} /> {fmtHm(e.starts_at)}</small>{e.location && <small><Icon name="pin" size={13} /> {e.location}</small>}</span>
              <button type="button" className="shgo" onClick={() => nav && nav('events')} aria-label={t('seeAll')}><Icon name="next" size={16} /></button></div>
          ))}
        </section>
        <section className="shpanel">
          <div className="shph"><b><Icon name="trophy" size={18} /> {t('ranking')}</b><a onClick={() => nav && nav('ranking')}>{t('seeAll')} <Icon name="next" size={14} /></a></div>
          {board && top.length === 0 && <p className="muted">{t('noApproved')}</p>}
          {top.map((u, k) => (
            <div key={u.id} className={'shrk' + (u.id === user.id ? ' me' : '')}><span className={'shmedal m' + (k + 1)}>{k + 1}</span><Ava u={u} size={32} /><b>{u.full_name}</b><em>{u.points} {t('pts')}</em></div>
          ))}
          {rank.group_rank && <div className="shyou"><Icon name="crown" size={18} /> {t('youAre')} #{rank.group_rank}</div>}
        </section>
      </div>
      <div className="sh-row3">
        <section className="shpanel">
          <div className="shph"><b><Icon name="stories" size={18} /> {t('stories')}</b></div>
          {stories.length === 0 && <p className="muted">{t('noStory')}</p>}
          <div className="shstories">{stories.slice(0, 4).map((s, i) => (
            <button type="button" key={s.id} className="shst" onClick={() => setOpenStory(i)}>
              {s.media_type === 'image' ? <img src={API + s.media_url} alt="" /> : <span className="vid"><Icon name="play" size={24} /></span>}
              <span>{s.title || s.category}</span></button>
          ))}</div>
        </section>
        <section className="shpanel">
          <div className="shph"><b><Icon name="bookmark" size={18} /> {t('vocabLists')}</b></div>
          <div className="shvocab"><span><small>{t('myVocabulary')}</small><b>{saved === null ? '–' : saved} <em>{t('hwWords')}</em></b></span>
            <button type="button" className="dbtn startbtn" onClick={() => setSavedOpen(true)}>{t('view')} <Icon name="next" size={14} /></button></div>
        </section>
        <section className="shpanel">
          <div className="shph"><b><Icon name="medal" size={18} /> {t('achievements')}</b></div>
          <div className="shbadges">{badges.map(([ic, name, got]) => <span key={name} className={'shbadge' + (got ? ' got' : '')}><i><Icon name={ic} size={26} /></i><small>{name}</small></span>)}</div>
        </section>
      </div>
      {savedOpen && <SavedWords onClose={() => setSavedOpen(false)} />}
      {openStory !== null && <StoryViewer stories={stories} start={openStory} isAdmin={false} onDeleted={(id) => setStories((x) => x.filter((y) => y.id !== id))} onClose={() => setOpenStory(null)} />}
    </div>
  );
}

function Home({ user, desktop, nav, onHomework, onGo }) {
  const [stories, setStories] = useState([]);
  const [events, setEvents] = useState([]);
  const [rank, setRank] = useState({});
  const [hw, setHw] = useState(null);
  const [open, setOpen] = useState(null);
  const loadEvents = () => api('/api/events').then(setEvents).catch(() => {});
  useEffect(() => {
    if (!desktop) { api('/api/stories').then(setStories).catch(() => {}); loadEvents(); }
    api('/api/points/ranking').then(setRank).catch(() => {});
    api('/api/homework').then((l) => { const x = l.find((y) => y.exercise_count > 0 && (!y.lesson || y.lesson.state === 'open')); setHw(x ? { ...x, pct: Math.round((x.my_correct / x.exercise_count) * 100) } : false); }).catch(() => setHw(false));
  }, []);
  const hwLabel = hw ? (hw.unit ? `${t('unitWord')} ${hw.unit}` : hw.title) : t('noHomework');
  if (desktop) return <HomeDesktop user={user} nav={nav} onHomework={onHomework} />;
  return (
    <div className="shome">
      <div className="shead">
        {user.avatar_url ? <img className="mini" src={API + user.avatar_url} alt="" /> : <span className="mini ph">{(user.full_name || '?')[0]}</span>}
        <div><b>{user.full_name}</b><small className="muted">{t('hello')}!</small></div>
      </div>
      <div className="row">
        {stories.length === 0 && <span className="muted">{t('noStory')}</span>}
        {stories.map((s, i) => (
          <div key={s.id} className="st" onClick={() => setOpen(i)}>
            <div className={'ring ' + (s.seen ? 'seen' : '')}>
              {s.media_type === 'image' ? <img src={API + s.media_url} alt="" /> : <span className="ico-inline"><Icon name="play" size={22} /></span>}
            </div>
            <small>{s.title || s.category}</small>
          </div>
        ))}
      </div>
      <div className="stiles">
        <div className="tile soft c1">
          <button type="button" className="tilebtn" onClick={() => onGo && onGo('coins')}><Icon name="coins" size={30} className="gold" /><b>{user.coins}</b><small>{t('coins')}</small></button>
          <button type="button" className="tilebtn" onClick={() => onGo && onGo('points')}><Icon name="star" size={30} className="gold" fill="currentColor" /><b>{user.points}</b><small>{t('points')}</small></button>
        </div>
        <div className="tile soft c2" role="button" tabIndex={0} onClick={() => onGo && onGo('ranking')} style={{ cursor: 'pointer' }}><Icon name="trophy" size={26} className="grn" /><b>#{rank.group_rank ?? '-'}</b><small>{t('inGroup')} · {t('ranking')}</small></div>
        <button type="button" className="tile hw" onClick={onHomework}>
          <span className="hwt">{t('myHomework')}</span><small>{hwLabel}</small>
          <b className="hwbig">{hw ? hw.pct + '%' : ''}</b><Icon name="homework" size={92} className="hwbg" strokeWidth={1.2} />
        </button>
      </div>
      <h3>{t('events')}</h3>
      <EventRow events={events} user={user} reload={loadEvents} />
      {open !== null && (
        <StoryViewer stories={stories} start={open} isAdmin={false}
          onDeleted={(id) => setStories((st) => st.filter((x) => x.id !== id))} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}
function Events({ user }) {
  const [list, setList] = useState([]);
  const load = () => api('/api/events').then(setList).catch(() => {});
  useEffect(() => { load(); }, []);
  return (
    <>
      <h2>{t('events')}</h2>
      <EventRow events={list} user={user} reload={load} />
    </>
  );
}

/* ---------- Ranking ---------- */
/* ---------- Admin / Teacher ---------- */
// Stories va Events formalari ALOHIDA komponentlar: har bir menyu faqat o'zinikini chizadi.
function useRun() {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (fn) => {
    setMsg(''); setBusy(true);
    try { await fn(); setMsg('✅ Saqlandi'); } catch (x) { setMsg('❌ ' + x.message); }
    setBusy(false);
  };
  return [msg, busy, run];
}

export function StoryForm({ onCreated }) {
  const [msg, busy, run] = useRun();
  const sendStory = (e) => {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    run(async () => { await api('/api/stories', { method: 'POST', body: fd }); form.reset(); onCreated && onCreated(); });
  };
  return (
    <form className="card" onSubmit={sendStory}>
      <h3>Yangi story</h3>
      {msg && <div className="note"><Status msg={msg} /></div>}
      <input type="file" name="file" accept="image/jpeg,image/png,video/mp4" required />
      <input name="title" placeholder="Sarlavha (ixtiyoriy)" />
      <textarea name="caption" maxLength={200} placeholder="Izoh (200 belgigacha)" />
      <select name="category">
        <option value="admin">Admin</option><option value="events">Events</option>
        <option value="tips">Tips</option><option value="news">News</option><option value="quiz">Quiz</option>
      </select>
      <label className="muted">{t('expiresIn')}</label>
      <select name="expiresIn" defaultValue="24h">
        <option value="24h">{t('exp24h')}</option><option value="3d">{t('exp3d')}</option><option value="7d">{t('exp7d')}</option><option value="1m">{t('exp1m')}</option>
      </select>
      <button className="btn" disabled={busy}>{busy ? '…' : 'Publish'}</button>
    </form>
  );
}

export function EventForm({ onCreated }) {
  const [msg, busy, run] = useRun();
  const sendEvent = (e) => {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    fd.set('startsAt', new Date(fd.get('startsAt')).toISOString());
    if (!fd.get('maxParticipants')) fd.delete('maxParticipants');
    const c = fd.get('cover');
    if (!c || !c.size) fd.delete('cover');
    run(async () => { await api('/api/events', { method: 'POST', body: fd }); form.reset(); onCreated && onCreated(); });
  };
  return (
    <form className="card" onSubmit={sendEvent}>
      <h3>Yangi event</h3>
      {msg && <div className="note"><Status msg={msg} /></div>}
      <label className="muted">Rasm (JPG, PNG, WEBP)</label>
      <input type="file" name="cover" accept="image/jpeg,image/png,image/webp" />
      <input name="title" placeholder="Nomi" required />
      <select name="category">
        <option>Speaking Club</option><option>Reading</option><option>Workshop</option><option>Movie</option>
      </select>
      <input type="datetime-local" name="startsAt" required />
      <input name="location" placeholder="Joylashuv" />
      <textarea name="description" placeholder="Tavsif" />
      <input type="number" name="maxParticipants" placeholder="Maks. ishtirokchilar" />
      <label className="muted">{t('expiresIn')}</label>
      <select name="expiresIn" defaultValue="1m">
        <option value="24h">{t('exp24h')}</option><option value="3d">{t('exp3d')}</option><option value="7d">{t('exp7d')}</option><option value="1m">{t('exp1m')}</option>
      </select>
      <button className="btn" disabled={busy}>{busy ? '…' : 'Event yaratish'}</button>
    </form>
  );
}

// Mobil "Admin" tabi (alohida ko'rinish): ikkala forma bir joyda — bu o'z sahifasi, menyu routing emas
function Admin() {
  return (<><h2>Admin panel</h2><StoryForm /><EventForm /></>);
}

/* ---------- Profile ---------- */
function Profile({ user, reload }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const change = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBusy(true); setErr('');
    const fd = new FormData();
    fd.append('avatar', file);
    try { await api('/api/auth/avatar', { method: 'POST', body: fd }); await reload(); }
    catch (x) { setErr(x.message); }
    setBusy(false);
  };
  return (
    <>
      <h2>Profile</h2>
      <div className="card">
        {user.avatar_url
          ? <img className="avatar" src={API + user.avatar_url} alt="" />
          : <div className="avatar" style={{ display: 'grid', placeItems: 'center', }}><Icon name="user" size={40} strokeWidth={1.5} /></div>}
        <label className="btn ghost" style={{ textAlign: 'center' }}>
          {busy ? 'Yuklanmoqda…' : "Rasmni o'zgartirish"}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={change} hidden />
        </label>
        {err && <div className="err">{err}</div>}
        <b>{user.full_name}</b>
        <small>{user.email}</small>
        <small>Rol: {user.role} · Daraja: {user.level}</small>
        <small className="ico-inline"><Icon name="flame" size={15} /> Streak: {user.streak_days} kun</small>
        <button className="btn ghost" onClick={() => { localStorage.removeItem('token'); location.reload(); }}>Chiqish</button>
      </div>
    </>
  );
}

/* ---------- Dashboard uchun: stories + events (hamma ko'radi; yaratish/o'chirish faqat admin) ---------- */
function Feed({ user, nav }) {
  const [stories, setStories] = useState([]);
  const [events, setEvents] = useState([]);
  const [open, setOpen] = useState(null);
  const [dot, setDot] = useState(0);
  const rail = useRef(null);
  const isAdmin = user.role === 'admin';
  const loadEvents = () => api('/api/events').then(setEvents).catch(() => {});
  useEffect(() => { api('/api/stories').then(setStories).catch(() => {}); loadEvents(); }, []);
  const scrollBy = (dir) => { if (rail.current) rail.current.scrollBy({ left: dir * rail.current.clientWidth * 0.9, behavior: 'smooth' }); };
  const onScroll = () => { const el = rail.current; if (el && el.scrollWidth > el.clientWidth) setDot(Math.round((el.scrollLeft / (el.scrollWidth - el.clientWidth)) * 3)); };
  const book = async (e) => {
    try { await api(`/api/events/${e.id}/register`, { method: e.joined ? 'DELETE' : 'POST' }); loadEvents(); } catch (x) { alert(x.message); }
  };
  const delEvent = async (e) => {
    if (!confirm("Event o'chirilsinmi?")) return;
    try { await api(`/api/events/${e.id}`, { method: 'DELETE' }); loadEvents(); } catch (x) { alert(x.message); }
  };
  return (
    <div className="feedgrid">
      <section className="dcard feedstories">
        <h3>{t('stories')}</h3>
        {stories.length === 0 && <small className="muted">{t('noStory')}</small>}
        <div className="storyrow">
          {isAdmin && nav && <button type="button" className="createstory" onClick={() => nav('stories')}><Icon name="plus" size={22} /><span>{t('createStory')}</span></button>}
          {stories.map((s, i) => (
            <button type="button" key={s.id} className={'sthumb ' + (s.seen ? 'seen' : '')} onClick={() => setOpen(i)} title={s.title || s.category}>
              {s.media_type === 'image' ? <img src={API + s.media_url} alt="" /> : <span className="ico-inline"><Icon name="play" size={22} /></span>}
              <i>{(s.title || s.category || '?')[0]}</i>
            </button>
          ))}
        </div>
      </section>
      <section className="dcard feedevents">
        <div className="feedhead">
          <h3>{t('events')}</h3>
          <span className="feedctl">
            <span className="dots" aria-hidden="true">{[0, 1, 2, 3].map((d) => <i key={d} className={d === dot ? 'on' : ''} />)}</span>
            <button type="button" className="ctlbtn" onClick={() => scrollBy(-1)} aria-label="previous"><Icon name="prev" size={16} /></button>
            <button type="button" className="ctlbtn" onClick={() => scrollBy(1)} aria-label="next"><Icon name="chevR" size={16} /></button>
            {nav && <a className="seeall" onClick={() => nav('eventsall')}>{t('seeAll')} <Icon name="next" size={14} /></a>}
          </span>
        </div>
        {events.length === 0 && <small className="muted">{t('noEvents')}</small>}
        <div className="evrail" ref={rail} onScroll={onScroll}>
          {events.map((e) => (
            <article key={e.id} className="devcard">
              <div className="devimg" style={e.cover_url ? { backgroundImage: `url(${API + e.cover_url})` } : undefined}>
                <span className="tag">{e.category}</span>
                {isAdmin && <button type="button" className="del" onClick={() => delEvent(e)} aria-label="delete"><Icon name="trash" size={15} /></button>}
              </div>
              <div className="devbody">
                <b>{e.title}</b>
                <small className="ico-inline"><Icon name="calendar" size={14} /> {fmt(e.starts_at)}</small>
                {e.location && <small className="ico-inline"><Icon name="pin" size={14} /> {e.location}</small>}
                <small className="ico-inline"><Icon name="users" size={14} /> {e.registered}{e.max_participants ? ' / ' + e.max_participants : ''}</small>
                {user.role === 'student' && <button type="button" className={'dbtn' + (e.joined ? ' ghost' : '')} onClick={() => book(e)}>{e.joined ? t('cancelBooking') : t('bookEvent')}</button>}
              </div>
            </article>
          ))}
        </div>
      </section>
      {open !== null && (
        <StoryViewer stories={stories} start={open} isAdmin={isAdmin}
          onDeleted={(id) => setStories((st) => st.filter((x) => x.id !== id))} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}

/* ---------- Splash ---------- */
function Splash() {
  return (
    <div className="splash">
      <img src="/eagle-dark.jpg" alt="" />
      <div className="loadbar"><i /></div>
    </div>
  );
}

/* ---------- App ---------- */
function useMedia(q) {
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => { const mq = window.matchMedia(q); const f = () => setM(mq.matches); mq.addEventListener('change', f); f(); return () => mq.removeEventListener('change', f); }, [q]);
  return m;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('home');
  const [ready, setReady] = useState(false);
  const [splashOn, setSplashOn] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [view, setView] = useState('dash');
  const desktop = useMedia('(min-width: 900px)');
  const [hwDeep, setHwDeep] = useState(false);
  const [unread, setUnread] = useState(0);
  const [lang, setL] = useState(localStorage.getItem('lang') || 'uz');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const changeLang = (l) => { setLang(l); setL(l); };
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('theme', theme); }, [theme]);
  useEffect(() => {
    if (!user) return;
    const f = () => api('/api/chat/unread').then((r) => setUnread(r.count)).catch(() => {});
    f();
    const id = setInterval(f, 15000);
    return () => clearInterval(id);
  }, [user && user.id, chatOpen]);
  useEffect(() => { const t = setTimeout(() => setSplashOn(false), 1800); return () => clearTimeout(t); }, []);
  const [netErr, setNetErr] = useState(false);
  const loadMe = async () => {
    // The token is removed ONLY when the server says it is invalid (401/403). Network errors / a restarting backend keep the session.
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const u = await api('/api/auth/me');
        setNetErr(false); setUser(u);
        if (u.language) { setLang(u.language); setL(u.language); }
        if (u.theme) setTheme(u.theme);
        setReady(true); return;
      } catch (x) {
        if (x.status === 401 || x.status === 403) { localStorage.removeItem('token'); setUser(null); setReady(true); return; }
        await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
      }
    }
    setNetErr(true); setReady(true);
  };
  useEffect(() => { localStorage.getItem('token') ? loadMe() : setReady(true); }, []);

  if (!ready || splashOn) return <Splash />;
  if (netErr) return (<div className="app"><main><h2>{t('netErr')}</h2><button className="btn" onClick={() => { setNetErr(false); setReady(false); loadMe(); }}>{t('retryBtn')}</button></main></div>);
  if (!user) return <Login onDone={loadMe} theme={theme} setTheme={setTheme} lang={lang} changeLang={changeLang} />;

  const staff = user.role !== 'student';
  if ((staff && view === 'dash') || (!staff && desktop))
    return (
      <>
        <Dashboard user={user} StoryForm={StoryForm} EventForm={EventForm} Feed={Feed} StudentHome={Home} StudentRanking={Ranking} onHwDeep={setHwDeep} hwDeep={hwDeep} unread={unread} onChat={() => setChatOpen(true)}
          reload={loadMe} theme={theme} setTheme={setTheme} lang={lang} changeLang={changeLang} />
        {chatOpen && <Chat me={user} onClose={() => setChatOpen(false)} />}
      </>
    );
  const tabs = [['home', 'home', t('home')], ['events', 'events', t('events')], ['ranking', 'trophy', t('ranking')],
    ...(user.role === 'student' ? [['homework', 'homework', t('homework')]] : []),
    ...(user.role === 'admin' ? [['admin', 'settings', 'Admin']] : []), ...(staff ? [['dash', 'dash', 'Dashboard']] : []), ['profile', 'user', t('profile')]];
  return (
    <div className="app" data-lang={lang}>
      <div className="topbar">
        <button className="chatbtn" onClick={() => setChatOpen(true)} aria-label="chat">
          <Icon name="chat" size={20} />{unread > 0 && <i>{unread > 9 ? '9+' : unread}</i>}
        </button>
      </div>
      <main>
        {tab !== 'home' && !(tab === 'homework' && hwDeep) && <button type="button" className="btn ghost backbtn" onClick={() => setTab('home')}><Icon name="back" size={16} /> {t('back')}</button>}
        {tab === 'home' && <Home user={user} onHomework={() => setTab('homework')} onGo={setTab} />}
        {tab === 'events' && <Events user={user} />}
        {tab === 'ranking' && <Ranking me={user} />}
        {tab === 'coins' && <StudentRewards mode="coins" />}
        {tab === 'points' && <StudentRewards mode="points" />}
        {tab === 'homework' && user.role === 'student' && <StudentHomework me={user} onDeep={setHwDeep} />}
        {tab === 'admin' && user.role === 'admin' && <Admin />}
        {tab === 'profile' && <Settings user={user} reload={loadMe} theme={theme} setTheme={setTheme} lang={lang} changeLang={changeLang} />}
      </main>
      <nav>
        {tabs.map(([k, ic, label]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => (k === 'dash' ? setView('dash') : setTab(k))}>
            <span><Icon name={ic} size={22} /></span>{label}
          </button>
        ))}
      </nav>
      {chatOpen && <Chat me={user} onClose={() => setChatOpen(false)} />}
    </div>
  );
}
