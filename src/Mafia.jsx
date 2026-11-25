import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api.js';
import { Ava } from './ui.jsx';
import { Icon } from './icons.jsx';
import { apiError } from './i18n.js';
import * as au from './mafiaAudio.js';

/* English Mafia — multiplayer for students. The server owns the whole game (roles, phases, timers, votes);
   this screen only shows the player's own view and sends their choices. */

const LANG = () => { const l = localStorage.getItem('lang') || 'en'; return ['uz', 'ru'].includes(l) ? l : 'en'; };
const D = {
  title: { en: 'Mafia Game', uz: 'Mafia o‘yini', ru: 'Мафия' },
  create: { en: 'Create Room', uz: 'Xona yaratish', ru: 'Создать комнату' },
  join: { en: 'Join Room', uz: 'Xonaga qo‘shilish', ru: 'Войти в комнату' },
  codePh: { en: 'Enter 5-letter code', uz: '5 belgili kodni kiriting', ru: 'Код из 5 символов' },
  how: { en: 'Talk in English, find the Mafia and win with your team! 6–12 students.', uz: 'Inglizcha gaplashing, Mafiani toping va jamoangiz bilan yuting! 6–12 talaba.', ru: 'Говорите по-английски, найдите Мафию и победите! 6–12 учеников.' },
  roomCode: { en: 'Room Code', uz: 'Xona kodi', ru: 'Код комнаты' },
  share: { en: 'Share this code with your friends and let them join!', uz: 'Kodni do‘stlaringizga yuboring — ular qo‘shilsin!', ru: 'Отправьте код друзьям — пусть присоединятся!' },
  copy: { en: 'Copy', uz: 'Nusxa', ru: 'Копировать' }, copied: { en: 'Copied!', uz: 'Nusxalandi!', ru: 'Скопировано!' },
  players: { en: 'Players', uz: 'O‘yinchilar', ru: 'Игроки' },
  waiting: { en: 'Waiting for more players...', uz: 'Yana o‘yinchilar kutilmoqda...', ru: 'Ждём игроков...' },
  minReq: { en: 'Minimum 6 students required to start', uz: 'Boshlash uchun kamida 6 ta talaba kerak', ru: 'Нужно минимум 6 учеников' },
  great: { en: 'Great! Enough players joined!', uz: 'Ajoyib! O‘yinchilar yetarli!', ru: 'Отлично! Игроков достаточно!' },
  ready: { en: 'Ready to Start', uz: 'Boshlashga tayyor', ru: 'Готово к старту' },
  start: { en: 'Start Game', uz: 'O‘yinni boshlash', ru: 'Начать игру' },
  waitHost: { en: 'Waiting for the room owner to start...', uz: 'Xona egasi boshlashini kutyapmiz...', ru: 'Ждём, пока владелец начнёт...' },
  leave: { en: 'Leave', uz: 'Chiqish', ru: 'Выйти' },
  you: { en: 'You', uz: 'Siz', ru: 'Вы' },
  yourRole: { en: 'Your Role', uz: 'Sizning rolingiz', ru: 'Ваша роль' },
  gotIt: { en: 'Got it!', uz: 'Tushundim!', ru: 'Понятно!' },
  talkEn: { en: 'Talk in English and share your ideas!', uz: 'Inglizcha gaplashing va fikrlaringizni ayting!', ru: 'Говорите по-английски!' },
  mafia: { en: 'Mafia', uz: 'Mafia', ru: 'Мафия' }, doctor: { en: 'Doctor', uz: 'Doktor', ru: 'Доктор' }, detective: { en: 'Detective', uz: 'Detektiv', ru: 'Детектив' }, citizen: { en: 'Citizen', uz: 'Fuqaro', ru: 'Горожанин' },
  r_mafia: { en: 'Each night choose one player together with your team. Stay hidden!', uz: 'Har kecha jamoangiz bilan bir o‘yinchini tanlang. Yashirin qoling!', ru: 'Каждую ночь выбирайте игрока вместе с командой. Не раскрывайтесь!' },
  r_doctor: { en: 'Each night protect one player. You may protect yourself, but not two nights in a row.', uz: 'Har kecha bir o‘yinchini himoya qiling. O‘zingizni ketma-ket ikki kecha himoya qila olmaysiz.', ru: 'Каждую ночь защищайте игрока. Себя — не две ночи подряд.' },
  r_detective: { en: 'Each night investigate one player and learn if they are Mafia.', uz: 'Har kecha bir o‘yinchini tekshiring — u Mafiami yoki yo‘q.', ru: 'Каждую ночь проверяйте игрока: Мафия или нет.' },
  r_citizen: { en: 'Find the Mafia and help the citizens!', uz: 'Mafiani toping va fuqarolarga yordam bering!', ru: 'Найдите Мафию и помогите горожанам!' },
  night: { en: 'Night Phase', uz: 'Tun bosqichi', ru: 'Ночь' },
  closeEyes: { en: 'Everyone close your eyes...', uz: 'Hamma ko‘zini yumsin...', ru: 'Все закрывают глаза...' },
  thinking: { en: 'The game is thinking...', uz: 'O‘yin o‘ylayapti...', ru: 'Игра думает...' },
  mafiaPick: { en: 'Choose a player (secretly)', uz: 'O‘yinchini tanlang (yashirin)', ru: 'Выберите игрока (тайно)' },
  docPick: { en: 'Choose a player to protect', uz: 'Himoya qilinadigan o‘yinchini tanlang', ru: 'Кого защитить?' },
  detPick: { en: 'Choose a player to investigate', uz: 'Tekshiriladigan o‘yinchini tanlang', ru: 'Кого проверить?' },
  locked: { en: 'Choice saved. Waiting for the others...', uz: 'Tanlov saqlandi. Boshqalarni kutamiz...', ru: 'Выбор сохранён. Ждём остальных...' },
  isMafia: { en: 'is MAFIA', uz: 'MAFIA', ru: 'МАФИЯ' }, notMafia: { en: 'is NOT Mafia', uz: 'Mafia EMAS', ru: 'НЕ Мафия' },
  out: { en: 'Out of the Round', uz: 'Raunddan chiqdi', ru: 'Выбыл из раунда' },
  youOut: { en: 'You are Out of the Round. You can watch the game!', uz: 'Siz raunddan chiqdingiz. O‘yinni kuzatishingiz mumkin!', ru: 'Вы выбыли. Можно наблюдать!' },
  morning: { en: 'Good morning!', uz: 'Xayrli tong!', ru: 'Доброе утро!' },
  evOut: { en: 'is Out of the Round.', uz: 'raunddan chiqdi.', ru: 'выбыл из раунда.' },
  evSaved: { en: 'The Doctor saved someone — nobody is out of the round!', uz: 'Doktor kimnidir qutqardi — hech kim raunddan chiqmadi!', ru: 'Доктор спас игрока — никто не выбыл!' },
  evQuiet: { en: 'A quiet night. Nobody is out of the round.', uz: 'Tinch tun. Hech kim raunddan chiqmadi.', ru: 'Тихая ночь. Никто не выбыл.' },
  evTie: { en: 'It is a tie! Nobody leaves the round.', uz: 'Teng ovoz! Hech kim raunddan chiqmaydi.', ru: 'Ничья! Никто не выбывает.' },
  evNoVotes: { en: 'Nobody voted. Nobody leaves the round.', uz: 'Hech kim ovoz bermadi.', ru: 'Никто не голосовал.' },
  discussion: { en: 'Discussion Time!', uz: 'Muhokama vaqti!', ru: 'Обсуждение!' },
  talkFind: { en: 'Talk with other players and find the Mafia.', uz: 'Boshqalar bilan gaplashing va Mafiani toping.', ru: 'Обсуждайте и ищите Мафию.' },
  typeMsg: { en: 'Type your message in English...', uz: 'Xabarni inglizcha yozing...', ru: 'Пишите по-английски...' },
  phrases: { en: 'Useful phrases', uz: 'Foydali iboralar', ru: 'Полезные фразы' },
  voting: { en: 'Voting', uz: 'Ovoz berish', ru: 'Голосование' },
  voteWho: { en: 'Vote for who you think is Mafia:', uz: 'Kim Mafia deb o‘ylaysiz? Ovoz bering:', ru: 'Кто, по-вашему, Мафия?' },
  submitVote: { en: 'Submit Vote', uz: 'Ovoz berish', ru: 'Проголосовать' },
  voteSaved: { en: 'Your vote is secret and saved.', uz: 'Ovozingiz yashirin saqlandi.', ru: 'Ваш голос сохранён тайно.' },
  votedN: { en: 'voted', uz: 'ovoz berdi', ru: 'проголосовали' },
  results: { en: 'Voting results', uz: 'Ovoz natijalari', ru: 'Итоги голосования' },
  votes: { en: 'votes', uz: 'ovoz', ru: 'голосов' },
  citizensWin: { en: 'Citizens Win!', uz: 'Fuqarolar yutdi!', ru: 'Победа горожан!' }, mafiaWins: { en: 'Mafia Wins!', uz: 'Mafia yutdi!', ru: 'Победа мафии!' },
  foundMafia: { en: 'You found the Mafia!', uz: 'Mafia topildi!', ru: 'Мафия найдена!' }, mafiaWon: { en: 'The Mafia stayed hidden!', uz: 'Mafia yashirina oldi!', ru: 'Мафия осталась скрытой!' },
  rounds: { en: 'Rounds', uz: 'Raundlar', ru: 'Раунды' }, correct: { en: 'Your correct votes', uz: 'To‘g‘ri ovozlaringiz', ru: 'Верные голоса' }, yourTeam: { en: 'Your team', uz: 'Jamoangiz', ru: 'Ваша команда' },
  playAgain: { en: 'Play Again', uz: 'Qayta o‘ynash', ru: 'Играть снова' }, toLobby: { en: 'Return to Lobby', uz: 'Lobbiga qaytish', ru: 'В лобби' },
  music: { en: 'Music', uz: 'Musiqa', ru: 'Музыка' }, effects: { en: 'Sound effects', uz: 'Ovoz effektlari', ru: 'Звуковые эффекты' }, volume: { en: 'Volume', uz: 'Ovoz balandligi', ru: 'Громкость' },
  on: { en: 'On', uz: 'Yoqilgan', ru: 'Вкл' }, off: { en: 'Off', uz: 'O‘chiq', ru: 'Выкл' },
  round: { en: 'Round', uz: 'Raund', ru: 'Раунд' }, rejoin: { en: 'Back to your room', uz: 'Xonangizga qaytish', ru: 'Вернуться в комнату' },
  offline: { en: 'offline', uz: 'ulanmagan', ru: 'не в сети' },
};
const tr = (k) => (D[k] ? D[k][LANG()] || D[k].en : k);
const PHRASES = ['I think he is the Mafia.', 'I suspect her.', 'I am innocent.', 'Why do you suspect me?', "Let's vote.", 'I have evidence.', 'Trust me!'];
const ROLE_ICON = { mafia: '🎭', doctor: '🩺', detective: '🔍', citizen: '🏙️' };

const MaskLogo = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="mfg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a78bfa" /><stop offset="1" stopColor="#4f7cff" /></linearGradient></defs>
    <path d="M8 14c8-4 18-5 24-2 6-3 16-2 24 2 2 16-3 34-24 40C11 48 6 30 8 14z" fill="url(#mfg)" /><path d="M16 26c3-2 8-2 11 1-3 3-8 3-11-1zM48 26c-3-2-8-2-11 1 3 3 8 3 11-1z" fill="#0d1050" /><path d="M24 40c5 4 11 4 16 0" stroke="#0d1050" strokeWidth="3" fill="none" strokeLinecap="round" /></svg>
);
const Player = ({ p, size = 56, tag, sel, onClick, dim, badge }) => (
  <button type="button" className={'mf-pl' + (sel ? ' sel' : '') + (dim ? ' dim' : '') + (onClick ? ' pick' : '')} onClick={onClick} disabled={!onClick}>
    <span className="mf-ava" style={{ width: size, height: size }}><Ava u={{ full_name: p.name, avatar_url: p.avatar }} size={size} />{badge && <i className="mf-badge">{badge}</i>}</span>
    <b>{p.name}</b>{tag && <small>{tag}</small>}
  </button>
);

function AudioMenu() {
  const [s, setS] = useState(au.settings()); const [open, setOpen] = useState(false);
  useEffect(() => au.subscribe(setS), []);
  return (
    <div className="mf-audio">
      <button type="button" className={'mf-musicbtn' + (s.music ? ' on' : '')} onClick={() => { au.unlock(); au.sfx('click'); setOpen((o) => !o); }} aria-expanded={open}>♫ {tr('music')}: {s.music ? tr('on') : tr('off')}<span className="mf-sw"><i /></span></button>
      {open && (
        <div className="mf-pop">
          <label><span>{tr('music')}</span><button type="button" className={'mf-tog' + (s.music ? ' on' : '')} onClick={() => au.setMusic(!s.music)}><i /></button></label>
          <label><span>{tr('effects')}</span><button type="button" className={'mf-tog' + (s.sfx ? ' on' : '')} onClick={() => { au.setSfx(!s.sfx); if (!s.sfx) setTimeout(() => au.sfx('click'), 50); }}><i /></button></label>
          <label className="col"><span>{tr('volume')} {Math.round(s.vol * 100)}%</span><input type="range" min="0" max="100" value={Math.round(s.vol * 100)} onChange={(e) => au.setVolume(e.target.value / 100)} /></label>
        </div>
      )}
    </div>
  );
}

const Stars = () => <div className="mf-stars" aria-hidden="true">{Array.from({ length: 36 }, (_, i) => <i key={i} style={{ left: (i * 37 % 100) + '%', top: (i * 53 % 70) + '%', animationDelay: (i % 7) * 0.4 + 's', width: 2 + (i % 3), height: 2 + (i % 3) }} />)}</div>;
const Confetti = () => <div className="mf-conf" aria-hidden="true">{Array.from({ length: 46 }, (_, i) => <i key={i} style={{ left: (i * 17 % 100) + '%', animationDelay: -(i % 9) * 0.7 + 's', animationDuration: 4 + (i % 5) + 's', background: ['#ffd24a', '#4f9bff', '#ff5d7a', '#a78bfa', '#3ddc97', '#e5e7eb'][i % 6], width: 6 + (i % 3) * 3, height: 10 + (i % 4) * 3 }} />)}</div>;

function useClock(view) {
  const off = useRef(0); const [, force] = useState(0);
  useEffect(() => { if (view) off.current = view.now - Date.now(); }, [view && view.now]);
  useEffect(() => { const id = setInterval(() => force((x) => x + 1), 250); return () => clearInterval(id); }, []);
  return view && view.phaseEnds ? Math.max(0, Math.ceil((view.phaseEnds - (Date.now() + off.current)) / 1000)) : 0;
}
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const Timer = ({ s }) => <div className={'mf-timer' + (s <= 5 ? ' hot' : '')}><Icon name="clock" size={18} /> {mmss(s)}</div>;

/* ------------------------------------------------------------------ screens */
function Entry({ onCreate, onJoin, busy, err, existing, onRejoin }) {
  const [code, setCode] = useState('');
  return (
    <div className="mf-entry">
      <div className="mf-hero"><MaskLogo size={86} /><h2>{tr('title')}</h2><p>{tr('how')}</p></div>
      {existing && <button type="button" className="mf-btn alt" onClick={onRejoin}>{tr('rejoin')} · {existing}</button>}
      <button type="button" className="mf-btn big" disabled={busy} onClick={onCreate}><Icon name="plus" size={20} /> {tr('create')}</button>
      <div className="mf-join"><input value={code} maxLength={5} placeholder={tr('codePh')} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} onKeyDown={(e) => e.key === 'Enter' && code.length === 5 && onJoin(code)} />
        <button type="button" className="mf-btn" disabled={busy || code.length !== 5} onClick={() => onJoin(code)}>{tr('join')}</button></div>
      {err && <div className="err">{err}</div>}
    </div>
  );
}

function Waiting({ v, onStart, onLeave, busy, err }) {
  const [copied, setCopied] = useState(false);
  const online = v.players.filter((p) => p.connected).length, ready = online >= v.min;
  const host = v.players.find((p) => p.id === v.hostId);
  const copy = async () => { au.sfx('click'); try { await navigator.clipboard.writeText(v.code); } catch {} setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const shareIt = async () => { au.sfx('click'); const text = `${tr('title')} — ${tr('roomCode')}: ${v.code}`; if (navigator.share) { try { await navigator.share({ title: tr('title'), text }); return; } catch {} } copy(); };
  return (
    <div className={'mf-wait' + (ready ? ' ready' : '')}>
      {ready && <Confetti />}
      {ready ? <div className="mf-great"><h2>{tr('great')} 🎉</h2></div> : <div className="mf-code"><small>{tr('roomCode')}</small></div>}
      <div className="mf-codebox"><b>{v.code}</b><button type="button" onClick={copy} aria-label={tr('copy')}><Icon name="copy" size={20} /></button><button type="button" onClick={shareIt} aria-label="share"><Icon name="send" size={20} /></button></div>
      <p className="muted small">{copied ? tr('copied') : tr('share')}</p>
      <div className="mf-plbox"><h4><Icon name="users" size={18} /> {tr('players')} ({v.players.length} / {v.max})</h4>
        <div className="mf-grid">{v.players.map((p) => <Player key={p.id} p={p} tag={p.id === v.me.id ? tr('you') : p.connected ? '' : tr('offline')} dim={!p.connected} />)}
          {Array.from({ length: Math.max(0, v.max - v.players.length) }, (_, i) => <span key={'e' + i} className="mf-empty">+</span>)}</div></div>
      {ready ? <div className="mf-status ok"><Icon name="ok" size={22} /> {online}+ · {tr('ready')}</div>
        : <div className="mf-status"><span className="mf-hg">⏳</span><div><b>{tr('waiting')}</b><small>{tr('minReq')} ({online}/{v.min})</small></div></div>}
      {err && <div className="err">{err}</div>}
      <div className="mf-actions">
        {v.hostId === v.me.id ? <button type="button" className="mf-btn big" disabled={!ready || busy} onClick={onStart}><Icon name="play" size={20} /> {tr('start')}</button>
          : <p className="muted">{tr('waitHost')} {host ? `(${host.name})` : ''}</p>}
        <button type="button" className="mf-btn ghost" onClick={onLeave}>{tr('leave')}</button>
      </div>
    </div>
  );
}

function RoleReveal({ v, secs }) {
  const role = v.me.role; const mates = v.players.filter((p) => p.role === 'mafia' && p.id !== v.me.id);
  return (
    <div className={'mf-role ' + role}>
      <h2>{tr('yourRole')}</h2>
      <div className="mf-card"><div className="mf-emblem">{ROLE_ICON[role]}</div><div className="mf-pill">{tr(role)}</div></div>
      <p>{tr('r_' + role)}</p>
      {role === 'mafia' && mates.length > 0 && <div className="mf-mates">{tr('mafia')}: {mates.map((m) => m.name).join(', ')}</div>}
      <div className="mf-tip">💡 {tr('talkEn')}</div>
      <Timer s={secs} />
    </div>
  );
}

function Night({ v, secs, onPick, busy, err }) {
  const role = v.me.role, me = v.me, alive = v.players.filter((p) => p.alive);
  let targets = [], title = '';
  if (me.alive) {
    if (role === 'mafia') { targets = alive.filter((p) => p.role !== 'mafia'); title = tr('mafiaPick'); }
    else if (role === 'doctor') { targets = alive.filter((p) => p.id !== me.id || v.canSelfSave); title = tr('docPick'); }
    else if (role === 'detective') { targets = alive.filter((p) => p.id !== me.id); title = tr('detPick'); }
  }
  const acting = me.alive && targets.length > 0 && ['mafia', 'doctor', 'detective'].includes(role);
  const [sel, setSel] = useState(null);
  const chosen = v.myNight;
  return (
    <div className="mf-night">
      <Stars /><div className="mf-moon" />
      <h2>🌙 {tr('night')}</h2>
      <Timer s={secs} />
      {!me.alive ? <p className="mf-msg">{tr('youOut')}</p>
        : !acting || chosen ? (
          <div className="mf-sleep"><p><b>{tr('closeEyes')}</b></p><p className="muted">{tr('thinking')}</p><div className="mf-mask">😴<span>z z Z</span></div>
            {chosen && <p className="mf-locked">✓ {tr('locked')}</p>}
            {role === 'detective' && v.detective && v.detective.length > 0 && <div className="mf-det">{v.detective.map((d) => <div key={d.round} className={d.mafia ? 'bad' : 'good'}>🔍 {d.name} {d.mafia ? tr('isMafia') : tr('notMafia')}</div>)}</div>}
          </div>
        ) : (
          <div className="mf-pick">
            <p className="mf-msg">{ROLE_ICON[role]} {title}</p>
            <div className="mf-grid">{targets.map((p) => <Player key={p.id} p={p} sel={sel === p.id} onClick={() => { au.sfx('click'); setSel(p.id); }} tag={role === 'mafia' && Object.values(v.mafiaPicks || {}).includes(p.id) ? '👁' : p.id === me.id ? tr('you') : ''} />)}</div>
            {err && <div className="err">{err}</div>}
            <button type="button" className="mf-btn big" disabled={!sel || busy} onClick={() => onPick(sel)}>OK</button>
            {role === 'detective' && v.detective && v.detective.length > 0 && <div className="mf-det">{v.detective.map((d) => <div key={d.round} className={d.mafia ? 'bad' : 'good'}>🔍 {d.name} {d.mafia ? tr('isMafia') : tr('notMafia')}</div>)}</div>}
          </div>
        )}
    </div>
  );
}

const eventText = (e) => e.kind === 'out' ? `${e.name} ${tr('evOut')}` : e.kind === 'saved' ? tr('evSaved') : e.kind === 'quiet' ? tr('evQuiet') : e.kind === 'tie' ? tr('evTie') : e.kind === 'novotes' ? tr('evNoVotes') : '';

function DayResult({ v, secs }) {
  const evs = v.events.filter((e) => e.round === v.round && ['out', 'saved', 'quiet'].includes(e.kind) && (e.kind !== 'out' || e.extra?.by === 'night'));
  return (
    <div className="mf-day"><div className="mf-sun">☀️</div><h2>{tr('morning')}</h2>
      {evs.map((e) => <p key={e.id} className={'mf-ev' + (e.kind === 'out' ? ' out' : '')}>{eventText(e)}</p>)}
      <Timer s={secs} /></div>
  );
}

function Chat({ v, chat, onSend, canWrite, err }) {
  const [text, setText] = useState(''); const box = useRef(null);
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [chat.length]);
  const send = (e) => { e && e.preventDefault(); if (!text.trim()) return; au.sfx('click'); onSend(text.trim()); setText(''); };
  const byId = Object.fromEntries(v.players.map((p) => [p.id, p]));
  return (
    <div className="mf-chat">
      <div className="mf-msgs" ref={box}>{chat.map((m) => { const p = byId[m.pid]; return (
        <div key={m.id} className={'mf-m' + (m.pid === v.me.id ? ' mine' : '')}>{p && <Ava u={{ full_name: p.name, avatar_url: p.avatar }} size={34} />}<div><small>{m.name}</small><span>{m.text}</span></div></div>); })}
        {chat.length === 0 && <p className="muted small" style={{ textAlign: 'center' }}>{tr('talkFind')}</p>}</div>
      <div className="mf-phr"><small>{tr('phrases')}</small><div>{PHRASES.map((p) => <button key={p} type="button" disabled={!canWrite} onClick={() => setText((x) => (x ? x + ' ' : '') + p)}>{p}</button>)}</div></div>
      {err && <div className="err">{err}</div>}
      <form className="mf-send" onSubmit={send}><input value={text} maxLength={200} disabled={!canWrite} placeholder={tr('typeMsg')} onChange={(e) => setText(e.target.value)} /><button type="submit" className="mf-btn" disabled={!canWrite || !text.trim()} aria-label="send"><Icon name="send" size={18} /></button></form>
    </div>
  );
}

function Discussion({ v, secs, chat, onSend, err }) {
  const evs = v.events.filter((e) => e.round === v.round && e.kind === 'out' && e.extra?.by === 'night');
  return (
    <div className="mf-disc">
      <div className="mf-dhead"><h2>💬 {tr('discussion')}</h2><Timer s={secs} /></div>
      <p className="muted small">{tr('talkFind')}</p>
      {!v.me.alive && <p className="mf-msg">{tr('youOut')}</p>}
      <div className="mf-dcols">
        <Chat v={v} chat={chat} onSend={onSend} canWrite={v.me.alive} err={err} />
        <aside className="mf-side"><h4>{tr('players')}</h4>{v.players.map((p) => <div key={p.id} className={'mf-row' + (p.alive ? '' : ' out')}><Ava u={{ full_name: p.name, avatar_url: p.avatar }} size={28} /><span>{p.name}{p.id === v.me.id ? ` (${tr('you')})` : ''}</span>{!p.alive && <small>{tr('out')}</small>}</div>)}</aside>
      </div>
    </div>
  );
}

function Voting({ v, secs, chat, onVote, onSend, busy, err }) {
  const [sel, setSel] = useState(null);
  const cand = v.players.filter((p) => p.alive && p.id !== v.me.id), canVote = v.me.alive && !v.myVote;
  const alive = v.players.filter((p) => p.alive).length;
  return (
    <div className="mf-vote">
      <div className="mf-dhead"><h2>🗳️ {tr('voting')}</h2><Timer s={secs} /></div>
      <p className="mf-msg">{v.me.alive ? tr('voteWho') : tr('youOut')}</p>
      <div className="mf-grid">{cand.map((p) => <Player key={p.id} p={p} sel={(v.myVote || sel) === p.id} dim={!!v.myVote && v.myVote !== p.id} onClick={canVote ? () => { au.sfx('click'); setSel(p.id); } : null} />)}</div>
      {err && <div className="err">{err}</div>}
      {canVote ? <button type="button" className="mf-btn big" disabled={!sel || busy} onClick={() => onVote(sel)}>{tr('submitVote')}</button> : v.me.alive && <p className="mf-locked">✓ {tr('voteSaved')}</p>}
      <p className="muted small">{v.voted} / {alive} {tr('votedN')}</p>
      <Chat v={v} chat={chat} onSend={onSend} canWrite={v.me.alive} />
    </div>
  );
}

function VoteResult({ v, secs }) {
  const evs = v.events.filter((e) => e.round === v.round && ['out', 'tie', 'novotes'].includes(e.kind) && (e.kind !== 'out' || e.extra?.by === 'vote'));
  const max = Math.max(1, ...(v.tally || []).map((x) => x.votes));
  return (
    <div className="mf-day"><h2>📊 {tr('results')}</h2>
      <div className="mf-bars">{(v.tally || []).map((x) => <div key={x.pid}><span>{x.name}</span><em style={{ width: (x.votes / max) * 100 + '%' }}>{x.votes} {tr('votes')}</em></div>)}</div>
      {evs.map((e) => <p key={e.id} className={'mf-ev' + (e.kind === 'out' ? ' out' : '')}>{eventText(e)}</p>)}
      <Timer s={secs} /></div>
  );
}

function Winner({ v, onAgain, onLobby, busy }) {
  const cit = v.winner === 'citizens', myTeam = v.me.role === 'mafia' ? 'mafia' : 'citizens', won = myTeam === v.winner;
  return (
    <div className={'mf-win ' + v.winner}>
      <Confetti />
      <div className="mf-trophy">🏆</div>
      <div className="mf-ribbon">{cit ? tr('citizensWin') : tr('mafiaWins')}</div>
      <p className="mf-msg">{cit ? tr('foundMafia') : tr('mafiaWon')} {won ? '🎉' : ''}</p>
      <div className="mf-grid">{v.players.map((p) => <Player key={p.id} p={p} size={52} tag={`${ROLE_ICON[p.role] || ''} ${tr(p.role || 'citizen')}`} badge={p.role === 'mafia' ? '🎭' : ''} dim={!p.alive} />)}</div>
      <div className="mf-stats"><div><b>{v.stats.rounds}</b><small>{tr('rounds')}</small></div><div><b>{v.stats.correct[v.me.id] || 0}</b><small>{tr('correct')}</small></div><div><b>{ROLE_ICON[v.me.role]} {tr(v.me.role || 'citizen')}</b><small>{tr('yourTeam')}</small></div></div>
      <div className="mf-actions"><button type="button" className="mf-btn big" disabled={busy} onClick={onAgain}>↻ {tr('playAgain')}</button><button type="button" className="mf-btn ghost" onClick={onLobby}>{tr('toLobby')}</button></div>
    </div>
  );
}

/* ------------------------------------------------------------------ main */
export default function Mafia({ onBack }) {
  const [code, setCode] = useState(null); const [existing, setExisting] = useState(null); const [booted, setBooted] = useState(false);
  const [v, setV] = useState(null); const [chat, setChat] = useState([]); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const after = useRef(0); const prevPhase = useRef(null); const lastTick = useRef(-1);
  const secs = useClock(v);

  useEffect(() => { const un = () => au.unlock(); document.addEventListener('pointerdown', un); return () => { document.removeEventListener('pointerdown', un); au.stopAll(); }; }, []);
  useEffect(() => { api('/api/mafia/me').then((r) => setExisting(r.code)).catch((x) => setErr(apiError(x))).finally(() => setBooted(true)); }, []);

  const poll = useCallback(async () => {
    if (!code) return;
    try {
      const r = await api(`/api/mafia/rooms/${code}?after=${after.current}`);
      if (r.chat && r.chat.length) { after.current = Math.max(after.current, ...r.chat.map((m) => m.id)); setChat((c) => { const ids = new Set(c.map((m) => m.id)); return [...c, ...r.chat.filter((m) => !ids.has(m.id))].slice(-200); }); }
      setV(r); setErr('');
    } catch (x) { if (['NO_ROOM', 'NOT_MEMBER'].includes(x.code)) { setCode(null); setV(null); setExisting(null); } else setErr(apiError(x)); }
  }, [code]);
  useEffect(() => {
    if (!code) return; poll();
    const id = setInterval(poll, document.hidden ? 4000 : (v && v.status === 'playing' ? 1200 : 2000));
    return () => clearInterval(id);
  }, [code, poll, v && v.status]);

  // music + sound effects follow the phase
  const phase = v ? (v.status === 'lobby' ? 'lobby' : v.phase) : null;
  useEffect(() => {
    if (!phase) { au.playMusic(code ? null : 'lobby'); return; }
    const m = { lobby: 'lobby', reveal: 'night', night: 'night', result: 'day', discussion: 'day', vote: 'vote', voteresult: 'day', ended: 'win' }[phase];
    au.playMusic(m);
    const p = prevPhase.current;
    if (p && p !== phase) { if (phase === 'night') au.sfx('night'); else if (phase === 'vote') au.sfx('vote'); else if (phase === 'result') au.sfx('day'); else if (phase === 'ended') au.sfx(v.winner === (v.me.role === 'mafia' ? 'mafia' : 'citizens') ? 'win' : 'lose'); }
    prevPhase.current = phase;
  }, [phase, code]);
  useEffect(() => { if (v && ['night', 'vote'].includes(v.phase) && secs > 0 && secs <= 5 && lastTick.current !== secs) { lastTick.current = secs; au.sfx('tick'); } }, [secs]);
  useEffect(() => { if (!code) au.playMusic('lobby'); }, [code]);

  const act = async (fn) => { setBusy(true); setErr(''); try { await fn(); } catch (x) { setErr(apiError(x)); au.sfx('error'); } setBusy(false); };
  const create = () => act(async () => { au.sfx('click'); const r = await api('/api/mafia/rooms', { method: 'POST' }); after.current = 0; setChat([]); setCode(r.code); });
  const join = (c) => act(async () => { au.sfx('click'); const r = await api(`/api/mafia/rooms/${c}/join`, { method: 'POST' }); after.current = 0; setChat([]); setCode(r.code); });
  const start = () => act(async () => { au.sfx('click'); await api(`/api/mafia/rooms/${code}/start`, { method: 'POST' }); await poll(); });
  const leave = async (goBack) => { au.sfx('click'); try { if (code) await api(`/api/mafia/rooms/${code}/leave`, { method: 'POST' }); } catch {} setCode(null); setV(null); setExisting(null); setChat([]); after.current = 0; prevPhase.current = null; if (goBack) onBack && onBack(); };
  const night = (t) => act(async () => { au.sfx('click'); setV(await api(`/api/mafia/rooms/${code}/night?after=${after.current}`, { method: 'POST', body: { target: t } })); });
  const vote = (t) => act(async () => { au.sfx('click'); setV(await api(`/api/mafia/rooms/${code}/vote?after=${after.current}`, { method: 'POST', body: { target: t } })); });
  const send = async (text) => { try { await api(`/api/mafia/rooms/${code}/chat`, { method: 'POST', body: { text } }); poll(); } catch (x) { if (x.code !== 'RATE') setErr(apiError(x)); } };
  const again = () => act(async () => { au.sfx('click'); await api(`/api/mafia/rooms/${code}/reset`, { method: 'POST' }); setChat([]); after.current = 0; prevPhase.current = null; await poll(); });

  let body;
  if (!booted) body = <p className="muted">…</p>;
  else if (!code) body = <Entry onCreate={create} onJoin={join} busy={busy} err={err} existing={existing} onRejoin={() => { after.current = 0; setChat([]); setCode(existing); }} />;
  else if (!v) body = <p className="muted">…</p>;
  else if (v.status === 'lobby') body = <Waiting v={v} onStart={start} onLeave={() => leave(false)} busy={busy} err={err} />;
  else if (v.phase === 'reveal') body = <RoleReveal v={v} secs={secs} />;
  else if (v.phase === 'night') body = <Night key={v.round} v={v} secs={secs} onPick={night} busy={busy} err={err} />;
  else if (v.phase === 'result') body = <DayResult v={v} secs={secs} />;
  else if (v.phase === 'discussion') body = <Discussion v={v} secs={secs} chat={chat} onSend={send} err={err} />;
  else if (v.phase === 'vote') body = <Voting key={v.round} v={v} secs={secs} chat={chat} onVote={vote} onSend={send} busy={busy} err={err} />;
  else if (v.phase === 'voteresult') body = <VoteResult v={v} secs={secs} />;
  else if (v.phase === 'ended') body = <Winner v={v} onAgain={again} onLobby={() => leave(false)} busy={busy} />;

  const inGame = v && v.status === 'playing';
  return (
    <div className={'mf mf-p-' + (phase || 'lobby')}>
      <div className="mf-top">
        <button type="button" className="mf-back" onClick={() => { au.sfx('click'); if (inGame && !confirm(tr('leave') + '?')) return; if (code) leave(true); else onBack && onBack(); }} aria-label="back"><Icon name="prev" size={20} /></button>
        <span className="mf-brand"><MaskLogo size={28} /> {tr('title')}{v && v.status === 'playing' ? ` · #${v.round}` : ''}</span>
        <AudioMenu />
      </div>
      <div className="mf-body">{body}</div>
    </div>
  );
}
