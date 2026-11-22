import { useEffect, useMemo, useState } from 'react';
import { api, API } from './api';
import { Icon } from './icons.jsx';
import { t, locale } from './i18n.js';
import { SavedWords } from './Homework.jsx';

/* Student home. Layout follows the design: 4 stat cards, then My Progress / Upcoming Events / Weekly Ranking,
   then Stories / Games / Vocabulary Lists / Achievements. Everything shown here comes from the real backend. */

export const greeting = () => { const h = new Date().getHours(); return h < 12 ? t('greetMorning') : h < 18 ? t('greetAfternoon') : t('greetEvening'); };

function Spark({ values, color }) {
  const v = values.length > 1 ? values : [0, 0];
  const min = Math.min(...v), max = Math.max(...v), w = 120, h = 44;
  const pts = v.map((y, i) => [(i / (v.length - 1)) * w, h - 4 - (max === min ? 0.5 : (y - min) / (max - min)) * (h - 10)]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id={'sg' + color.slice(1)} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".35" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={d + ` L ${w} ${h} L 0 ${h} Z`} fill={`url(#sg${color.slice(1)})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// cumulative running total of the last transactions (oldest first) ending at `now`
function series(tx, key, now) {
  const rows = [...tx].reverse().slice(-8); // API returns newest first
  const total = rows.reduce((a, r) => a + Number(r[key] || 0), 0);
  let run = now - total; const out = [run];
  rows.forEach((r) => { run += Number(r[key] || 0); out.push(run); });
  return out;
}
const weekSum = (tx, key) => tx.filter((r) => Date.now() - new Date(r.created_at).getTime() < 7 * 86400000).reduce((a, r) => a + Number(r[key] || 0), 0);

function StatCard({ icon, tone, label, value, delta, spark, color, onClick, extra }) {
  return (
    <button type="button" className={'sh-stat ' + tone} onClick={onClick}>
      <span className="sh-sico">{icon}</span>
      <span className="sh-stxt"><small>{label}</small><b>{value}</b>{delta !== undefined && delta !== null && <em className={delta >= 0 ? 'up' : 'dn'}>{delta >= 0 ? '↑ +' : '↓ '}{delta}</em>}{extra}</span>
      {spark && <Spark values={spark} color={color} />}
    </button>
  );
}

const STATUS = { done: ['ok', 'completedWord'], prog: ['play', 'inProgressWord'], none: ['dot', 'notStartedWord'] };
function ProgressRow({ label, done, total }) {
  const k = total > 0 && done >= total ? 'done' : done > 0 ? 'prog' : 'none';
  return (
    <div className={'sh-prow ' + k}>
      <span className="sh-pdot"><Icon name={STATUS[k][0]} size={k === 'none' ? 20 : 22} /></span>
      <span className="sh-plab">{label}</span>
      <span className="sh-pst">{t(STATUS[k][1])}{k === 'prog' ? ` · ${done} / ${total}` : ''}</span>
    </div>
  );
}

const when = (iso) => { const d = new Date(iso); return { mon: d.toLocaleDateString(locale(), { month: 'short' }).toUpperCase(), day: d.getDate(), time: d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', hour12: false }) }; };

export default function StudentHome({ user, nav, onHomework, StoryViewer }) {
  const [rank, setRank] = useState({});
  const [sum, setSum] = useState(null);
  const [hw, setHw] = useState([]);
  const [tx, setTx] = useState([]);
  const [events, setEvents] = useState([]);
  const [weekly, setWeekly] = useState(null);
  const [stories, setStories] = useState([]);
  const [story, setStory] = useState(null);
  const [saved, setSaved] = useState(false);
  const [soon, setSoon] = useState('');
  useEffect(() => {
    api('/api/points/ranking').then(setRank).catch(() => {});
    api('/api/homework/summary').then(setSum).catch(() => {});
    api('/api/homework').then(setHw).catch(() => {});
    api('/api/points/me').then(setTx).catch(() => {});
    api('/api/events').then(setEvents).catch(() => {});
    api('/api/points/weekly').then(setWeekly).catch(() => {});
    api('/api/stories').then(setStories).catch(() => {});
  }, []);
  const tasks = hw.filter((h) => (h.exercise_count > 0 || h.word_count > 0 || h.has_video) && !h.locked && (h.pct ?? 0) < 100).length;
  const upcoming = useMemo(() => events.filter((e) => new Date(e.starts_at).getTime() >= Date.now() - 3600000).slice(0, 2), [events]);
  const ptsWeek = weekSum(tx, 'points_delta'), coinsWeek = weekSum(tx, 'coins_delta');
  const first = rank.group_rank === 1;
  const medals = ['#f5b301', '#aab4cf', '#d98a4a'];

  const ach = [
    { k: 'achFirst', icon: 'trophy', on: first },
    { k: 'achUnits', icon: 'flame', on: !!sum && sum.perfect >= 1, n: sum ? sum.perfect : 0 },
    { k: 'achPerfect', icon: 'cap', on: !!sum && sum.perfect >= 3 },
    { k: 'achCoins', icon: 'target', on: (user.coins || 0) >= 100 },
  ];
  const games = [['gWordMatch', 'gamepad', 'g1'], ['gQuickQuiz', 'gamepad', 'g2'], ['gScramble', 'gamepad', 'g3']];

  return (
    <div className="sh">
      <div className="sh-stats">
        <StatCard tone="p" color="#a78bfa" icon={<Icon name="star" size={26} fill="currentColor" />} label={t('points')} value={(user.points || 0).toLocaleString(locale())} delta={ptsWeek} spark={series(tx, 'points_delta', user.points || 0)} onClick={() => nav && nav('points')} />
        <StatCard tone="c" color="#f5a524" icon={<Icon name="coins" size={26} />} label={t('coins')} value={(user.coins || 0).toLocaleString(locale())} delta={coinsWeek} spark={series(tx, 'coins_delta', user.coins || 0)} onClick={() => nav && nav('coins')} />
        <StatCard tone="r" color="#f5b301" icon={<Icon name="trophy" size={26} />} label={t('ranking')} value={'#' + (rank.group_rank ?? '-')} extra={<em>{t('inGroup')}</em>} spark={null} onClick={() => nav && nav('ranking')} />
        <button type="button" className="sh-stat h" onClick={onHomework}>
          <span className="sh-sico"><Icon name="homework" size={26} /></span>
          <span className="sh-stxt"><small>{t('myHomework')}</small><b>{tasks} <span className="sh-unit">{t('hwTasks')}</span></b></span>
          <span className="sh-go"><Icon name="chevR" size={18} /></span>
        </button>
      </div>

      <div className="sh-row3">
        <section className="sh-card sh-progress">
          <div className="sh-head"><h3><Icon name="zap" size={20} className="gold" /> {t('yourProgress')}</h3><b className="sh-pct">{sum ? sum.overall : 0}%</b></div>
          <div className="sh-bar"><i style={{ width: (sum ? sum.overall : 0) + '%' }} /></div>
          <div className="sh-pbody">
            <div className="sh-plist">
              <ProgressRow label={t('hwPartVocab')} done={sum ? sum.vocab.done : 0} total={sum ? sum.vocab.total : 0} />
              <ProgressRow label={t('hwPartVideo')} done={sum ? sum.video.done : 0} total={sum ? sum.video.total : 0} />
              <ProgressRow label={t('hwExercises')} done={sum ? sum.exercises.done : 0} total={sum ? sum.exercises.total : 0} />
            </div>
            <div className="sh-cap" aria-hidden="true"><Icon name="cap" size={84} strokeWidth={1.3} /></div>
          </div>
        </section>

        <section className="sh-card sh-events">
          <div className="sh-head"><h3><Icon name="calendar" size={20} className="blue" /> {t('upcomingEvents')}</h3><a className="sh-all" onClick={() => nav && nav('events')}>{t('seeAll')} →</a></div>
          {upcoming.length === 0 && <p className="muted">{t('noUpcoming')}</p>}
          {upcoming.map((e) => { const w = when(e.starts_at); return (
            <button type="button" key={e.id} className="sh-event" onClick={() => nav && nav('events')}>
              <span className="sh-date"><small>{w.mon}</small><b>{w.day}</b></span>
              <span className="sh-einfo"><b>{e.title}</b><small><Icon name="clock" size={13} /> {w.time}</small>{e.location && <small><Icon name="pin" size={13} /> {e.location}</small>}</span>
              <Icon name="next" size={18} />
            </button>); })}
        </section>

        <section className="sh-card sh-weekly">
          <div className="sh-head"><h3><Icon name="trophy" size={20} className="gold" /> {t('weeklyRanking')}</h3><a className="sh-all" onClick={() => nav && nav('ranking')}>{t('seeAll')} →</a></div>
          {weekly && weekly.top.map((u, i) => (
            <div key={u.id} className={'sh-rank' + (u.id === user.id ? ' me' : '')}>
              <span className="sh-medal" style={{ background: medals[i] }}>{i + 1}</span>
              {u.avatar_url ? <img className="dava" style={{ width: 34, height: 34 }} src={API + u.avatar_url} alt="" /> : <span className="dava ph" style={{ width: 34, height: 34 }}>{(u.full_name || '?')[0]}</span>}
              <b className="sh-rname">{u.full_name}</b>
              <span className="sh-rpts">{u.pts} pts</span>
            </div>
          ))}
          {weekly && weekly.top.length === 0 && <p className="muted">{t('noGroup')}</p>}
          {weekly && weekly.me && (
            <div className={'sh-you' + (weekly.me.rank === 1 ? ' first' : '')}>
              <Icon name="crown" size={18} /> {weekly.me.rank === 1 ? t('youAreFirst') : `${t('youAreN')}: #${weekly.me.rank}`}
            </div>
          )}
        </section>
      </div>

      <div className="sh-row4">
        <section className="sh-card sh-storiesc">
          <div className="sh-head"><h3><Icon name="stories" size={20} className="blue" /> {t('stories')}</h3></div>
          {stories.length === 0 && <p className="muted">{t('noStory')}</p>}
          <div className="sh-stories">
            {stories.slice(0, 3).map((s, i) => (
              <button type="button" key={s.id} className="sh-story" onClick={() => setStory(i)}>
                {s.media_type === 'image' ? <img src={API + s.media_url} alt="" /> : <span className="sh-vid"><Icon name="play" size={22} /></span>}
                <span>{s.title || s.category}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="sh-card sh-vocab">
          <div className="sh-head"><h3><Icon name="homework" size={20} className="blue" /> {t('vocabLists')}</h3></div>
          <div className="sh-vbody">
            <Icon name="bookmark" size={64} strokeWidth={1.3} className="sh-vbig" />
            <div><small className="muted">{t('myVocabulary')}</small><b className="sh-vnum">{sum ? sum.saved : 0} <span className="sh-unit">{t('hwWords')}</span></b></div>
            <button type="button" className="sh-btn" onClick={() => setSaved(true)}>{t('viewBtn')} →</button>
          </div>
        </section>

        <section className="sh-card sh-achc">
          <div className="sh-head"><h3><Icon name="medal" size={20} className="gold" /> {t('achievementsTitle')}</h3></div>
          <div className="sh-ach">
            {ach.map((a) => (
              <div key={a.k} className={'sh-hex' + (a.on ? ' on' : '')} title={t(a.k)}>
                <span><Icon name={a.icon} size={24} /></span><small>{a.k === 'achUnits' && a.n ? `${a.n} · ` : ''}{t(a.k)}</small>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="sh-card sh-gamesec">
        <div className="sh-head"><h3><Icon name="gamepad" size={20} className="blue" /> {t('gamesTitle')}</h3></div>
        <div className="sh-games">
          {games.map(([k, ic, c]) => (
            <button type="button" key={k} className={'sh-game ' + c} onClick={() => { setSoon(k); setTimeout(() => setSoon(''), 1800); }}>
              <Icon name={ic} size={28} /><span>{t(k)}</span><Icon name="chevR" size={16} className="sh-gchev" />{soon === k && <em>{t('gSoon')}</em>}
            </button>
          ))}
        </div>
      </section>

      {story !== null && StoryViewer && <StoryViewer stories={stories} start={story} isAdmin={false} onDeleted={() => {}} onClose={() => setStory(null)} />}
      {saved && <SavedWords onClose={() => setSaved(false)} />}
    </div>
  );
}
