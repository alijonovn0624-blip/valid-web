import { useEffect, useMemo, useState } from 'react';
import { api, API } from './api';
import { t, locale, apiError } from './i18n.js';
import { Icon, Status } from './icons.jsx';
import { Ava, StatusPill, ApprovalPill, rateText, BarChart, withLabels, useDebounced, iso, addDays, dayLabel, longDay, Stat } from './ui.jsx';

const NP = () => <span className="muted">{t('notProvided')}</span>;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' }) : null);
const qs = (o) => { const p = new URLSearchParams(); Object.entries(o).forEach(([k, v]) => { if (v !== '' && v !== null && v !== undefined) p.set(k, v); }); return p.toString(); };
const BANDS = { low: { attMax: 74 }, mid: { attMin: 75, attMax: 89 }, high: { attMin: 90 } };

export function Modal({ title, children, onClose }) {
  return (
    <div className="dscrim modalwrap" onClick={onClose}>
      <div className="dmodal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3>{title}</h3>{children}
      </div>
    </div>
  );
}

/* ---------- Students directory (All / New / Pending / Approved) and Students Progress ---------- */
export function StudentsPage({ mode = 'students', init = {}, groups, isAdmin, onOpen, onChanged }) {
  const progress = mode === 'progress';
  const [f, setF] = useState({ search: '', groupId: '', status: progress ? 'approved' : '', newDays: '', att: '', ...init });
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ total: 0, rows: [] });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState('');
  const [delDlg, setDelDlg] = useState(null);
  const search = useDebounced(f.search);
  const pageSize = 25;
  const reload = () => {
    setLoading(true); setErr('');
    api('/api/teacher/directory?' + qs({
      search, groupId: f.groupId, status: f.status, newDays: f.newDays, ...(BANDS[f.att] || {}),
      sort: sort.key, dir: sort.dir, page, pageSize,
    })).then(setData).catch((x) => setErr(apiError(x))).finally(() => setLoading(false));
  };
  useEffect(reload, [search, f.groupId, f.status, f.newDays, f.att, sort.key, sort.dir, page]);
  useEffect(() => setPage(1), [search, f.groupId, f.status, f.newDays, f.att]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const sortBy = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  const arrow = (key) => (sort.key === key ? <Icon name={sort.dir === 'asc' ? 'chevU' : 'chevD'} size={14} className="sortic" /> : null);
  const filtered = f.search || f.groupId || (f.status && !(progress && f.status === 'approved' && !init.status)) || f.newDays || f.att;
  const reset = () => { setF({ search: '', groupId: '', status: progress ? 'approved' : '', newDays: '', att: '' }); setSort({ key: 'name', dir: 'asc' }); };
  const decide = async (id, what) => {
    if (what === 'reject' && !confirm(t('confirmReject'))) return;
    setBusyId(id);
    try { await api(`/api/admin/users/${id}/${what}`, { method: 'POST' }); onChanged && onChanged(); reload(); }
    catch (x) { setErr(apiError(x)); }
    setBusyId('');
  };
  const removeStudent = async () => {
    const id = delDlg.id; setBusyId(id);
    try { await api(`/api/admin/students/${id}`, { method: 'DELETE' }); setDelDlg(null); onChanged && onChanged(); reload(); }
    catch (x) { setErr(apiError(x)); setDelDlg(null); }
    setBusyId('');
  };
  const assign = async (sid, gid) => {
    try {
      if (gid) await api(`/api/teacher/groups/${gid}/members`, { method: 'POST', body: { studentId: sid } });
      else await api(`/api/teacher/members/${sid}`, { method: 'DELETE' });
      reload();
    } catch (x) { setErr(apiError(x)); }
  };
  const pages = Math.max(1, Math.ceil(data.total / pageSize));
  const chips = [
    f.newDays && `${t('registeredLast')} ${f.newDays} ${t('daysShort')}`,
    f.status && `${t('statusLbl')}: ${t('ap_' + f.status)}`,
    f.groupId && `${t('group')}: ${(groups.find((g) => String(g.id) === String(f.groupId)) || {}).name || f.groupId}`,
    f.att && `${t('attendance')}: ${t('band_' + f.att)}`,
  ].filter(Boolean);
  const Th = ({ k, children, cls }) => <th className={'left ' + (cls || '')}><button className="thbtn" onClick={() => sortBy(k)}>{children}{arrow(k)}</button></th>;

  return (
    <div className="dcard">
      <h3><Icon name="students" size={20} /> {progress ? t('progress') : t('students')} <span className="countbadge">{data.total}</span></h3>
      <div className="dtools">
        <input placeholder={t('searchStudents')} value={f.search} onChange={set('search')} aria-label={t('search')} />
        <select value={f.groupId} onChange={set('groupId')}>
          <option value="">{t('allGroups')}</option><option value="none">{t('noGroup')}</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select value={f.status} onChange={set('status')}>
          <option value="">{t('allStatuses')}</option>
          {['pending', 'approved', 'rejected'].map((s) => <option key={s} value={s}>{t('ap_' + s)}</option>)}
        </select>
        <select value={f.att} onChange={set('att')}>
          <option value="">{t('anyAttendance')}</option>
          {Object.keys(BANDS).map((b) => <option key={b} value={b}>{t('band_' + b)}</option>)}
        </select>
        <select value={f.newDays} onChange={set('newDays')}>
          <option value="">{t('anyJoinDate')}</option><option value="7">{t('registeredLast')} 7 {t('daysShort')}</option><option value="30">{t('registeredLast')} 30 {t('daysShort')}</option>
        </select>
      </div>
      {chips.length > 0 && (
        <div className="chiprow"><span className="muted">{t('activeFilters')}:</span>{chips.map((c) => <span key={c} className="fchip">{c}</span>)}
          <button className="dbtn ghost" onClick={reset}>{t('resetFilters')}</button></div>
      )}
      {err && <div className="err">{err}</div>}
      <div className="tblwrap" aria-busy={loading}>
        <table className="dt">
          <thead><tr>
            <th className="left">#</th><Th k="name">{t('student')}</Th>
            {!progress && <><th className="left hide-sm">{t('email')}</th><th className="left hide-sm">{t('phone')}</th></>}
            <Th k="group">{t('group')}</Th>
            {!progress && <Th k="status">{t('statusLbl')}</Th>}
            <Th k="attendance">{t('attendance')}</Th>
            {progress && <><Th k="points">{t('points')}</Th><Th k="coins">{t('coins')}</Th></>}
            {!progress && <Th k="joined" cls="hide-sm">{t('joined')}</Th>}
            <th className="left">{t('actions')}</th>
          </tr></thead>
          <tbody>
            {data.rows.map((s, i) => (
              <tr key={s.id}>
                <td>{(page - 1) * pageSize + i + 1}</td>
                <td className="left"><span className="who clickable" onClick={() => onOpen(s.id)}><Ava u={s} /> <b>{s.full_name}</b></span></td>
                {!progress && <><td className="left hide-sm">{s.email}</td><td className="left hide-sm">{s.phone || <NP />}</td></>}
                <td className="left">
                  {!progress && isAdmin && s.approval_status === 'approved' ? (
                    <select value={s.group_id || ''} onChange={(e) => assign(s.id, e.target.value)} aria-label={t('group')}>
                      <option value="">{t('noGroup')}</option>
                      {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                      {s.group_id && !groups.some((g) => g.id === s.group_id) && <option value={s.group_id}>{s.group_name} ({t('archived')})</option>}
                    </select>
                  ) : (s.group_name ? <>{s.group_name}{s.group_archived_at && <small className="muted"> ({t('archived')})</small>}</> : <span className="muted">{t('noGroup')}</span>)}
                </td>
                {!progress && <td className="left"><ApprovalPill s={s.approval_status} /></td>}
                <td className="left">
                  {progress ? (
                    <span className="attbar" title={`${s.present_n}/${s.marked_n}`}><i style={{ width: (s.att_rate ?? 0) + '%' }} /><em>{rateText(s.att_rate === null ? null : Number(s.att_rate))}{s.marked_n ? ` · ${s.present_n}/${s.marked_n}` : ''}</em></span>
                  ) : rateText(s.att_rate === null ? null : Number(s.att_rate))}
                </td>
                {progress && <><td className="left"><span className="ico-inline"><Icon name="star" size={15} /> {s.points}</span></td><td className="left"><span className="ico-inline"><Icon name="coins" size={15} /> {s.coins}</span></td></>}
                {!progress && <td className="left hide-sm">{fmtDate(s.created_at)}</td>}
                <td className="left"><span className="acts">
                  <button className="dbtn ghost" onClick={() => onOpen(s.id)}>{t('view')}</button>
                  {isAdmin && !progress && s.approval_status !== 'approved' && <button className="dbtn" disabled={busyId === s.id} onClick={() => decide(s.id, 'approve')}>{t('approve')}</button>}
                  {isAdmin && !progress && <button className="dbtn danger" disabled={busyId === s.id} onClick={() => setDelDlg({ id: s.id, name: s.full_name })}>{s.approval_status === 'rejected' ? t('remove') : t('reject')}</button>}
                </span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <p className="muted">{t('loading')}</p>}
        {!loading && data.rows.length === 0 && <p className="muted">{filtered ? t('noResults') : t('noApproved')}</p>}
      </div>
      {delDlg && (
        <Modal title={<span className="ico-inline"><Icon name="trash" size={18} /> {t('reject')}: {delDlg.name}</span>} onClose={() => setDelDlg(null)}>
          <p>{t('deleteStudentExplain')}</p>
          <span className="acts"><button className="dbtn danger" disabled={busyId === delDlg.id} onClick={removeStudent}>{t('deleteAccount')}</button><button className="dbtn ghost" onClick={() => setDelDlg(null)}>{t('cancel')}</button></span>
        </Modal>
      )}
      {pages > 1 && (
        <div className="pager">
          <button className="dbtn ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}><Icon name="prev" size={16} /></button>
          <span>{page} / {pages}</span>
          <button className="dbtn ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}><Icon name="chevR" size={16} /></button>
        </div>
      )}
    </div>
  );
}

/* ---------- Attendance for one date (Absent Today lands here) ---------- */
export function DayAttendancePage({ init = {}, groups, onOpen }) {
  const today = iso(new Date());
  const [date, setDate] = useState(init.date || today);
  const [gid, setGid] = useState(init.groupId || '');
  const [flt, setFlt] = useState(init.status || '');
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    setErr('');
    api('/api/teacher/day-attendance?' + qs({ date, groupId: gid })).then(setD).catch((x) => setErr(apiError(x)));
  }, [date, gid]);
  const rows = d ? d.rows.filter((r) => !flt || r.status === flt) : [];
  const keys = ['present', 'late', 'absent', 'excused', 'unmarked'];
  return (
    <div className="dcard">
      <h3><Icon name="calendar" size={20} /> {longDay(date)}{date === today ? ' — ' + t('today') : ''}</h3>
      <div className="dtools">
        <input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label={t('pickDate')} />
        <select value={gid} onChange={(e) => setGid(e.target.value)}>
          <option value="">{t('allGroups')}</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>
      <div className="chiprow">
        <button className={'fchip btn' + (flt === '' ? ' on' : '')} onClick={() => setFlt('')}>{t('all')} {d ? d.rows.length : ''}</button>
        {keys.map((k) => <button key={k} className={'fchip btn ' + k + (flt === k ? ' on' : '')} onClick={() => setFlt(k)}>{t('stat' + k[0].toUpperCase() + k.slice(1))} {d ? d.counts[k] || 0 : ''}</button>)}
      </div>
      <p className="muted">{t('unmarkedNote')}</p>
      {err && <div className="err">{err}</div>}
      {!d && !err && <p className="muted">{t('loading')}</p>}
      {d && rows.length === 0 && <p className="muted">{t('noResults')}</p>}
      {rows.length > 0 && (
        <div className="tblwrap"><table className="dt">
          <thead><tr><th className="left">#</th><th className="left">{t('student')}</th><th className="left">{t('group')}</th><th className="left">{t('statusLbl')}</th></tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={r.id + (r.group_id || '')}><td>{i + 1}</td>
              <td className="left"><span className="who clickable" onClick={() => onOpen(r.id)}><Ava u={r} /> <b>{r.full_name}</b></span></td>
              <td className="left">{r.group_name || <span className="muted">{t('noGroup')}</span>}</td>
              <td className="left"><StatusPill s={r.status} /></td></tr>
          ))}</tbody></table></div>
      )}
    </div>
  );
}

/* ---------- Rankings: Top 1 (points) and Richest (coins) ---------- */
export function RankingsPage({ init = {}, onOpen }) {
  const [by, setBy] = useState(init.by === 'coins' ? 'coins' : 'points');
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { setD(null); setErr(''); api('/api/teacher/rankings?by=' + by).then(setD).catch((x) => setErr(apiError(x))); }, [by]);
  return (
    <div className="dcard">
      <div className="dtools">
        <button className={'dbtn' + (by === 'points' ? '' : ' ghost')} onClick={() => setBy('points')}><Icon name="trophy" size={16} /> {t('byPoints')}</button>
        <button className={'dbtn' + (by === 'coins' ? '' : ' ghost')} onClick={() => setBy('coins')}><Icon name="wallet" size={16} /> {t('byCoins')}</button>
      </div>
      <p className="muted">{by === 'points' ? t('pointsNote') : t('coinsNote')} {t('tieNote')}</p>
      {err && <div className="err">{err}</div>}
      {!d && !err && <p className="muted">{t('loading')}</p>}
      {d && d.rows.length === 0 && <p className="muted">{t('noApproved')}</p>}
      {d && d.rows.length > 0 && (
        <div className="tblwrap"><table className="dt">
          <thead><tr><th className="left">#</th><th className="left">{t('student')}</th><th className="left">{t('group')}</th><th className="left">{by === 'points' ? t('points') : t('coins')}</th></tr></thead>
          <tbody>{d.rows.map((r) => (
            <tr key={r.id} className={r.rank === 1 ? 'first' : ''}>
              <td>{r.rank === 1 ? <Icon name="medal" size={18} className="gold" /> : r.rank}</td>
              <td className="left"><span className="who clickable" onClick={() => onOpen(r.id)}><Ava u={r} /> <b>{r.full_name}</b></span></td>
              <td className="left">{r.group_name || <span className="muted">{t('noGroup')}</span>}</td>
              <td className="left"><b className="ico-inline">{by === 'points' ? <Icon name="star" size={15} /> : <Icon name="coins" size={15} />} {by === 'points' ? r.points : r.coins}</b></td>
            </tr>))}</tbody></table></div>
      )}
    </div>
  );
}

/* ---------- Attendance analytics (radar) — shared by the Attendance Rate page and student profiles ---------- */
export function AttendanceAnalytics({ studentId, groups = [], onOpenDate, showGroup }) {
  const today = iso(new Date());
  const [bucket, setBucket] = useState('day');
  const [from, setFrom] = useState(addDays(today, -13));
  const [to, setTo] = useState(today);
  const [gid, setGid] = useState('');
  const [view, setView] = useState('chart');
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [sel, setSel] = useState(null);
  useEffect(() => {
    setErr(''); setD(null); setSel(null);
    api('/api/teacher/analytics?' + qs({ from, to, bucket, groupId: gid, studentId })).then(setD).catch((x) => setErr(apiError(x)));
  }, [from, to, bucket, gid, studentId]);
  const quick = (days, b = 'day') => { setBucket(b); setTo(today); setFrom(addDays(today, -(days - 1))); };
  const pts = useMemo(() => (d ? withLabels(d.points, d.bucket) : []), [d]);
  const sp = pts.find((p) => p.key === sel);
  const tot = d && d.total;
  return (
    <div>
      <div className="dtools">
        {showGroup && <select value={gid} onChange={(e) => setGid(e.target.value)}><option value="">{t('allGroups')}</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>}
        <label className="muted">{t('from')} <input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} /></label>
        <label className="muted">{t('to')} <input type="date" value={to} min={from} max={today} onChange={(e) => e.target.value && setTo(e.target.value)} /></label>
      </div>
      <div className="chiprow">
        <button className="fchip btn" onClick={() => quick(7)}>7 {t('daysShort')}</button>
        <button className="fchip btn" onClick={() => quick(14)}>14 {t('daysShort')}</button>
        <button className="fchip btn" onClick={() => quick(30)}>30 {t('daysShort')}</button>
        <button className="fchip btn" onClick={() => quick(56, 'week')}>8 {t('weeksShort')}</button>
        <span className="sep" />
        <button className={'fchip btn' + (bucket === 'day' ? ' on' : '')} onClick={() => setBucket('day')}>{t('daily')}</button>
        <button className={'fchip btn' + (bucket === 'week' ? ' on' : '')} onClick={() => setBucket('week')}>{t('weekly')}</button>
      </div>
      <div className="viewtoggle" role="tablist" aria-label={t('chart') + ' / ' + t('tableView')}>
        <button type="button" role="tab" aria-selected={view === 'table'} className={view === 'table' ? 'on' : ''} onClick={() => setView('table')}><Icon name="table" size={16} /> {t('tableView')}</button>
        <button type="button" role="tab" aria-selected={view === 'chart'} className={view === 'chart' ? 'on' : ''} onClick={() => setView('chart')}><Icon name="chart" size={16} /> {t('chart')}</button>
      </div>
      {err && <div className="err">{err}</div>}
      {!d && !err && <p className="muted">{t('loading')}</p>}
      {d && (
        <>
          {studentId && (
            <div className="dstats">
              <Stat icon={<Icon name="present" size={18} />} tint="#22b57333" label={t('statPresent')} value={tot.present} />
              <Stat icon={<Icon name="absent" size={18} />} tint="#ff4d5e33" label={t('statAbsent')} value={tot.absent} />
              <Stat icon={<Icon name="clock" size={18} />} tint="#ffd24d33" label={t('statLate')} value={tot.late} />
              <Stat icon={<Icon name="unmarked" size={18} />} tint="#8a93b833" label={t('unmarkedDates')} value={d.unmarkedDates.length} />
              <Stat icon={<Icon name="rate" size={18} />} tint="#3b5bdb33" label={t('attRate')} value={rateText(tot.rate)} />
            </div>
          )}
          {view === 'chart' && (
            <>
              <BarChart points={pts} onSelect={setSel} selected={sel} />
              <p className="radartip" aria-live="polite">{sp ? <><b>{sp.short}</b>: {sp.rate}% — {sp.present + sp.late}/{sp.marked} {t('attended')}{sp.excused ? `, ${sp.excused} ${t('statExcused').toLowerCase()}` : ''}</> : t('hoverHint')}</p>
            </>
          )}
          <p className="muted small">{t('calcMethod')} · {t('entriesCount')}: <b>{tot.entries}</b> · {t('overallRate')}: <b>{rateText(tot.rate)}</b></p>
          {pts.some((p) => p.rate === null) && <p className="muted small">{t('noRecordNote')}</p>}
          {studentId && d.unmarkedDates.length > 0 && <p className="muted small">{t('unmarkedDates')}: {d.unmarkedDates.map((x) => dayLabel(x)[0]).join(', ')}</p>}
          {view === 'table' && (
            <div className="tblwrap"><table className="dt">
              {studentId ? (
                <>
                  <thead><tr><th className="left">{t('date')}</th><th className="left">{t('statusLbl')}</th><th className="left">{t('group')}</th><th className="left">{t('notes')}</th></tr></thead>
                  <tbody>
                    {d.records.map((r) => <tr key={r.date + r.group_name}><td className="left">{longDay(r.date)}</td><td className="left"><StatusPill s={r.status} /></td><td className="left">{r.group_name || '—'}</td><td className="left">—</td></tr>)}
                    {d.unmarkedDates.map((x) => <tr key={'u' + x}><td className="left">{longDay(x)}</td><td className="left"><StatusPill s="unmarked" /></td><td className="left">—</td><td className="left">—</td></tr>)}
                  </tbody>
                </>
              ) : (
                <>
                  <thead><tr><th className="left">{bucket === 'week' ? t('week') : t('date')}</th><th className="left">{t('statPresent')}</th><th className="left">{t('statLate')}</th><th className="left">{t('statAbsent')}</th><th className="left">{t('statExcused')}</th><th className="left">{t('attRate')}</th></tr></thead>
                  <tbody>{d.points.map((p) => (
                    <tr key={p.key} className={onOpenDate && bucket === 'day' && p.entries ? 'rowlink' : ''} onClick={() => onOpenDate && bucket === 'day' && p.entries && onOpenDate(p.key, gid)}>
                      <td className="left">{bucket === 'week' ? `${t('wk')} ${dayLabel(p.key)[0]}` : longDay(p.key)}</td>
                      <td className="left">{p.present}</td><td className="left">{p.late}</td><td className="left">{p.absent}</td><td className="left">{p.excused}</td>
                      <td className="left">{p.entries ? rateText(p.rate) : <span className="muted">{t('noRecord')}</span>}</td></tr>))}</tbody>
                </>
              )}
            </table></div>
          )}
        </>
      )}
    </div>
  );
}

export function AnalyticsPage({ groups, onOpenDate }) {
  return <div className="dcard"><h3><Icon name="chart" size={20} /> {t('attRate')}</h3><AttendanceAnalytics groups={groups} showGroup onOpenDate={onOpenDate} /></div>;
}

/* ---------- Student profile (single implementation for every list) ---------- */
export function StudentProfile({ id, isAdmin, onBack, onChanged, extras }) {
  const [p, setP] = useState(null);
  const [err, setErr] = useState('');
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [delDlg, setDelDlg] = useState(false);
  const load = () => api(`/api/teacher/students/${id}/profile`).then(setP).catch((x) => setErr(apiError(x)));
  useEffect(() => { setP(null); setErr(''); setEdit(null); load(); }, [id]);
  const back = <button className="dbtn ghost" onClick={onBack}><Icon name="back" size={16} /> {t('back')}</button>;
  if (err) return <div className="dcard">{back}<p className="err">{err}</p></div>;
  if (!p) return <div className="dcard">{back}<p className="muted">{t('loading')}</p></div>;
  const startEdit = () => setEdit({ firstName: p.first_name || '', lastName: p.last_name || '', phone: p.phone || '', birthday: p.birthday || '' });
  const validate = (e) => {
    if (!e.firstName.trim() || !e.lastName.trim()) return t('nameRequired');
    if (e.phone && !/^[+\d][\d\s()-]{5,28}$/.test(e.phone.trim())) return t('phoneInvalid');
    if (e.birthday && (e.birthday > iso(new Date()))) return t('birthdayInvalid');
    return '';
  };
  const save = async (ev) => {
    ev.preventDefault();
    const v = validate(edit); if (v) { setMsg(v); return; }
    setSaving(true); setMsg('');
    try { await api(`/api/teacher/students/${id}`, { method: 'PATCH', body: { ...edit, birthday: edit.birthday || undefined } }); setEdit(null); await load(); onChanged && onChanged(); setMsg('✅ ' + t('saved')); }
    catch (x) { setMsg('❌ ' + apiError(x)); }
    setSaving(false);
  };
  const decide = async (what) => {
    if (what === 'reject' && !confirm(t('confirmReject'))) return;
    try { await api(`/api/admin/users/${id}/${what}`, { method: 'POST' }); await load(); onChanged && onChanged(); } catch (x) { setMsg('❌ ' + apiError(x)); }
  };
  const F = ({ label, children }) => <div className="pfield"><small>{label}</small><div>{children || <NP />}</div></div>;
  return (
    <>
      {back}
      <div className="dcard" style={{ marginTop: 12 }}>
        <div className="profhead">
          <Ava u={p} size={72} />
          <div className="grow"><b className="pname">{p.full_name}</b><br /><ApprovalPill s={p.approval_status} /></div>
          <span className="acts">
            {isAdmin && !edit && <button className="dbtn" onClick={startEdit}><Icon name="edit" size={16} /> {t('editProfile')}</button>}
            {isAdmin && p.approval_status !== 'approved' && <button className="dbtn" onClick={() => decide('approve')}>{t('approve')}</button>}
            {isAdmin && <button className="dbtn danger" onClick={() => setDelDlg(true)}>{p.approval_status === 'rejected' ? t('remove') : t('reject')}</button>}
          </span>
        </div>
        {msg && <div className="dnote"><Status msg={msg} /></div>}
        {edit ? (
          <form onSubmit={save} className="editgrid">
            <label>{t('firstName')}<input value={edit.firstName} maxLength={50} onChange={(e) => setEdit({ ...edit, firstName: e.target.value })} required /></label>
            <label>{t('surname')}<input value={edit.lastName} maxLength={50} onChange={(e) => setEdit({ ...edit, lastName: e.target.value })} required /></label>
            <label>{t('phone')}<input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} placeholder="+998 90 123 45 67" /></label>
            <label>{t('birthday')}<input type="date" value={edit.birthday} max={iso(new Date())} onChange={(e) => setEdit({ ...edit, birthday: e.target.value })} /></label>
            <span className="acts"><button className="dbtn" disabled={saving}>{saving ? t('loading') : t('save')}</button><button type="button" className="dbtn ghost" onClick={() => { setEdit(null); setMsg(''); }}>{t('cancel')}</button></span>
          </form>
        ) : (
          <div className="pgridinfo">
            <F label={t('firstName')}>{p.first_name}</F><F label={t('surname')}>{p.last_name}</F><F label={t('fullName')}>{p.full_name}</F>
            <F label={t('birthday')}>{fmtDate(p.birthday)}</F><F label={t('age')}>{p.age !== null ? `${p.age} ${t('years')}` : ''}</F>
            <F label={t('phone')}>{p.phone}</F><F label={t('email')}>{p.email}</F><F label={t('joined')}>{fmtDate(p.created_at)}</F>
            <F label={t('statusLbl')}>{t('ap_' + p.approval_status)}</F>
            <F label={t('group')}>{p.group_name ? p.group_name + (p.group_archived_at ? ` (${t('archived')})` : '') : ''}</F>
            <F label={t('points')}><span className="ico-inline"><Icon name="star" size={15} /> {p.points}</span></F><F label={t('coins')}><span className="ico-inline"><Icon name="coins" size={15} /> {p.coins}</span></F>
            <F label={t('attendance')}>{rateText(p.att_rate === null ? null : Number(p.att_rate))}{p.marked_n ? ` (${p.present_n}/${p.marked_n})` : ''}</F>
          </div>
        )}
      </div>
      {delDlg && (
        <Modal title={<span className="ico-inline"><Icon name="trash" size={18} /> {t('reject')}: {p.full_name}</span>} onClose={() => setDelDlg(false)}>
          <p>{t('deleteStudentExplain')}</p>
          <span className="acts"><button className="dbtn danger" onClick={async () => { try { await api(`/api/admin/students/${id}`, { method: 'DELETE' }); onChanged && onChanged(); onBack(); } catch (x) { setMsg('❌ ' + apiError(x)); setDelDlg(false); } }}>{t('deleteAccount')}</button><button className="dbtn ghost" onClick={() => setDelDlg(false)}>{t('cancel')}</button></span>
        </Modal>
      )}
      <div className="dcard"><h3><Icon name="calendar" size={20} /> {t('attendanceAnalytics')}</h3><AttendanceAnalytics studentId={id} /></div>
      {extras}
    </>
  );
}


/* Dropdown that shows each teacher's photo and full name (native <select> cannot show images) */
function TeacherSelect({ teachers, value, onChange, required }) {
  const [open, setOpen] = useState(false);
  const cur = teachers.find((x) => x.id === value);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!e.target.closest || !e.target.closest('.tsel')) setOpen(false); };
    document.addEventListener('mousedown', close); document.addEventListener('touchstart', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('touchstart', close); };
  }, [open]);
  return (
    <div className="tsel">
      <button type="button" className="tselbtn" onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open} aria-required={required}>
        {cur ? <span className="who"><Ava u={cur} size={26} /> {cur.full_name}</span> : <span className="muted">{t('selectTeacher')}</span>}
        <Icon name="chevD" size={16} />
      </button>
      {open && (
        <ul className="tsellist" role="listbox">
          {!required && <li role="option" aria-selected={!value} onClick={() => { onChange(''); setOpen(false); }}><span className="muted">{t('noTeacherAssigned')}</span></li>}
          {teachers.length === 0 && <li className="muted">{t('noActiveTeachers')}</li>}
          {teachers.map((x) => <li key={x.id} role="option" aria-selected={x.id === value} onClick={() => { onChange(x.id); setOpen(false); }}><span className="who"><Ava u={x} size={28} /> {x.full_name}</span></li>)}
        </ul>
      )}
    </div>
  );
}

/* ---------- Groups: create / edit / archive / delete ---------- */
export function GroupsPage({ isAdmin, reloadGroups }) {
  const [tab, setTab] = useState('active');
  const [list, setList] = useState([]);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [tid, setTid] = useState('');
  const [maxN, setMaxN] = useState('');
  const [startD, setStartD] = useState('');
  const [endD, setEndD] = useState('');
  const [fTeacher, setFTeacher] = useState('');
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState(null);
  const [members, setMembers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [dlg, setDlg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [teachers, setTeachers] = useState([]);
  useEffect(() => { if (isAdmin) api('/api/admin/teachers').then((r) => setTeachers(r.filter((x) => x.is_active !== false && x.approval_status === 'approved'))).catch(() => {}); }, [isAdmin]);
  const load = () => api('/api/teacher/groups?archived=1').then(setList).catch((x) => setMsg('❌ ' + apiError(x)));
  useEffect(() => { load(); }, []);
  const shown = list.filter((g) => (tab === 'active' ? !g.archived_at : g.archived_at) && (!fTeacher || g.teacher_id === fTeacher));
  const refresh = () => { load(); reloadGroups && reloadGroups(); };
  const run = async (fn, ok) => {
    setBusy(true); setMsg('');
    try { await fn(); setMsg('✅ ' + ok); refresh(); setDlg(null); setEditing(null); } catch (x) { setMsg('❌ ' + apiError(x)); setDlg(null); }
    setBusy(false);
  };
  const create = (e) => {
    e.preventDefault();
    if (name.trim().length < 2) return setMsg('❌ ' + t('groupNameShort'));
    if (!tid) return setMsg('❌ ' + t('teacherRequired'));
    if (startD && endD && endD < startD) return setMsg('❌ ' + t('endBeforeStart'));
    run(() => api('/api/teacher/groups', { method: 'POST', body: { name, teacherId: tid, description: desc, maxStudents: maxN || null, startDate: startD || null, endDate: endD || null } })
      .then(() => { setName(''); setDesc(''); setTid(''); setMaxN(''); setStartD(''); setEndD(''); }), t('groupCreated'));
  };
  const toggleOpen = async (g) => {
    if (open === g.id) return setOpen(null);
    setOpen(g.id); setMembers([]);
    api(`/api/teacher/groups/${g.id}/members`).then(setMembers).catch(() => {});
  };
  return (
    <>
      {isAdmin && (
        <form className="dcard groupform" onSubmit={create}>
          <h3><Icon name="plus" size={18} /> {t('createGroup')}</h3>
          <div className="gfgrid">
            <label>{t('groupName')} *<input placeholder={t('newGroupPh')} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} required /></label>
            <label>{t('assignTeacher')} *<TeacherSelect teachers={teachers} value={tid} onChange={setTid} required /></label>
            <label className="wide">{t('description')}<input placeholder={t('groupDescPh')} value={desc} maxLength={300} onChange={(e) => setDesc(e.target.value)} /></label>
            <label>{t('maxStudents')}<input type="number" min="1" max="1000" value={maxN} onChange={(e) => setMaxN(e.target.value)} placeholder="25" /></label>
            <label>{t('startDate')}<input type="date" value={startD} onChange={(e) => setStartD(e.target.value)} /></label>
            <label>{t('endDate')}<input type="date" value={endD} min={startD || undefined} onChange={(e) => setEndD(e.target.value)} /></label>
          </div>
          {teachers.length === 0 && <p className="err">{t('noActiveTeachers')}</p>}
          <button className="dbtn" disabled={busy || teachers.length === 0}>{t('createGroup')}</button>
        </form>
      )}
      {msg && <div className="dnote"><Status msg={msg} /></div>}
      <div className="dcard">
        <div className="dtools">
          <button className={'dbtn' + (tab === 'active' ? '' : ' ghost')} onClick={() => setTab('active')}>{t('activeGroups')} ({list.filter((g) => !g.archived_at).length})</button>
          <button className={'dbtn' + (tab === 'archived' ? '' : ' ghost')} onClick={() => setTab('archived')}>{t('archivedGroups')} ({list.filter((g) => g.archived_at).length})</button>
          <select value={fTeacher} onChange={(e) => setFTeacher(e.target.value)} aria-label={t('filterByTeacher')}><option value="">{t('allTeachers')}</option>{teachers.map((x) => <option key={x.id} value={x.id}>{x.full_name}</option>)}</select>
        </div>
        {shown.length === 0 && <p className="muted">{tab === 'active' ? t('noGroups') : t('noArchived')}</p>}
        {shown.map((g) => (
          <div key={g.id} className="grow-item">
            <div className="drow" style={{ borderTop: 0 }}>
              {editing && editing.id === g.id ? (
                <form className="dtools" style={{ margin: 0, flex: 1 }} onSubmit={(e) => { e.preventDefault(); run(() => api(`/api/teacher/groups/${g.id}`, { method: 'PATCH', body: { name: editing.name, description: editing.description, teacherId: editing.teacherId || null, maxStudents: editing.maxStudents || null, startDate: editing.startDate || null, endDate: editing.endDate || null } }), t('saved')); }}>
                  <input value={editing.name} maxLength={60} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required />
                  <input value={editing.description} maxLength={300} placeholder={t('groupDescPh')} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
                  <TeacherSelect teachers={teachers} value={editing.teacherId} onChange={(v) => setEditing({ ...editing, teacherId: v })} />
                  <input type="number" min="1" max="1000" value={editing.maxStudents} placeholder={t('maxStudents')} onChange={(e) => setEditing({ ...editing, maxStudents: e.target.value })} aria-label={t('maxStudents')} />
                  <input type="date" value={editing.startDate} onChange={(e) => setEditing({ ...editing, startDate: e.target.value })} aria-label={t('startDate')} />
                  <input type="date" value={editing.endDate} min={editing.startDate || undefined} onChange={(e) => setEditing({ ...editing, endDate: e.target.value })} aria-label={t('endDate')} />
                  <button className="dbtn" disabled={busy}>{t('save')}</button><button type="button" className="dbtn ghost" onClick={() => setEditing(null)}>{t('cancel')}</button>
                </form>
              ) : (
                <span><b>{g.name}</b> <small className="muted">· {g.members}{g.max_students ? ' / ' + g.max_students : ''} {t('studentsLower')} · {g.attendance_records} {t('attRecords')} · {g.teacher_name ? g.teacher_name : t('noTeacherAssigned')}</small>{g.archived_at && <small className="muted"> · {t('archivedOn')} {fmtDate(g.archived_at)}</small>}{g.description && <><br /><small className="muted">{g.description}</small></>}</span>
              )}
              <span className="acts">
                <button className="dbtn ghost" onClick={() => toggleOpen(g)}>{open === g.id ? t('hide') : t('viewStudents')}</button>
                {isAdmin && !g.archived_at && <button className="dbtn ghost" onClick={() => setEditing({ id: g.id, name: g.name, description: g.description || '', teacherId: g.teacher_id || '', maxStudents: g.max_students || '', startDate: g.start_date || '', endDate: g.end_date || '' })}><Icon name="edit" size={16} /> {t('edit')}</button>}
                {isAdmin && !g.archived_at && <button className="dbtn" onClick={() => setDlg({ type: 'archive', g })}><Icon name="archive" size={16} /> {t('archive')}</button>}
                {isAdmin && g.archived_at && <button className="dbtn" onClick={() => run(() => api(`/api/teacher/groups/${g.id}/unarchive`, { method: 'POST' }), t('restored'))}><Icon name="restore" size={16} /> {t('restore')}</button>}
                {isAdmin && <button className="dbtn danger" onClick={() => setDlg({ type: 'delete', g })}><Icon name="trash" size={16} /> {t('remove')}</button>}
              </span>
            </div>
            {open === g.id && (
              <div className="memlist">{members.length === 0 ? <small className="muted">{t('noStudentsInGroup')}</small> : members.map((m) => <span key={m.id} className="fchip"><Ava u={m} size={20} /> {m.full_name}</span>)}</div>
            )}
          </div>
        ))}
      </div>
      {dlg && dlg.type === 'archive' && (
        <Modal title={<span className="ico-inline"><Icon name="archive" size={18} /> {t('archive')}: {dlg.g.name}</span>} onClose={() => setDlg(null)}>
          <p>{t('archiveExplain')}</p>
          <span className="acts"><button className="dbtn" disabled={busy} onClick={() => run(() => api(`/api/teacher/groups/${dlg.g.id}/archive`, { method: 'POST' }), t('archivedOk'))}>{t('archive')}</button><button className="dbtn ghost" onClick={() => setDlg(null)}>{t('cancel')}</button></span>
        </Modal>
      )}
      {dlg && dlg.type === 'delete' && (
        <Modal title={<span className="ico-inline"><Icon name="trash" size={18} /> {t('deleteGroup')}: {dlg.g.name}</span>} onClose={() => setDlg(null)}>
          {dlg.g.members > 0 || dlg.g.attendance_records > 0 ? (
            <><p>{t('deleteBlocked')} <b>{dlg.g.members}</b> {t('studentsLower')}, <b>{dlg.g.attendance_records}</b> {t('attRecords')}.</p>
              <span className="acts">{!dlg.g.archived_at && <button className="dbtn" onClick={() => setDlg({ type: 'archive', g: dlg.g })}><Icon name="archive" size={16} /> {t('archive')}</button>}<button className="dbtn ghost" onClick={() => setDlg(null)}>{t('cancel')}</button></span></>
          ) : (
            <><p>{t('deleteExplain')}</p>
              <span className="acts"><button className="dbtn danger" disabled={busy} onClick={() => run(() => api(`/api/teacher/groups/${dlg.g.id}`, { method: 'DELETE' }), t('deletedOk'))}>{t('deleteGroup')}</button><button className="dbtn ghost" onClick={() => setDlg(null)}>{t('cancel')}</button></span></>
          )}
        </Modal>
      )}
    </>
  );
}

/* ---------- Teachers (admin only) ---------- */
export function TeachersPage({ onNav, onChat }) {
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [selId, setSelId] = useState(null);
  const [ov, setOv] = useState(null);
  const [ovErr, setOvErr] = useState('');
  const [tab, setTab] = useState('overview');
  useEffect(() => {
    setErr('');
    api('/api/admin/teachers?' + qs({ search: q })).then((r) => { setRows(r); setSelId((c) => (c && r.some((x) => x.id === c) ? c : r[0] ? r[0].id : null)); }).catch((x) => setErr(apiError(x)));
  }, [q]);
  useEffect(() => {
    if (!selId) { setOv(null); return; }
    setOv(null); setOvErr('');
    api(`/api/admin/teachers/${selId}/overview`).then(setOv).catch((x) => setOvErr(apiError(x)));
  }, [selId]);
  const isOnline = (r) => !!(r.last_seen_at && Date.now() - new Date(r.last_seen_at).getTime() < 5 * 60 * 1000);
  const Badge = ({ r }) => <span className={'tbadge' + (isOnline(r) ? ' on' : '')}><i />{isOnline(r) ? t('online') : t('offline')}</span>;
  const sel = rows && rows.find((x) => x.id === selId);
  const act = ov ? ov.groups.filter((g) => !g.archived_at) : [];
  const pct = (v) => (v === null || v === undefined ? '–' : v + '%');
  return (
    <div className="tpage">
      <div className="dtools">
        <input placeholder={t('searchStudents')} value={search} onChange={(e) => setSearch(e.target.value)} aria-label={t('search')} />
        <button className="dbtn" onClick={() => onNav('promo')}><Icon name="promo" size={16} /> {t('createPromo')}</button>
      </div>
      {err && <div className="err">{err}</div>}
      {!rows && !err && <p className="muted">{t('loading')}</p>}
      {rows && rows.length === 0 && <p className="muted">{search ? t('noResults') : t('noTeachers')}</p>}
      {rows && rows.length > 0 && (
        <div className="tcards">
          {rows.map((r) => (
            <button type="button" key={r.id} className={'tcard' + (r.id === selId ? ' on' : '')} onClick={() => { setSelId(r.id); setTab('overview'); }}>
              <span className="tav"><Ava u={r} size={92} /><Badge r={r} /></span>
              <b>{r.full_name}</b>
              <small>{r.group_count} {t('groupsLower')}{r.is_active === false ? ' · ' + t('inactive') : ''}</small>
              <span className="tview">{t('viewProfile')} <Icon name="next" size={14} /></span>
            </button>
          ))}
        </div>
      )}
      {sel && (
        <div className="tdetail">
          <aside className="tprofile">
            <span className="tbig"><Ava u={sel} size={132} /></span>
            <Badge r={sel} />
            <h3>{sel.full_name}</h3>
            <small className="muted">{t('roleTeacher')}</small>
            <div className="tcontact">
              <span className="ico-inline"><Icon name="mail" size={15} /> {sel.email}</span>
              <span className="ico-inline"><Icon name="chat" size={15} /> {sel.phone || <NP />}</span>
              <span className="ico-inline"><Icon name="calendar" size={15} /> {t('joined')}: {fmtDate(sel.created_at)}</span>
            </div>
            {onChat && <button type="button" className="dbtn startbtn" onClick={onChat}><Icon name="chat" size={16} /> {t('message')}</button>}
          </aside>
          <section className="tmain">
            <div className="ttabs" role="tablist">
              {[['overview', 'home', t('overview')], ['groups', 'groups', `${t('groups')}`], ['analytics', 'chart', t('analyticsTab')]].map(([k, ic, lb]) => (
                <button type="button" key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
                  <Icon name={ic} size={16} /> {lb}{k === 'groups' && ov && <span className="countbadge">{ov.groups.length}</span>}
                </button>
              ))}
            </div>
            {ovErr && <div className="err">{ovErr}</div>}
            {!ov && !ovErr && <p className="muted">{t('loading')}</p>}
            {ov && tab === 'overview' && (
              <>
                <div className="tstats">
                  <div className="tstat"><Icon name="groups" size={28} /><div><b>{ov.stats.groups}</b><small>{t('groups')}</small></div></div>
                  <div className="tstat"><span className="tring" style={{ background: `conic-gradient(#22b573 ${(ov.stats.homework_pct || 0) * 3.6}deg, var(--d-line) 0)` }}><i>{pct(ov.stats.homework_pct)}</i></span><div><b>{t('overallProgress')}</b><small>{t('homework')}</small></div></div>
                  <div className="tstat"><Icon name="users" size={28} /><div><b>{ov.stats.students}</b><small>{t('students')}</small></div></div>
                </div>
                <div className="tgroups wide">
                  <div className="tgh"><b>{t('activeGroups')}</b><a onClick={() => setTab('groups')}>{t('seeAll')} <Icon name="next" size={14} /></a></div>
                  {act.length === 0 && <p className="muted">{t('noGroups')}</p>}
                  {act.map((g) => (
                    <div key={g.id} className="tgrow"><Icon name="groups" size={18} /><span className="tgn">{g.name}</span><span className="tgs">{g.students} {t('studentsLower')}</span><span className="spill present">{t('active')}</span></div>
                  ))}
                </div>
              </>
            )}
            {ov && tab === 'groups' && (
              <div className="tgroups wide">
                {ov.groups.length === 0 && <p className="muted">{t('noGroups')}</p>}
                {ov.groups.map((g) => (
                  <div key={g.id} className="tgrow"><Icon name="groups" size={18} /><span className="tgn">{g.name}</span><span className="tgs">{g.students} {t('studentsLower')}</span>
                    <span className="tgs">{t('homework')} {pct(g.hw_pct)}</span><span className="tgs">{t('attendance')} {pct(g.att_pct)}</span>
                    <span className={'spill ' + (g.archived_at ? 'unmarked' : 'present')}>{g.archived_at ? t('archived') : t('active')}</span></div>
                ))}
              </div>
            )}
            {ov && tab === 'analytics' && (
              <div className="tgroups wide">
                {ov.groups.filter((g) => !g.archived_at).length === 0 && <p className="muted">{t('noGroups')}</p>}
                {ov.groups.filter((g) => !g.archived_at).map((g) => (
                  <div key={g.id} className="tbars"><b>{g.name}</b>
                    <span className="tbar"><small>{t('homework')}</small><span><i style={{ width: (g.hw_pct || 0) + '%' }} /></span><em>{pct(g.hw_pct)}</em></span>
                    <span className="tbar att"><small>{t('attendance')}</small><span><i style={{ width: (g.att_pct || 0) + '%' }} /></span><em>{pct(g.att_pct)}</em></span>
                  </div>
                ))}
                <p className="muted small">{t('calcMethod')}</p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

/* ---------- Events: complete list ("See all") ---------- */
export function EventsAllPage({ onBack, isStudent }) {
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(0);
  const load = () => api('/api/events').then(setList).catch((x) => setErr(apiError(x)));
  useEffect(() => { load(); }, []);
  const book = async (e) => {
    setBusy(e.id); setErr('');
    try { await api(`/api/events/${e.id}/register`, { method: e.joined ? 'DELETE' : 'POST' }); await load(); } catch (x) { setErr(apiError(x)); }
    setBusy(0);
  };
  const fmtAt = (d) => new Date(d).toLocaleString(locale(), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return (
    <div className="dcard">
      {onBack && <button type="button" className="dbtn ghost backbtn" onClick={onBack}><Icon name="back" size={16} /> {t('back')}</button>}
      <h3><Icon name="events" size={20} /> {t('events')} {list && <span className="countbadge">{list.length}</span>}</h3>
      {err && <div className="err">{err}</div>}
      {!list && !err && <p className="muted">{t('loading')}</p>}
      {list && list.length === 0 && <p className="muted">{t('noEvents')}</p>}
      {list && list.length > 0 && (
        <div className="evgrid">
          {list.map((e) => (
            <article key={e.id} className="devcard">
              <div className="devimg" style={e.cover_url ? { backgroundImage: `url(${API + e.cover_url})` } : undefined}><span className="tag">{e.category}</span></div>
              <div className="devbody">
                <b>{e.title}</b>
                <small className="ico-inline"><Icon name="calendar" size={14} /> {fmtAt(e.starts_at)}</small>
                {e.location && <small className="ico-inline"><Icon name="pin" size={14} /> {e.location}</small>}
                <small className="ico-inline"><Icon name="users" size={14} /> {e.registered}{e.max_participants ? ' / ' + e.max_participants : ''}</small>
                {e.description && <small>{e.description}</small>}
                {isStudent && (() => { const full = !e.joined && e.max_participants && e.registered >= e.max_participants; return (
                  <button type="button" className={'dbtn' + (e.joined ? ' ghost' : '')} disabled={busy === e.id || full} onClick={() => book(e)}>{e.joined ? t('cancelBooking') : full ? t('eventFull') : t('bookEvent')}</button>); })()}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}


/* Clicking a homework percentage: the exercises this student got wrong / revealed with a key / has not done (for discussion at the start of the lesson) */
export function MistakesModal({ sid, name, from, to, hid, onClose }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [all, setAll] = useState(false);
  useEffect(() => { api(`/api/teacher/homework-progress/${sid}?` + qs({ from, to, homeworkId: hid })).then(setD).catch((x) => setErr(apiError(x))); }, [sid, from, to, hid]);
  const items = d ? d.items.filter((x) => all || x.state !== 'correct') : [];
  const order = { revealed: 0, wrong: 1, pending: 2, correct_after_mistakes: 3, correct: 4 };
  items.sort((a, b) => order[a.state] - order[b.state]);
  return (
    <Modal title={<span className="ico-inline"><Icon name="homework" size={18} /> {name}</span>} onClose={onClose}>
      {err && <div className="err">{err}</div>}
      {!d && !err && <p className="muted">{t('loading')}</p>}
      {d && (
        <>
          <p className="muted small">{d.correct}/{d.total} {t('hwState_correct').toLowerCase()} · {t('hwDiscuss')}</p>
          <label className="muted small"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> {t('hwShowAll')}</label>
          {items.length === 0 && <p className="okmsg">{t('hwNothingToDiscuss')}</p>}
          <div className="hwdetail">
            {items.map((x) => (
              <div key={x.exercise_id} className={'hwex st-' + x.state}>
                <small className="muted">{x.homework_title} · {longDay(x.due_date)}</small>
                <b>{x.question}</b>
                {x.options && <small className="muted">{x.options.join(' / ')}</small>}
                <span className="chiprow"><span className={'spill hws-' + x.state}>{t('hwState_' + x.state)}</span>
                  {x.wrong_attempts > 0 && <small>{x.wrong_attempts} {t('hwAttempts')}</small>}</span>
                {x.last_answer && x.state !== 'correct' && <small>{t('hwStudentAnswer')}: <b>{x.last_answer}</b></small>}
                <small>{t('hwCorrect')}: <b>{x.answer}</b></small>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}

/* ---------- Homework progress: READ-ONLY (no create / edit / delete / mark-done controls) ---------- */
const hwTone = (pct) => (pct < 50 ? 'red' : pct < 70 ? 'yellow' : 'green'); // <50 red, 50–<70 yellow, >=70 green
const REASON_ICON = { illness: 'illness', event: 'calendarClock', other: 'note' };
