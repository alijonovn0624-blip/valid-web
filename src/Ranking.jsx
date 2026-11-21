import { useEffect, useState } from 'react';
import { api, API } from './api';
import { Icon } from './icons.jsx';
import { t, apiError } from './i18n.js';
import { Modal } from './Pages.jsx';

function Av({ u, size = 48 }) {
  const st = { width: size, height: size, fontSize: size * 0.42 };
  return u.avatar_url ? <img className="rkav" style={st} src={API + u.avatar_url} alt="" /> : <span className="rkav ph" style={st}>{(u.full_name || '?')[0]}</span>;
}

/* Public profile of another student: only what the ranking already shows plus a few achievements (no email / phone / birthday) */
function PublicProfile({ id, onClose }) {
  const [p, setP] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api('/api/points/profile/' + id).then(setP).catch((x) => setErr(apiError(x))); }, [id]);
  return (
    <Modal title="" onClose={onClose}>
      {err && <div className="err">{err}</div>}
      {!p && !err && <p className="muted">{t('loading')}</p>}
      {p && (
        <div className="pubprof">
          <Av u={p} size={104} />
          <h2>{p.full_name}</h2>
          <p className="muted">{p.group_name || t('noGroup')}{p.level ? ' | ' + p.level : ''}</p>
          <div className="pubtiles two">
            <div className="pubtile"><Icon name="coins" size={30} className="gold" /><b>{p.coins}</b></div>
            <div className="pubtile"><Icon name="star" size={30} className="gold" fill="currentColor" /><b>{p.points}</b></div>
          </div>
          <div className="pubtiles three">
            <div className="pubtile sm"><Icon name="medal" size={26} className="grn" /><b>#{p.group_rank ?? '-'}</b><small>{t('groupRank')}</small></div>
            <div className="pubtile sm"><Icon name="trophy" size={26} className="gold" /><b>#{p.global_rank ?? '-'}</b><small>{t('overallRank')}</small></div>
            <div className="pubtile sm"><Icon name="flame" size={26} className="hot" /><b>{p.streak_days || 0}</b><small>{t('streakDays')}</small></div>
          </div>
          <p className="muted small">{t('partsDone')}: <b>{p.parts_done}</b></p>
        </div>
      )}
    </Modal>
  );
}

export function Ranking({ me }) {
  const [scope, setScope] = useState('all');
  const [rows, setRows] = useState(null);
  const [mine, setMine] = useState({});
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(null);
  useEffect(() => { api('/api/points/ranking').then(setMine).catch(() => {}); }, []);
  useEffect(() => { setRows(null); setErr(''); api('/api/points/leaderboard?scope=' + scope).then(setRows).catch((x) => setErr(apiError(x))); }, [scope]);
  const top = rows ? rows.slice(0, 3) : [];
  const podium = [top[1], top[0], top[2]]; // silver | gold | bronze
  const myRank = scope === 'group' ? mine.group_rank : mine.global_rank;
  return (
    <div className="rk">
      <div className="rkhero">
        <h2 className="rktitle"><Icon name="trophy" size={22} /> {t('ranking')}</h2>
        {rows && rows.length > 0 && (
          <div className="podium">
            {podium.map((u, k) => {
              const pos = [2, 1, 3][k];
              return u ? (
                <button type="button" key={u.id} className={'pcol p' + pos} onClick={() => setOpen(u.id)}>
                  {pos === 1 && <Icon name="crown" size={26} className="crown" />}
                  <span className="pav"><Av u={u} size={pos === 1 ? 84 : 66} /></span>
                  <b className="pname">{u.full_name}</b>
                  <span className="ppts"><Icon name="star" size={13} fill="currentColor" /> {u.points}</span>
                  <span className="pblock">{pos}</span>
                </button>
              ) : <span key={'e' + k} />;
            })}
          </div>
        )}
      </div>
      <div className="rktabs" role="tablist">
        <button type="button" role="tab" aria-selected={scope === 'all'} className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>{t('rankGeneral')}</button>
        <button type="button" role="tab" aria-selected={scope === 'group'} className={scope === 'group' ? 'on' : ''} onClick={() => setScope('group')}>{t('rankGroup')}</button>
      </div>
      {err && <div className="err">{err}</div>}
      {!rows && !err && <p className="muted">{t('loading')}</p>}
      {rows && rows.length === 0 && <p className="muted">{t('noRanking')}</p>}
      <div className="rklist">
        {(rows || []).map((u) => (
          <button type="button" key={u.id} className={'rkrow' + (me && u.id === me.id ? ' me' : '')} onClick={() => setOpen(u.id)}>
            <span className="rknum">{u.rank}</span>
            <Av u={u} size={44} />
            <span className="rkname"><b>{u.full_name}</b><small>{u.group_name || ''}{me && u.id === me.id ? ` · ${t('you')}` : ''}</small></span>
            <span className="rkpts"><Icon name="star" size={14} fill="currentColor" /> {u.points}</span>
            {u.rank <= 3 && <Icon name="medal" size={22} className={'medal m' + u.rank} />}
          </button>
        ))}
      </div>
      {me && (
        <div className="rkyou">
          <Av u={me} size={38} />
          <span><b>{t('yourPlace')}</b><small>#{myRank ?? '-'} · {me.points} {t('points').toLowerCase()}</small></span>
        </div>
      )}
      {open && <PublicProfile id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
