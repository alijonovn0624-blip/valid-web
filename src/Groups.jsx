import { useEffect, useRef, useState } from 'react';
import { api, API } from './api';
import { Icon } from './icons.jsx';
import { t, locale, apiError } from './i18n.js';

/* Private group chats. Every request is authorised on the server by membership; the group id in these calls is never trusted. */
const fmtTime = (d) => new Date(d).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
const fmtDay = (d) => new Date(d).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' });
const fmtSize = (n) => (!n ? '' : n < 1048576 ? Math.max(1, Math.round(n / 1024)) + ' KB' : (n / 1048576).toFixed(1) + ' MB');
const fmtDur = (s) => `${Math.floor((s || 0) / 60)}:${String((s || 0) % 60).padStart(2, '0')}`;
const roleLabel = (r) => (r === 'admin' ? t('roleAdmin') : r === 'teacher' ? t('roleTeacher') : t('roleStudent'));
const kindLabel = (k) => ({ image: t('kPhoto'), video: t('kVideo'), file: t('kFile'), voice: t('kVoice') }[k] || '');

function Av({ u, size = 38 }) {
  const st = { width: size, height: size, fontSize: size * 0.42 };
  return u.avatar_url
    ? <img className="gav" style={st} src={API + u.avatar_url} alt="" />
    : <span className="gav ph" style={st}>{(u.full_name || u.name || '?')[0]}</span>;
}
const Back = ({ onClick }) => <button type="button" className="gback" onClick={onClick} aria-label={t('back')}><Icon name="back" size={20} /></button>;

function Linkify({ text }) {
  const parts = String(text).split(/(https?:\/\/[^\s<>"']+)/gi);
  return <>{parts.map((p, i) => (/^https?:\/\//i.test(p) ? <a key={i} href={p} target="_blank" rel="noopener noreferrer">{p}</a> : <span key={i}>{p}</span>))}</>;
}

function Viewer({ m, onClose }) {
  return (
    <div className="gviewer" onClick={onClose}>
      <button type="button" className="gclose" onClick={onClose} aria-label={t('close')}><Icon name="close" size={22} /></button>
      <div onClick={(e) => e.stopPropagation()}>
        {m.kind === 'video' ? <video src={API + m.file_url} controls autoPlay /> : <img src={API + m.file_url} alt="" />}
      </div>
    </div>
  );
}

/* ---------- group cards (teacher: assigned groups, student: my groups, admin: all / per teacher) ---------- */
function GroupCards({ teacherId, onOpen }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [s, setS] = useState('');
  useEffect(() => {
    const load = () => api('/api/community/groups' + (teacherId ? '?teacherId=' + teacherId : '')).then((r) => { setRows(r); setErr(''); }).catch((x) => setErr(apiError(x)));
    load(); const id = setInterval(load, 10000); return () => clearInterval(id);
  }, [teacherId]);
  const list = (rows || []).filter((g) => !s.trim() || g.name.toLowerCase().includes(s.trim().toLowerCase()));
  return (
    <div className="gscroll">
      <input placeholder={t('search')} value={s} onChange={(e) => setS(e.target.value)} />
      {err && <div className="err">{err}</div>}
      {!rows && !err && <p className="muted">{t('loading')}</p>}
      {rows && list.length === 0 && <p className="muted">{t('noGroupsChat')}</p>}
      {list.map((g) => (
        <button type="button" key={g.id} className="gcard" onClick={() => onOpen(g)}>
          <Av u={g} size={48} />
          <span className="gcbody">
            <b>{g.name}</b>
            <small>{g.student_count} {t('studentsLower')}{g.teacher_name ? ' · ' + g.teacher_name : ''}</small>
            <small className="gprev">{g.last_at ? `${g.last_name ? g.last_name + ': ' : ''}${g.last_kind === 'text' ? g.last_body : kindLabel(g.last_kind)}` : t('noMessagesShort')}</small>
          </span>
          <span className="gmeta">{g.last_at && <small>{fmtTime(g.last_at)}</small>}{g.unread > 0 && <span className="badge">{g.unread}</span>}</span>
        </button>
      ))}
    </div>
  );
}

function TeacherCards({ onOpen }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [s, setS] = useState('');
  useEffect(() => {
    const id = setTimeout(() => api('/api/community/teachers?search=' + encodeURIComponent(s)).then((r) => { setRows(r); setErr(''); }).catch((x) => setErr(apiError(x))), 250);
    return () => clearTimeout(id);
  }, [s]);
  return (
    <div className="gscroll">
      <input placeholder={t('search')} value={s} onChange={(e) => setS(e.target.value)} />
      {err && <div className="err">{err}</div>}
      {!rows && !err && <p className="muted">{t('loading')}</p>}
      {rows && rows.length === 0 && <p className="muted">{t('noTeachers')}</p>}
      {(rows || []).map((u) => (
        <button type="button" key={u.id} className="gcard" onClick={() => onOpen(u)}>
          <Av u={u} size={48} />
          <span className="gcbody"><b>{u.full_name}</b><small>{u.group_count} {t('groupsLower')}</small></span>
          <Icon name="chevR" size={18} />
        </button>
      ))}
    </div>
  );
}

/* ---------- chat ---------- */
function GroupChat({ me, group, onBack, onInfo, onMember }) {
  const [msgs, setMsgs] = useState(null);
  const [pending, setPending] = useState([]);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [view, setView] = useState(null);
  const [rec, setRec] = useState(null);
  const endRef = useRef(null), lastId = useRef(0), tick = useRef(0), fileRef = useRef(null), recRef = useRef(null);
  const base = `/api/community/groups/${group.id}`;
  const markRead = () => api(base + '/read', { method: 'POST' }).catch(() => {});
  const merge = (cur, add) => { const seen = new Set(cur.map((x) => x.id)); return [...cur, ...add.filter((x) => !seen.has(x.id))]; };
  const load = async (full) => {
    try {
      const rows = await api(base + '/messages' + (!full && lastId.current ? '?after=' + lastId.current : ''));
      if (full) setMsgs(rows); else if (rows.length) setMsgs((c) => merge(c || [], rows));
      if (rows.length) { lastId.current = Math.max(lastId.current, ...rows.map((r) => r.id)); if (rows.some((r) => !r.mine)) markRead(); }
      setErr('');
    } catch (x) { setErr(apiError(x)); if (x.code === 'NOT_FOUND') setMsgs([]); }
  };
  useEffect(() => {
    load(true).then(markRead);
    const id = setInterval(() => { if (document.hidden) return; tick.current += 1; load(tick.current % 5 === 0); }, 3000); // polling; every 5th tick re-syncs deletions
    return () => { clearInterval(id); stopTracks(); };
  }, [group.id]);
  useEffect(() => { if (endRef.current) endRef.current.scrollIntoView(); }, [msgs && msgs.length, pending.length]);

  const post = async (fd, preview) => {
    const tmp = 'tmp' + Date.now() + Math.random();
    setPending((p) => [...p, { id: tmp, state: 'sending', ...preview, fd }]);
    try {
      const m = await api(base + '/messages', { method: 'POST', body: fd });
      setPending((p) => p.filter((x) => x.id !== tmp));
      setMsgs((c) => merge(c || [], [m])); lastId.current = Math.max(lastId.current, m.id);
    } catch (x) { setPending((p) => p.map((q) => (q.id === tmp ? { ...q, state: 'failed', error: apiError(x) } : q))); }
  };
  const sendText = (e) => {
    e.preventDefault();
    const body = text.trim(); if (!body) return;
    setText(''); const fd = new FormData(); fd.append('body', body); post(fd, { kind: 'text', body });
  };
  const onFile = (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    if (f.size > 25 * 1048576) return setErr(t('fileTooBig'));
    const fd = new FormData(); fd.append('file', f);
    post(fd, { kind: f.type.startsWith('image/') ? 'image' : f.type.startsWith('video/') ? 'video' : 'file', file_name: f.name, file_size: f.size });
  };
  const retry = (p) => { setPending((c) => c.filter((x) => x.id !== p.id)); post(p.fd, { kind: p.kind, body: p.body, file_name: p.file_name, file_size: p.file_size }); };
  const del = async (m) => {
    if (!confirm(t('deleteMsgQ'))) return;
    try { await api(`${base}/messages/${m.id}`, { method: 'DELETE' }); setMsgs((c) => c.filter((x) => x.id !== m.id)); } catch (x) { setErr(apiError(x)); }
  };

  /* voice recording */
  function stopTracks() { const r = recRef.current; if (r && r.stream) r.stream.getTracks().forEach((tr) => tr.stop()); if (r && r.timer) clearInterval(r.timer); }
  const startRec = async () => {
    setErr('');
    if (!navigator.mediaDevices || !window.MediaRecorder) return setErr(t('micUnsupported'));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks = []; const state = { stream, mr, chunks, secs: 0, cancelled: false, mime: mr.mimeType || mime || 'audio/webm' };
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      mr.onstop = () => {
        stopTracks();
        if (!state.cancelled && chunks.length) {
          const type = state.mime.split(';')[0];
          const fd = new FormData(); fd.append('file', new Blob(chunks, { type }), 'voice.' + (type.includes('mp4') ? 'm4a' : 'webm')); fd.append('kind', 'voice'); fd.append('duration', String(state.secs));
          post(fd, { kind: 'voice', duration: state.secs });
        }
        recRef.current = null; setRec(null);
      };
      state.timer = setInterval(() => { state.secs += 1; setRec({ secs: state.secs }); if (state.secs >= 600) mr.stop(); }, 1000);
      recRef.current = state; mr.start(); setRec({ secs: 0 });
    } catch { setErr(t('micDenied')); }
  };
  const endRec = (cancel) => { const s = recRef.current; if (!s) return; s.cancelled = cancel; if (s.mr.state !== 'inactive') s.mr.stop(); };

  const canMod = me.role !== 'student';
  const all = [...(msgs || []), ...pending];
  let lastDay = '';
  return (
    <div className="gwrap">
      <div className="ghead">
        <Back onClick={onBack} />
        <button type="button" className="ghinfo" onClick={onInfo}><Av u={group} size={38} /><span><b>{group.name}</b><small>{t('tapForInfo')}</small></span></button>
      </div>
      <div className="chatbody msgs">
        {!msgs && !err && <p className="muted">{t('loading')}</p>}
        {msgs && all.length === 0 && <p className="muted">{t('noMessages')}</p>}
        {all.map((m) => {
          const day = m.created_at ? fmtDay(m.created_at) : ''; const sep = day && day !== lastDay; if (day) lastDay = day;
          const mine = m.mine || m.state;
          return (
            <div key={m.id} className="gm">
              {sep && <div className="gday">{day}</div>}
              <div className={'gmsg ' + (mine ? 'me' : '')}>
                {!mine && <button type="button" className="gsend" onClick={() => m.sender_id && onMember(m.sender_id)} disabled={!m.sender_id}><Av u={m} size={26} /></button>}
                <div className="gbubble">
                  {!mine && <small className="who2">{m.full_name}{m.role !== 'student' ? ' · ' + roleLabel(m.role) : ''}</small>}
                  {m.kind === 'image' && m.file_url && <img className="gimg" src={API + m.file_url} alt="" loading="lazy" onClick={() => setView(m)} />}
                  {m.kind === 'video' && m.file_url && <video className="gimg" src={API + m.file_url} controls preload="metadata" />}
                  {m.kind === 'voice' && m.file_url && <div className="gvoice"><audio src={API + m.file_url} controls preload="none" /><small>{fmtDur(m.duration)}</small></div>}
                  {m.kind === 'file' && (m.file_url
                    ? <a className="gfile" href={API + m.file_url} download={m.file_name}><Icon name="file" size={20} /><span><b>{m.file_name}</b><small>{fmtSize(m.file_size)}</small></span></a>
                    : <span className="gfile"><Icon name="file" size={20} /><span><b>{m.file_name}</b></span></span>)}
                  {!m.file_url && m.state && m.kind !== 'text' && m.kind !== 'file' && <span className="gfile"><Icon name={m.kind === 'voice' ? 'mic' : 'image'} size={18} /> {kindLabel(m.kind)}</span>}
                  {m.body && <div className="gtext"><Linkify text={m.body} /></div>}
                  <small className="gtime">
                    {m.state === 'sending' && <>{t('sending')}…</>}
                    {m.state === 'failed' && <span className="err">{m.error} <a onClick={() => retry(m)}>{t('retry')}</a> · <a onClick={() => setPending((c) => c.filter((x) => x.id !== m.id))}>{t('remove')}</a></span>}
                    {!m.state && fmtTime(m.created_at)}
                    {(m.mine || canMod) && !m.state && <button type="button" className="mdel" onClick={() => del(m)} aria-label={t('remove')}><Icon name="trash" size={13} /></button>}
                  </small>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      {err && <div className="err" style={{ padding: '0 16px' }}>{err}</div>}
      {rec ? (
        <div className="chatform recbar">
          <span className="recdot" /> <b>{fmtDur(rec.secs)}</b><span className="muted">{t('recording')}</span>
          <button type="button" className="gbtn" onClick={() => endRec(true)} aria-label={t('cancel')}><Icon name="trash" size={18} /></button>
          <button type="button" className="gbtn send" onClick={() => endRec(false)} aria-label={t('send')}><Icon name="send" size={18} /></button>
        </div>
      ) : (
        <form className="chatform" onSubmit={sendText}>
          <input ref={fileRef} type="file" hidden onChange={onFile} accept="image/*,video/mp4,video/webm,video/quicktime,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip" />
          <button type="button" className="gbtn" onClick={() => fileRef.current && fileRef.current.click()} aria-label={t('attach')}><Icon name="clip" size={20} /></button>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('typeMessage')} maxLength={2000} />
          {text.trim()
            ? <button className="gbtn send" aria-label={t('send')}><Icon name="send" size={18} /></button>
            : <button type="button" className="gbtn" onClick={startRec} aria-label={t('recordVoice')}><Icon name="mic" size={20} /></button>}
        </form>
      )}
      {view && <Viewer m={view} onClose={() => setView(null)} />}
    </div>
  );
}

/* ---------- group information (Telegram-style) ---------- */
function GroupInfo({ me, group, onBack, onMember, onChanged }) {
  const [info, setInfo] = useState(null);
  const [members, setMembers] = useState(null);
  const [tab, setTab] = useState('members');
  const [shared, setShared] = useState({});
  const [s, setS] = useState('');
  const [err, setErr] = useState('');
  const [view, setView] = useState(null);
  const base = `/api/community/groups/${group.id}`;
  const loadInfo = () => api(base).then(setInfo).catch((x) => setErr(apiError(x)));
  useEffect(() => { loadInfo(); api(base + '/members').then(setMembers).catch((x) => setErr(apiError(x))); }, [group.id]);
  useEffect(() => {
    if (tab === 'members' || shared[tab]) return;
    api(`${base}/shared?type=${tab}`).then((r) => setShared((c) => ({ ...c, [tab]: r }))).catch((x) => setErr(apiError(x)));
  }, [tab]);
  const upPhoto = async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    const fd = new FormData(); fd.append('file', f);
    try { await api(base + '/avatar', { method: 'POST', body: fd }); loadInfo(); onChanged && onChanged(); } catch (x) { setErr(apiError(x)); }
  };
  const list = shared[tab];
  const mem = (members || []).filter((m) => !s.trim() || m.full_name.toLowerCase().includes(s.trim().toLowerCase()));
  const tabs = [['members', 'users', t('membersTab')], ['media', 'image', t('mediaTab')], ['files', 'file', t('filesTab')], ['voice', 'mic', t('voiceTab')], ['links', 'link', t('linksTab')]];
  return (
    <div className="gwrap">
      <div className="ghead"><Back onClick={onBack} /><b>{t('groupInfo')}</b></div>
      <div className="gscroll">
        {err && <div className="err">{err}</div>}
        {!info && !err && <p className="muted">{t('loading')}</p>}
        {info && (
          <div className="ginfohead">
            <Av u={info} size={92} />
            {me.role === 'admin' && <label className="gphoto"><Icon name="edit" size={14} /> {t('changePhoto')}<input type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={upPhoto} /></label>}
            <h2>{info.name}</h2>
            {info.description && <p className="muted">{info.description}</p>}
            <small className="muted">{info.member_count} {t('membersLower')}</small>
            {info.teacher && (
              <button type="button" className="gcard slim" onClick={() => onMember(info.teacher.id)}>
                <Av u={info.teacher} size={36} /><span className="gcbody"><small>{t('roleTeacher')}</small><b>{info.teacher.full_name}</b></span><Icon name="chevR" size={16} />
              </button>
            )}
          </div>
        )}
        <div className="gtabs">{tabs.map(([k, ic, lb]) => <button type="button" key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}><Icon name={ic} size={16} /> {lb}</button>)}</div>
        {tab === 'members' && (
          <>
            <input placeholder={t('searchMembers')} value={s} onChange={(e) => setS(e.target.value)} />
            {!members && <p className="muted">{t('loading')}</p>}
            {mem.map((m) => (
              <button type="button" key={m.id} className="gcard slim" onClick={() => onMember(m.id)}>
                <Av u={m} size={38} /><span className="gcbody"><b>{m.full_name}</b></span><span className={'rolechip ' + m.role}>{roleLabel(m.role)}</span>
              </button>
            ))}
          </>
        )}
        {tab !== 'members' && !list && !err && <p className="muted">{t('loading')}</p>}
        {tab !== 'members' && list && list.length === 0 && <p className="muted">{t('nothingShared')}</p>}
        {tab === 'media' && list && list.length > 0 && (
          <div className="gmedia">{list.map((m) => (
            <button type="button" key={m.id} onClick={() => setView(m)}>{m.kind === 'video' ? <video src={API + m.file_url} preload="metadata" muted /> : <img src={API + m.file_url} alt="" loading="lazy" />}{m.kind === 'video' && <i><Icon name="play" size={18} /></i>}</button>
          ))}</div>
        )}
        {tab === 'files' && list && list.map((m) => (
          <a key={m.id} className="gcard slim" href={API + m.file_url} download={m.file_name}><Icon name="file" size={22} /><span className="gcbody"><b>{m.file_name}</b><small>{fmtSize(m.file_size)} · {m.full_name} · {fmtDay(m.created_at)}</small></span><Icon name="download" size={16} /></a>
        ))}
        {tab === 'voice' && list && list.map((m) => (
          <div key={m.id} className="gcard slim static"><span className="gcbody"><small>{m.full_name} · {fmtDay(m.created_at)} {fmtTime(m.created_at)} · {fmtDur(m.duration)}</small><audio src={API + m.file_url} controls preload="none" /></span></div>
        ))}
        {tab === 'links' && list && list.map((l, i) => (
          <a key={i} className="gcard slim" href={l.url} target="_blank" rel="noopener noreferrer"><Icon name="link" size={20} /><span className="gcbody"><b className="gurl">{l.url}</b><small>{l.full_name} · {fmtDay(l.created_at)}</small></span></a>
        ))}
      </div>
      {view && <Viewer m={view} onClose={() => setView(null)} />}
    </div>
  );
}

function MemberProfile({ uid, onBack }) {
  const [p, setP] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api(`/api/community/users/${uid}/profile`).then(setP).catch((x) => setErr(apiError(x))); }, [uid]);
  return (
    <div className="gwrap">
      <div className="ghead"><Back onClick={onBack} /><b>{t('profile')}</b></div>
      <div className="gscroll">
        {err && <div className="err">{err}</div>}
        {!p && !err && <p className="muted">{t('loading')}</p>}
        {p && (
          <div className="ginfohead">
            <Av u={p} size={96} /><h2>{p.full_name}</h2><span className={'rolechip ' + p.role}>{roleLabel(p.role)}</span>
            {p.groups.length > 0 && <div className="gshared"><small className="muted">{t('sharedGroups')}</small>{p.groups.map((g) => <span key={g.id} className="fchipg">{g.name}</span>)}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- navigation: list -> (teacher ->) chat <-> info -> member ---------- */
export function GroupsHome({ me }) {
  const [stack, setStack] = useState([{ n: 'list' }]);
  const [tab, setTab] = useState('teachers');
  const top = stack[stack.length - 1];
  const push = (v) => setStack((s) => [...s, v]);
  const pop = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  if (top.n === 'chat') return <GroupChat me={me} group={top.g} onBack={pop} onInfo={() => push({ n: 'info', g: top.g })} onMember={(uid) => push({ n: 'member', uid })} />;
  if (top.n === 'info') return <GroupInfo me={me} group={top.g} onBack={pop} onMember={(uid) => push({ n: 'member', uid })} />;
  if (top.n === 'member') return <MemberProfile uid={top.uid} onBack={pop} />;
  if (top.n === 'teacher') {
    return (
      <div className="gwrap"><div className="ghead"><Back onClick={pop} /><Av u={top.u} size={34} /><b>{top.u.full_name}</b></div>
        <GroupCards teacherId={top.u.id} onOpen={(g) => push({ n: 'chat', g })} /></div>
    );
  }
  if (me.role === 'admin') {
    return (
      <div className="gwrap">
        <div className="seg" style={{ padding: '8px 16px 0' }}>
          <button className={tab === 'teachers' ? 'on' : ''} onClick={() => setTab('teachers')}><Icon name="teachers" size={16} /> {t('teachers')}</button>
          <button className={tab === 'groups' ? 'on' : ''} onClick={() => setTab('groups')}><Icon name="groups" size={16} /> {t('groups')}</button>
        </div>
        {tab === 'teachers' ? <TeacherCards onOpen={(u) => push({ n: 'teacher', u })} /> : <GroupCards onOpen={(g) => push({ n: 'chat', g })} />}
      </div>
    );
  }
  return <div className="gwrap"><GroupCards onOpen={(g) => push({ n: 'chat', g })} /></div>;
}
