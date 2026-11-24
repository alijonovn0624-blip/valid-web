import { useEffect, useMemo, useRef, useState } from 'react';
import { api, API } from './api';
import { t, locale, apiError } from './i18n.js';
import Settings from './Settings.jsx';
import { Thread } from './Chat.jsx';
import { LogoutDialog, LangPanel, HelpPanel } from './Dialogs.jsx';

import { StudentsPage, DayAttendancePage, RankingsPage, AnalyticsPage, StudentProfile, GroupsPage, TeachersPage, EventsAllPage, Modal } from './Pages.jsx';
import { Icon, AppIcon, Status } from './icons.jsx';
import { nextTheme, themeIcon, themeKey } from './theme.js';
import Games from './Games.jsx';
import { VocabStudent, VocabAdmin } from './Vocab.jsx';
import StudentHomeNew, { greeting } from './StudentHome.jsx';
import { HomeworkStaff, HomeworkMatrix, StudentHomework, StudentRewards } from './Homework.jsx';
import { Ava, Stat, iso, dayLabel, longDay, relName, addDays, rateText } from './ui.jsx';

const NAV = [
  ['home', 'home'], ['students', 'students'], ['progress', 'progress'], ['attendance', 'attendance'], ['groups', 'groups'], ['community', 'community'],
  ['stories', 'stories'], ['events', 'events'], ['homework', 'homework'], ['grades', 'grades'], ['courses', 'courses'],
  ['battles', 'battles'], ['coins', 'coins'], ['teachers', 'teachers'],
];
const LIVE = ['home', 'students', 'progress', 'attendance', 'groups', 'dayatt', 'rankings', 'analytics', 'community', 'stories', 'events', 'eventsall', 'homework', 'ranking', 'points', 'coins', 'teachers', 'promo', 'profile', 'settings', 'games', 'vocab'];
const ST = { present: 'P', late: 'L', absent: 'A', excused: 'E' };
const NEXT = { '': 'present', present: 'late', late: 'absent', absent: '', excused: '' };

/* ---------- Davomat jadvali ---------- */
function AttendanceTable({ groups, gid, setGid, showArchived, to: toProp, setTo: setToProp, title }) {
  const [data, setData] = useState({ days: [], students: [] });
  // The API returns newest-first; the table shows oldest -> newest (left to right). Only the display order changes.
  const days = useMemo(() => [...data.days].reverse(), [data.days]);
  const wrapRef = useRef(null);
  useEffect(() => { const el = wrapRef.current; if (el) el.scrollLeft = el.scrollWidth; }, [data.days, data.students.length]); // keep the newest day in view on narrow screens
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState({});
  const today = iso(new Date());
  const [toLocal, setToLocal] = useState(today);
  const to = toProp || toLocal;
  const cur = data.days.includes(to) ? to : (data.days[0] || to); // the day shown for absence notes
  const setTo = setToProp || setToLocal;
  const load = () => {
    if (!gid) { setData({ days: [], students: [] }); return; }
    setLoading(true);
    api(`/api/teacher/attendance?groupId=${gid}&to=${to}&days=10`).then((d) => { setData(d); setErr(''); }).catch((x) => setErr(apiError(x))).finally(() => setLoading(false));
  };
  useEffect(load, [gid, to]);
  // Absence explanations (context only): shown next to the student's name while taking attendance
  const [notes, setNotes] = useState({});
  const [noteDlg, setNoteDlg] = useState(null);
  const loadNotes = () => {
    if (!gid || !data.days.length) { setNotes({}); return; }
    const from = data.days[data.days.length - 1], toD = data.days[0];
    api(`/api/teacher/absence-notes?from=${from}&to=${toD}&groupId=${gid}`)
      .then((rows) => { const m = {}; rows.forEach((n) => { m[n.student_id + '|' + n.date] = n; }); setNotes(m); }).catch(() => setNotes({}));
  };
  useEffect(loadNotes, [gid, data]);
  const saveNote = async (del) => {
    setNoteDlg((n) => ({ ...n, busy: true, err: '' }));
    try {
      if (del) await api(`/api/teacher/absence-notes?studentId=${noteDlg.s.id}&date=${noteDlg.date}`, { method: 'DELETE' });
      else await api('/api/teacher/absence-notes', { method: 'PUT', body: { studentId: noteDlg.s.id, date: noteDlg.date, reason: noteDlg.reason, caption: noteDlg.caption } });
      setNoteDlg(null); loadNotes();
    } catch (x) { setNoteDlg((n) => ({ ...n, busy: false, err: apiError(x) })); }
  };
  const openNote = (s, day) => { const ex = notes[s.id + '|' + day]; setNoteDlg({ s, date: day, reason: ex ? ex.reason : 'illness', caption: ex ? ex.caption || '' : '', exists: !!ex }); };
  const NOTE_ICON = { illness: 'illness', event: 'calendarClock', other: 'note' };
  const mark = async (s, day) => {
    const key = s.id + day;
    if (saving[key]) return;
    const prev = s.marks[day];
    const next = NEXT[prev || ''] ?? '';
    setErr(''); setOk('');
    setSaving((m) => ({ ...m, [key]: true }));
    setData((d) => ({ ...d, students: d.students.map((x) => (x.id === s.id ? { ...x, marks: { ...x.marks, [day]: next || undefined } } : x)) }));
    try {
      await api('/api/teacher/attendance', { method: 'POST', body: { groupId: Number(gid), studentId: s.id, date: day, status: next || null } });
      setOk(t('savedOk'));
    } catch (x) { setErr(apiError(x)); load(); }
    setSaving((m) => { const n = { ...m }; delete n[key]; return n; });
  };
  const gname = (groups.find((g) => String(g.id) === String(gid)) || {}).name || 'group';
  const exportCsv = () => {
    const rows = [['Student', ...days], ...data.students.map((s) => [s.full_name, ...days.map((d) => s.marks[d] || '')])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv' }));
    a.download = `attendance-${gname}-${data.days[data.days.length - 1] || ''}_${data.days[0] || ''}.csv`;
    a.click();
  };
  const active = groups.filter((g) => !g.archived_at), arch = groups.filter((g) => g.archived_at);
  return (
    <div className="dcard">
      {title && <h3 className="feedtitle"><Icon name="attendance" size={20} /> {t('attendance')}</h3>}
      <div className="dtools">
        <select value={gid} onChange={(e) => setGid(e.target.value)}>
          <option value="">{t('chooseGroup')}</option>
          {active.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.members})</option>)}
          {showArchived && arch.length > 0 && <optgroup label={t('archivedGroups')}>{arch.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.members})</option>)}</optgroup>}
        </select>
        <button className="dbtn ghost" disabled={data.scheduled && !data.prevTo} onClick={() => setTo(data.scheduled ? data.prevTo : addDays(to, -10))} aria-label={t('earlier')}><Icon name="prev" size={16} /> {t('earlier')}</button>
        <input type="date" value={to} max={data.scheduled ? undefined : today} onChange={(e) => e.target.value && setTo(e.target.value)} aria-label={t('pickDate')} style={{ flex: '0 0 auto' }} />
        <button className="dbtn ghost" disabled={data.scheduled ? !data.nextTo : to >= today} onClick={() => setTo(data.scheduled ? data.nextTo : (addDays(to, 10) > today ? today : addDays(to, 10)))}>{t('later')} <Icon name="chevR" size={16} /></button>
        <button className="dbtn ghost" onClick={exportCsv} disabled={!data.students.length}><Icon name="download" size={16} /> {t('exportReport')}</button>
      </div>
      <div aria-live="polite">
        {err && <div className="err">{err}</div>}
        {!err && ok && <div className="okmsg"><Icon name="ok" size={15} /> {ok}</div>}
        {loading && <small className="muted">{t('loading')}</small>}
      </div>
      {!gid && <p className="muted">{t('pickGroupFirst')}</p>}
      {gid && !loading && data.students.length === 0 && <p className="muted">{t('noStudentsInGroup')}</p>}
      {data.students.length > 0 && (
        <div className="tblwrap attwrap" ref={wrapRef}>
          <table className="att">
            <thead>
              <tr>
                <th className="left stick"><span className="ico-inline"><Icon name="users" size={16} /> {t('students')}</span></th>
                {days.map((d) => { const [a, b] = dayLabel(d); return <th key={d} className={'day ' + (d === today ? 'today' : '') + (d > today ? ' future' : '')}>{a}<br />{b}{data.times && data.times[d] && <small className="atime">{data.times[d]}</small>}</th>; })}
              </tr>
            </thead>
            <tbody>
              {data.students.map((s, i) => (
                <tr key={s.id}>
                  <td className="left stick"><span className="who"><em className="rown">{i + 1}</em><Ava u={s} /> <span className="nm">{s.full_name}</span>
                    {notes[s.id + '|' + cur] && <span className="notebadge" title={notes[s.id + '|' + cur].caption || ''}><Icon name={NOTE_ICON[notes[s.id + '|' + cur].reason]} size={13} /> {t('reason_' + notes[s.id + '|' + cur].reason)}</span>}
                    <button type="button" className="notebtn" onClick={() => openNote(s, cur)} aria-label={t('absenceNote')} title={t('absenceNote')}><Icon name="note" size={14} /></button></span></td>
                  {days.map((d) => (
                    <td key={d}><button className={'cell ' + (s.marks[d] || 'none') + (saving[s.id + d] ? ' saving' : '') + (notes[s.id + '|' + d] ? ' hasnote' : '')} disabled={!!saving[s.id + d] || d > today} onClick={() => mark(s, d)} aria-label={`${s.full_name} ${d}`} title={notes[s.id + '|' + d] ? `${t('reason_' + notes[s.id + '|' + d].reason)}${notes[s.id + '|' + d].caption ? ': ' + notes[s.id + '|' + d].caption : ''}` : undefined}>{ST[s.marks[d]] || ''}</button></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted" style={{ marginTop: 8 }}>{data.scheduled ? t('attHintSched') : t('attHint')}</p>
        </div>
      )}
      {noteDlg && (
        <Modal title={<span className="ico-inline"><Icon name="note" size={18} /> {t('absenceNote')}: {noteDlg.s.full_name}</span>} onClose={() => setNoteDlg(null)}>
          <p className="muted small">{t('noteContext')}</p>
          <label className="muted">{t('date')}
            <select value={noteDlg.date} onChange={(e) => { const dd = e.target.value; const ex = notes[noteDlg.s.id + '|' + dd]; setNoteDlg({ ...noteDlg, date: dd, reason: ex ? ex.reason : noteDlg.reason, caption: ex ? ex.caption || '' : '', exists: !!ex }); }}>
              {days.map((dd) => <option key={dd} value={dd}>{longDay(dd)}</option>)}
            </select>
          </label>
          <div className="chiprow" role="radiogroup" aria-label={t('absenceNote')}>
            {['illness', 'event', 'other'].map((r) => (
              <button type="button" key={r} role="radio" aria-checked={noteDlg.reason === r} className={'fchip btn' + (noteDlg.reason === r ? ' on' : '')} onClick={() => setNoteDlg({ ...noteDlg, reason: r })}><Icon name={NOTE_ICON[r]} size={15} /> {t('reason_' + r)}</button>
            ))}
          </div>
          <input value={noteDlg.caption} maxLength={200} placeholder={t('captionPh')} onChange={(e) => setNoteDlg({ ...noteDlg, caption: e.target.value })} />
          {noteDlg.err && <div className="err">{noteDlg.err}</div>}
          <span className="acts" style={{ marginTop: 12 }}>
            <button className="dbtn" disabled={noteDlg.busy} onClick={() => saveNote(false)}>{t('save')}</button>
            {noteDlg.exists && <button className="dbtn danger" disabled={noteDlg.busy} onClick={() => saveNote(true)}>{t('remove')}</button>}
            <button className="dbtn ghost" onClick={() => setNoteDlg(null)}>{t('cancel')}</button>
          </span>
        </Modal>
      )}
    </div>
  );
}

function AttendancePage({ groups }) {
  const [gid, setGid] = useState('');
  const [all, setAll] = useState(groups);
  useEffect(() => { api('/api/teacher/groups?archived=1').then(setAll).catch(() => setAll(groups)); }, [groups]);
  useEffect(() => { if (!gid && groups.length) setGid(String(groups[0].id)); }, [groups]);
  return <AttendanceTable groups={all} gid={gid} setGid={setGid} showArchived />;
}

/* ---------- Home ---------- */
function Home({ groups, user, Feed, nav, onOpen }) {
  const [panel, setPanel] = useState('attendance');
  const today = iso(new Date());
  const [gid, setGid] = useState('');
  const [date, setDate] = useState(today);
  const [ov, setOv] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { if (!gid && groups.length) setGid(String(groups[0].id)); }, [groups]);
  useEffect(() => {
    setErr('');
    const load = () => api(`/api/teacher/overview?date=${date}${gid ? '&groupId=' + gid : ''}`).then(setOv).catch((x) => setErr(apiError(x)));
    load();
    const id = setInterval(load, 30000); // yangi ro'yxatdan o'tganlar haqida xabar tez ko'rinsin
    return () => clearInterval(id);
  }, [date, gid]);
  // Real calendar dates: the 4 most recent teaching days (Sundays skipped) + the picked date if it is older
  const chips = [];
  for (let d = new Date(); chips.length < 4; d.setDate(d.getDate() - 1)) if (d.getDay() !== 0) chips.push(iso(d));
  if (!chips.includes(date)) chips.push(date);
  const g = (ov && ov.group) || { total: 0, present: 0, late: 0, absent: 0, excused: 0, unmarked: 0 };
  const marked = g.present + g.late + g.absent;
  const rate = marked ? Math.round(((g.present + g.late) / marked) * 100) : null;
  const dateName = date === today ? t('today') : dayLabel(date)[0];
  const groupName = (groups.find((x) => String(x.id) === String(gid)) || {}).name;
  const go = (page, params) => () => nav(page, params);
  return (
    <>
      {err && <div className="err">{err}</div>}
      {user.role === 'admin' && ov && ov.pending > 0 && (
        <button type="button" className="pendingbanner" onClick={go('students', { status: 'pending' })}><Icon name="bell" size={18} /> {ov.pending} {t('pendingBanner')} — {t('reviewNow')} <Icon name="chevR" size={16} /></button>
      )}
      <div className="dstats">
        <Stat icon={<Icon name="students" size={18} />} tint="#3b5bdb33" label={t('allStudents')} value={ov ? ov.all_students : '–'} onClick={go('students', {})} />
        <Stat icon={<Icon name="newStudent" size={18} />} tint="#f5a62333" label={t('newStudents')} value={ov ? ov.new_students : '–'} onClick={go('students', { newDays: '7' })} />
        <Stat icon={<Icon name="pending" size={18} />} tint="#e8588533" label={t('pending')} value={ov ? ov.pending : '–'} onClick={go('students', { status: 'pending' })} />
        <Stat icon={<Icon name="approved" size={18} />} tint="#1c9ce633" label={t('approved')} value={ov ? ov.approved : '–'} onClick={go('students', { status: 'approved' })} />
        <Stat icon={<Icon name="absent" size={18} />} tint="#ff4d5e33" label={date === today ? t('absentToday') : `${t('absentOn')} ${dayLabel(date)[0]}`} value={ov ? ov.absent_today : '–'} onClick={go('dayatt', { date, status: 'absent' })} />
        <Stat icon={<Icon name="trophy" size={18} />} tint="#8b5cf633" label={t('top1')} value={ov && ov.top ? ov.top.points : '–'} sub={ov && ov.top ? ov.top.full_name : ''} onClick={go('rankings', { by: 'points' })} />
        <Stat icon={<Icon name="wallet" size={18} />} tint="#22b57333" label={t('richest')} value={ov && ov.richest ? ov.richest.coins : '–'} sub={ov && ov.richest ? ov.richest.full_name : ''} onClick={go('rankings', { by: 'coins' })} />
      </div>
      <div className="dchips">
        {chips.map((c) => {
          const [a, b] = dayLabel(c);
          return <button key={c} className={date === c ? 'on' : ''} onClick={() => setDate(c)}><Icon name="calendar" size={18} /><span><b>{b}, {a}</b><small>{relName(c, today)}</small></span></button>;
        })}
        <label className="datepick"><small>{t('pickDate')}</small><input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} /></label>
      </div>
      <div className="dsum">
        <div className="dcard row"><div className="dico" style={{ background: '#3b5bdb33' }}><Icon name="avgPoints" size={20} /></div><div><small>{t('avgPoints')}</small><b>{ov ? ov.avg_points : '–'}</b></div></div>
        <div className="dcard row"><div className="dico" style={{ background: '#22b57333' }}><Icon name="users" size={20} /></div><div><small>{t('totalStudents')}</small><b>{g.total}</b></div></div>
        <div className="dcard row"><div className="dico" style={{ background: '#e8588533' }}><Icon name="present" size={20} /></div><div><small>{date === today ? t('presentToday') : t('presentOn')}</small><b>{g.present + g.late}</b></div></div>
        <button type="button" className="dcard row click" onClick={go('analytics', {})} aria-label={t('attRate')}>
          <div className="dico" style={{ background: '#8b5cf633' }}><Icon name="rate" size={20} /></div>
          <div><small>{t('attRate')}</small><b>{rateText(rate)}</b></div>
          <div className="donut" style={{ background: `conic-gradient(#22b573 ${(rate || 0) * 3.6}deg, var(--d-line) 0)` }}><span /></div>
        </button>
      </div>
      <div className="daybreak">
        <span className="spill present">{t('statPresent')} {g.present}</span><span className="spill late">{t('statLate')} {g.late}</span>
        <span className="spill absent">{t('statAbsent')} {g.absent}</span><span className="spill excused">{t('statExcused')} {g.excused}</span>
        <span className="spill unmarked">{t('statUnmarked')} {g.unmarked}</span>
        <button className="dbtn ghost" onClick={go('dayatt', { date, groupId: gid })}>{t('openDetails')}</button>
      </div>
      <div className="paneltabs">
        <button type="button" className={'dcard row click' + (panel === 'attendance' ? ' on' : '')} onClick={() => setPanel('attendance')} aria-pressed={panel === 'attendance'}>
          <div className="dico" style={{ background: '#3b5bdb33' }}><Icon name="attendance" size={20} /></div><div><b>{t('attendance')}</b><small>{t('attPanelSub')}</small></div>
        </button>
        <button type="button" className={'dcard row click' + (panel === 'homework' ? ' on' : '')} onClick={() => setPanel('homework')} aria-pressed={panel === 'homework'}>
          <div className="dico" style={{ background: '#22b57333' }}><Icon name="homework" size={20} /></div><div><b>{t('homework')}</b><small>{t('hwPanelSub')}</small></div>
        </button>
      </div>
      {panel === 'attendance'
        ? <AttendanceTable groups={groups} gid={gid} setGid={setGid} to={date} setTo={setDate} />
        : <HomeworkMatrix key={gid} groups={groups} gid={gid} isAdmin={user.role === 'admin'} onOpen={onOpen} />}
      {Feed && <Feed user={user} nav={nav} />}
    </>
  );
}

/* ---------- Promo kodlar ---------- */
function Promo() {
  const [list, setList] = useState([]);
  const [maxUses, setMaxUses] = useState(1);
  const [days, setDays] = useState(7);
  const [msg, setMsg] = useState('');
  const load = () => api('/api/admin/promo-codes').then(setList).catch(() => {});
  useEffect(() => { load(); }, []);
  const create = async (e) => {
    e.preventDefault();
    try { const c = await api('/api/admin/promo-codes', { method: 'POST', body: { maxUses, days } }); setMsg(t('newCode') + ' ' + c.code); load(); }
    catch (x) { setMsg(apiError(x)); }
  };
  const off = async (id) => { if (!confirm(t('confirmDelete'))) return; await api(`/api/admin/promo-codes/${id}`, { method: 'DELETE' }).catch(() => {}); load(); };
  return (
    <>
      <form className="dcard dtools" onSubmit={create}>
        <label className="muted">{t('forHowMany')}</label>
        <input type="number" min="1" max="100" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} style={{ width: 90 }} />
        <label className="muted">{t('validDays')}</label>
        <input type="number" min="0" value={days} onChange={(e) => setDays(e.target.value)} style={{ width: 90 }} />
        <button className="dbtn"><Icon name="promo" size={16} /> {t('createPromo')}</button>
      </form>
      {msg && <div className="dnote"><Status msg={msg} /></div>}
      <div className="dcard">
        <h3>{t('promoTitle')}</h3>
        {list.length === 0 && <p className="muted">{t('noPromo')}</p>}
        {list.map((c) => {
          const dead = !c.is_active || c.used_count >= c.max_uses || (c.expires_at && new Date(c.expires_at) < new Date());
          return (
            <div key={c.id} className="drow">
              <span><b className="code">{c.code}</b> <small>· {t('used')} {c.used_count}/{c.max_uses}{c.expires_at ? ' · ' + t('validUntil') + ' ' + new Date(c.expires_at).toLocaleDateString(locale()) : ''}</small></span>
              <span className="acts">
                <span className={'pill ' + (dead ? 'off' : 'on')}>{dead ? t('inactive') : t('active')}</span>
                <button className="dbtn ghost" onClick={() => navigator.clipboard && navigator.clipboard.writeText(c.code)}>{t('copy')}</button>
                <button className="dbtn danger" onClick={() => off(c.id)}>{t('remove')}</button>
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ---------- Mavjud story/eventlar (admin o'chira oladi) ---------- */
function Manage({ kind, isAdmin }) {
  const [items, setItems] = useState([]);
  const url = kind === 'events' ? '/api/events' : '/api/stories';
  const load = () => api(url + '?all=1').then(setItems).catch(() => {});
  useEffect(() => { load(); }, [kind]);
  const del = async (id) => {
    if (!confirm(t('confirmDelete'))) return;
    try { await api(`${url}/${id}`, { method: 'DELETE' }); load(); } catch (x) { alert(apiError(x)); }
  };
  return (
    <div className="dcard">
      <h3>{t('existing')} ({items.length})</h3>
      {items.map((it) => (
        <div key={it.id} className="drow">
          <span><b>{it.title || it.category || '—'}</b> <small>· {new Date(it.starts_at || it.created_at).toLocaleString(locale())}</small>{it.expires_at && <small className="muted"> · {t('expiresOn')} {new Date(it.expires_at).toLocaleString(locale())}</small>}</span>
          {isAdmin && <button className="dbtn danger" onClick={() => del(it.id)}>{t('remove')}</button>}
        </div>
      ))}
    </div>
  );
}

/* ---------- Talaba progressi (admin va teacher) ---------- */
const lastSeen = (x) => {
  if (!x) return t('never');
  const d = new Date(x);
  return Date.now() - d.getTime() < 5 * 60000 ? t('online') : d.toLocaleString(locale());
};
const fmtAt = (a) => (String(a).length === 10 ? new Date(a + 'T00:00:00').toLocaleDateString(locale()) : new Date(a).toLocaleString(locale()));
const ACT_ICON = { attendance: 'attendance', event: 'events', story: 'stories', message: 'community' };

function LearningRadar({ items }) {
  const size = 340, c = size / 2, R = 100, n = items.length;
  const pt = (i, v) => { const a = -Math.PI / 2 + (2 * Math.PI * i) / n; return [c + Math.cos(a) * R * v, c + Math.sin(a) * R * v]; };
  const ring = (v) => items.map((_, i) => pt(i, v).join(',')).join(' ');
  const poly = items.map((it, i) => pt(i, Math.max(0, Math.min(100, it.value)) / 100).join(',')).join(' ');
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="radar">
      {[0.2, 0.4, 0.6, 0.8, 1].map((v) => <polygon key={v} points={ring(v)} fill="none" stroke="var(--d-line)" />)}
      {items.map((_, i) => { const [x, y] = pt(i, 1); return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="var(--d-line)" />; })}
      <polygon points={poly} fill="#2d6bff55" stroke="#2d6bff" strokeWidth="2" />
      {items.map((it, i) => { const [x, y] = pt(i, 1.22); return <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="11" fill="var(--d-text)">{it.label} {Math.round(it.value)}%</text>; })}
    </svg>
  );
}

function StudentExtras({ id, user }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { setD(null); setErr(''); api(`/api/teacher/students/${id}/progress`).then(setD).catch((x) => setErr(apiError(x))); }, [id]);
  if (err) return <div className="dcard"><p className="err">{err}</p></div>;
  if (!d) return null;
  const s = d.student, ax = d.axes, st = d.stats;
  const items = [['attendance', ax.attendance], ['events', ax.events], ['stories', ax.stories], ['community', ax.community], ['consistency', ax.consistency], ['points', ax.points]].map(([k, v]) => ({ label: t(k), value: v }));
  const stName = { present: t('statPresent'), late: t('statLate'), absent: t('statAbsent') };
  const actLabel = (a) => (a.type === 'attendance' ? `${t('actAttendance')}: ${stName[a.status] || a.status}` : a.type === 'event' ? `${t('actEvent')}${a.label ? ': ' + a.label : ''}` : a.type === 'story' ? t('actStory') : t('actMessage'));
  return (
    <>
      <div className="dcard row"><span className="muted">{lastSeen(s.last_seen_at)}</span></div>
      <div className="dstats" style={{ marginTop: 16 }}>
        <Stat icon={<Icon name="events" size={18} />} tint="#3b5bdb33" label={t('events')} value={st.events} />
        <Stat icon={<Icon name="stories" size={18} />} tint="#8b5cf633" label={t('stories')} value={st.stories} />
        <Stat icon={<Icon name="community" size={18} />} tint="#1c9ce633" label={t('community')} value={st.messages} />
      </div>
      <div className="dcard"><h3>{t('learningProgress')}</h3><LearningRadar items={items} /></div>
      <div className="dcard">
        <h3>{t('recentActivity')}</h3>
        {d.activities.length === 0 && <p className="muted">{t('noActivity')}</p>}
        {d.activities.map((a, i) => (<div key={i} className="drow"><span><Icon name={ACT_ICON[a.type]} size={16} /> {actLabel(a)}</span><small className="muted">{fmtAt(a.at)}</small></div>))}
      </div>
      <div className="dcard"><h3><Icon name="mail" size={18} /> {t('messageStudent')}</h3><div className="dm"><Thread me={user} peer={s} /></div></div>
    </>
  );
}

function EmailTest({ user }) {
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true); setRes(null);
    try { const r = await api('/api/admin/test-email', { method: 'POST', body: { to: user.email } }); setRes({ ok: r.result === 'sent', dev: r.result === 'dev' }); }
    catch (x) { setRes({ ok: false, error: (x.data && x.data.detail) || apiError(x) }); }
    setBusy(false);
  };
  const e = res && res.error;
  const hint = e ? (/EAUTH|Invalid login|535|Username and Password/i.test(e) ? t('mailHintAuth') : /ETIMEDOUT|ECONN|ENOTFOUND|ESOCKET|getaddrinfo/i.test(e) ? t('mailHintNet') : '') : '';
  return (
    <div className="dcard">
      <h3><Icon name="mail" size={18} /> {t('mailTest')}</h3>
      <p className="muted">{user.email}</p>
      <button className="dbtn" disabled={busy} onClick={run}>{t('mailSend')}</button>
      {res && res.ok && <p><Icon name="ok" size={16} /> {t('mailOk')}</p>}
      {res && res.dev && <p className="err"><Icon name="warn" size={16} /> {t('mailDev')}</p>}
      {e && <p className="err"><Icon name="alert" size={16} /> {e}</p>}
      {hint && <p className="muted">{hint}</p>}
    </div>
  );
}

/* ---------- Dashboard ---------- */
export default function Dashboard({ user, StoryForm, EventForm, Feed, StudentHome, StoryViewer, StudentRanking, onHwDeep, hwDeep, onChat, unread, reload, theme, setTheme, lang, changeLang }) {
  const [page, setPage] = useState('home');
  const [groups, setGroups] = useState([]);
  const [side, setSide] = useState(false);
  const mainRef = useRef(null);
  // Mobile table cards: copy each column heading onto its cells (data-label) so CSS can stack rows as cards on small screens
  useEffect(() => {
    const el = mainRef.current; if (!el) return;
    let raf = 0;
    const label = () => {
      raf = 0;
      el.querySelectorAll('table.dt').forEach((tb) => {
        const heads = [...tb.querySelectorAll('thead th')].map((th) => th.innerText.trim());
        tb.querySelectorAll('tbody tr').forEach((tr) => [...tr.children].forEach((td, i) => { if (heads[i] !== undefined && td.dataset.label !== heads[i]) td.dataset.label = heads[i]; }));
      });
    };
    const mo = new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(label); });
    mo.observe(el, { childList: true, subtree: true }); label();
    return () => { mo.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, []);
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState(null);
  const [detail, setDetail] = useState(null);
  const [params, setParams] = useState({});
  const [pkey, setPkey] = useState(0);
  const [mk, setMk] = useState(0);
  const isAdmin = user.role === 'admin';
  const isStudent = user.role === 'student';
  const [groupsErr, setGroupsErr] = useState('');
  const loadGroups = () => api('/api/teacher/groups').then((g) => { setGroups(g); setGroupsErr(''); }).catch((x) => setGroupsErr(apiError(x)));
  useEffect(() => { if (!isStudent) loadGroups(); }, []);

  // O'qituvchi menyusida Stories, Events va Teachers yo'q (faqat admin). Dashboard bosh sahifasidagi Stories/Events ko'rinishi saqlanadi.
  const STUDENT_NAV = [['home', 'home'], ['homework', 'homework'], ['events', 'events'], ['ranking', 'trophy'], ['points', 'star'], ['coins', 'coins'], ['community', 'community']];
  const nav = isStudent ? STUDENT_NAV : isAdmin ? [...NAV, ['vocab', 'homework'], ['promo', 'promo']] : NAV.filter(([k]) => !['stories', 'events', 'teachers'].includes(k));
  const titleKey = { profile: 'personalInfo', settings: 'settings', dayatt: 'attendance', rankings: 'ranking', analytics: 'attRate', eventsall: 'events' }[page] || page;
  const navActive = { dayatt: 'attendance', analytics: 'attendance' }[page] || page;
  // Every card/menu goes through navTo so list pages always open with the right filters (and remount cleanly)
  const histRef = useRef([]);
  const navTo = (p, pr = {}, fromBack = false) => { if (!fromBack) histRef.current = [...histRef.current.slice(-19), { page, params }]; setPage(p); setParams(pr); setPkey((k) => k + 1); setDetail(null); setSide(false); setMenu(false); window.scrollTo(0, 0); };
  const go = (p) => navTo(p);
  // Back: oldingi sahifaga; tarix bo'lmasa (to'g'ridan-to'g'ri ochilgan) — Davomat sahifasiga
  const goBack = () => { const h = histRef.current[histRef.current.length - 1]; histRef.current = histRef.current.slice(0, -1); if (h) navTo(h.page, h.params, true); else navTo(['dayatt', 'analytics'].includes(page) ? 'attendance' : 'home', {}, true); };
  const BackBtn = () => <div className="dtools"><button className="dbtn ghost" onClick={goBack}><Icon name="back" size={16} /> {t('back')}</button></div>;
  const openStudent = (id) => { setDetail(id); window.scrollTo(0, 0); };
  const open = (m) => { setModal(m); setMenu(false); setSide(false); };
  const toggleTheme = () => {
    const v = nextTheme(theme);
    setTheme(v);
    api('/api/auth/profile', { method: 'PATCH', body: { theme: v } }).catch(() => {});
  };
  const pickLang = (k) => {
    changeLang(k);
    api('/api/auth/profile', { method: 'PATCH', body: { language: k } }).catch(() => {});
    setModal(null);
  };
  const roleLabel = isAdmin ? t('roleAdmin') : isStudent ? t('roleStudent') : t('roleTeacher');
  const langName = { en: 'English', uz: "O'zbek", zh: '中文', tr: 'Türkçe', ru: 'Русский' }[lang];

  return (
    <div className={'dash' + (isStudent ? ' stu' : '')}>
      {side && <div className="dscrim" onClick={() => setSide(false)} />}
      <aside className={'dside ' + (side ? 'open' : '')}>
        <div className="dlogo"><img src="/eagle.png" alt="" /><div><b>Valid EduAction</b><small>Learn • Grow • Succeed</small></div></div>
        <div className="dnav">
          {nav.map(([k, ic]) => (
            <button key={k} title={t(k)} aria-label={t(k)} className={navActive === k ? 'on' : ''} onClick={() => (k === 'community' ? (setSide(false), onChat()) : go(k))}><span className="ic"><AppIcon name={ic} size={24} /></span><span className="lbl">{t(k)}</span></button>
          ))}
        </div>
        <div className="dbottom">
          <button onClick={() => open('lang')}><span className="ic"><Icon name="globe" size={20} /></span><span className="lbl">{t('languages')}</span></button>
          <button onClick={() => open('logout')}><span className="ic"><Icon name="logout" size={20} /></span><span className="lbl">{t('logout')}</span></button>
        </div>
      </aside>

      <main className={'dmain hasbnav'} ref={mainRef}>
        <header className="dhead">
          {!isStudent && <button type="button" className="dburger" onClick={() => setSide(true)} aria-label={t('more')}><Icon name="menu" size={22} /></button>}
          {isStudent && page === 'home'
            ? <div className="dtitle"><h1>{greeting()}, <span className="hl">{user.full_name.split(' ')[0]}</span>! <Icon name="wave" size={26} className="wavei" /></h1><p>{t('keepLearning')}</p></div>
            : <div className="dtitle"><h1>{t(titleKey)}</h1><p>{t('welcome')}, {user.full_name.split(' ')[0]}!</p></div>}
          <div className="dright">
            <button className="dchat" onClick={onChat} aria-label="chat"><Icon name="chat" size={20} />{unread > 0 && <i>{unread > 9 ? '9+' : unread}</i>}</button>
            <button className="dtheme" onClick={toggleTheme} aria-label="theme" title={t(themeKey(theme))}><Icon name={themeIcon(theme)} size={20} /></button>
            <div className="dprofwrap">
              <button className="dprof" onClick={() => setMenu((m) => !m)}>
                <Ava u={user} size={40} />
                <span className="pn"><b>{user.full_name}</b><small>{roleLabel}</small></span>
                <Icon name="chevD" size={16} />
              </button>
              {menu && (
                <>
                  <div className="dscrim clear" onClick={() => setMenu(false)} />
                  <div className="ddrop">
                    <div className="dropuser"><Ava u={user} size={44} /><div><b>{user.full_name}</b><small>{roleLabel}</small></div></div>
                    <button onClick={() => go('profile')}><span className="ic"><Icon name="user" size={20} /></span>{t('personalInfo')}</button>
                    <button onClick={() => go('settings')}><span className="ic"><Icon name="settings" size={20} /></span>{t('settings')}</button>
                    <button onClick={() => open('help')}><span className="ic"><Icon name="help" size={20} /></span>{t('help')}</button>
                    <hr />
                    <button onClick={() => open('lang')}><span className="ic"><Icon name="globe" size={20} /></span>{t('languages')}<em>{langName}</em></button>
                    <button onClick={toggleTheme}><span className="ic"><Icon name={themeIcon(theme)} size={20} /></span>{t('theme')}<em>{t(themeKey(theme))}</em></button>
                    <hr />
                    <button onClick={() => open('logout')}><span className="ic"><Icon name="logout" size={20} /></span>{t('logout')}</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {!detail && !['home', 'dayatt', 'analytics', 'eventsall', 'community'].includes(page) && !(isStudent && page === 'homework' && hwDeep) && <button type="button" className="dbtn ghost backbtn" onClick={goBack}><Icon name="back" size={16} /> {t('back')}</button>}
        {groupsErr && <div className="err">{t('groupsLoadErr')}: {groupsErr}</div>}
        {detail && <StudentProfile id={detail} isAdmin={isAdmin} onBack={() => setDetail(null)} onChanged={loadGroups} extras={<StudentExtras id={detail} user={user} />} />}
        {/* Lists stay mounted (hidden) while a profile is open so filters/scroll survive "Back" */}
        <div style={{ display: detail ? 'none' : 'block' }}>
          {page === 'home' && !isStudent && <Home groups={groups} user={user} Feed={Feed} nav={navTo} onOpen={openStudent} />}
          {isStudent && page === 'home' && <StudentHomeNew user={user} nav={navTo} onHomework={() => navTo('homework')} StoryViewer={StoryViewer} />}
          {isStudent && page === 'homework' && <StudentHomework me={user} onDeep={onHwDeep} />}
          {isStudent && page === 'vocab' && <VocabStudent />}
          {isAdmin && page === 'vocab' && <VocabAdmin />}
          {isStudent && page === 'games' && <Games game={params.game} onBack={goBack} onPick={(k) => navTo('games', { game: k })} onVocab={() => navTo('vocab')} />}
          {isStudent && page === 'events' && <EventsAllPage />}
          {isStudent && page === 'ranking' && StudentRanking && <StudentRanking me={user} />}
          {isStudent && page === 'points' && <StudentRewards mode="points" />}
          {isStudent && page === 'coins' && <StudentRewards mode="coins" />}
          {page === 'eventsall' && <EventsAllPage onBack={goBack} />}
          {page === 'students' && <StudentsPage key={'s' + pkey} init={params} groups={groups} isAdmin={isAdmin} onOpen={openStudent} />}
          {page === 'progress' && <StudentsPage key={'p' + pkey} mode="progress" groups={groups} isAdmin={isAdmin} onOpen={openStudent} />}
          {page === 'dayatt' && <><BackBtn /><DayAttendancePage key={'d' + pkey} init={params} groups={groups} onOpen={openStudent} /></>}
          {page === 'rankings' && <RankingsPage key={'r' + pkey} init={params} onOpen={openStudent} />}
          {page === 'analytics' && <><BackBtn /><AnalyticsPage groups={groups} onOpenDate={(date, groupId) => navTo('dayatt', { date, groupId })} /></>}
          {page === 'attendance' && (<><div className="dtools"><button className="dbtn ghost" onClick={() => navTo('analytics')}><Icon name="rate" size={16} /> {t('attRate')}</button><button className="dbtn ghost" onClick={() => navTo('dayatt', { date: iso(new Date()) })}><Icon name="calendar" size={16} /> {t('dayView')}</button></div><AttendancePage groups={groups} /></>)}
          {page === 'teachers' && isAdmin && <TeachersPage onNav={navTo} />}
          {!isAdmin && ['stories', 'events', 'teachers'].includes(page) && <div className="dcard"><p className="muted">{t('adminOnly')}</p></div>}
          {page === 'homework' && !isStudent && <HomeworkStaff isAdmin={isAdmin} groups={groups} onOpen={openStudent} />}
          {page === 'groups' && <GroupsPage isAdmin={isAdmin} reloadGroups={loadGroups} />}
          {page === 'stories' && isAdmin && (<>{isAdmin && StoryForm && <StoryForm onCreated={() => setMk((k) => k + 1)} />}<Manage key={'st' + mk} kind="stories" isAdmin={isAdmin} /></>)}
          {page === 'events' && isAdmin && (<>{isAdmin && EventForm && <EventForm onCreated={() => setMk((k) => k + 1)} />}<Manage key={'ev' + mk} kind="events" isAdmin={isAdmin} /></>)}
        </div>
        {page === 'promo' && isAdmin && <Promo />}
        {page === 'profile' && <Settings user={user} reload={reload} showPrefs={false} />}
        {page === 'settings' && (<><Settings user={user} reload={reload} theme={theme} setTheme={setTheme} lang={lang} changeLang={changeLang} />{isAdmin && <EmailTest user={user} />}</>)}
        {!LIVE.includes(page) && <div className="dcard"><h3>{t(page)}</h3><p className="muted">{t('soon')}</p></div>}
      </main>
      {(
        <nav className="dbnav" aria-label="Main">
          {(isStudent ? ['home', 'homework', 'ranking', 'games', 'profile'] : isAdmin ? ['home', 'students', 'attendance', 'groups', 'profile'] : ['home', 'students', 'attendance', 'homework', 'profile']).map((k) => (
            <button key={k} type="button" className={navActive === k ? 'on' : ''} onClick={() => (k === 'community' ? onChat() : go(k))}>{k === 'profile' ? <Icon name="user" size={24} /> : k === 'games' ? <Icon name="gamepad" size={26} /> : <AppIcon name={k} size={26} />}<span>{t(k)}</span></button>
          ))}
        </nav>
      )}

      {modal === 'lang' && <LangPanel lang={lang} onPick={pickLang} onClose={() => setModal(null)} />}
      {modal === 'help' && <HelpPanel onClose={() => setModal(null)} />}
      {modal === 'logout' && <LogoutDialog user={user} onClose={() => setModal(null)} />}
    </div>
  );
}
