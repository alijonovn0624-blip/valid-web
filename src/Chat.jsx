import { useEffect, useRef, useState } from 'react';
import { api, API } from './api';
import { Icon } from './icons.jsx';
import { t, apiError } from './i18n.js';
import { GroupsHome } from './Groups.jsx';

const Ava = ({ u }) =>
  u.avatar_url ? <img className="mini" src={API + u.avatar_url} alt="" />
               : <div className="mini ph">{(u.full_name || '?')[0]}</div>;

/* ---- Shaxsiy xabarlar ---- */
function List({ me, onPick }) {
  const [convs, setConvs] = useState([]);
  const [q, setQ] = useState('');
  const [found, setFound] = useState([]);
  const staff = me.role !== 'student';
  useEffect(() => {
    const load = () => api('/api/chat/conversations').then(setConvs).catch(() => {});
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!staff || !q.trim()) { setFound([]); return; }
    const id = setTimeout(() => api('/api/chat/users?q=' + encodeURIComponent(q)).then(setFound).catch(() => {}), 250);
    return () => clearTimeout(id);
  }, [q]);
  const rows = q.trim() && staff ? found : convs;
  return (
    <div className="chatbody">
      {staff && <input placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />}
      {rows.length === 0 && <p className="muted">{t('noChats')}</p>}
      {rows.map((u) => (
        <div key={u.id} className="card lb" onClick={() => onPick(u)}>
          <Ava u={u} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <b>{u.full_name}</b>
            {u.body && <small style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.body}</small>}
          </div>
          {u.unread > 0 && <span className="badge">{u.unread}</span>}
        </div>
      ))}
    </div>
  );
}

export function Thread({ me, peer }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const end = useRef(null);
  const load = () => api('/api/chat/thread/' + peer.id).then(setMsgs).catch(() => {});
  useEffect(() => {
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [peer.id]);
  useEffect(() => { if (end.current) end.current.scrollIntoView(); }, [msgs.length]);
  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText(''); setErr('');
    try { await api('/api/chat/send', { method: 'POST', body: { to: peer.id, body } }); } catch (x) { setErr(apiError(x)); }
    load();
  };
  return (
    <>
      <div className="chatbody msgs">
        {msgs.length === 0 && <p className="muted">{t('noMessages')}</p>}
        {msgs.map((m) => <div key={m.id} className={'msg ' + (m.sender_id === me.id ? 'me' : '')}>{m.body}</div>)}
        <div ref={end} />
      </div>
      {err && <div className="err" style={{ padding: '0 16px' }}>{err}</div>}
      <form className="chatform" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('typeMessage')} maxLength={2000} />
        <button className="btn">{t('send')}</button>
      </form>
    </>
  );
}

// Community (guruh) + Shaxsiy xabarlar
export function CommunityPanel({ me }) {
  const [tab, setTab] = useState('room');
  const [peer, setPeer] = useState(null);
  return (
    <>
      <div className="seg" style={{ padding: '8px 16px 0' }}>
        <button className={tab === 'room' ? 'on' : ''} onClick={() => { setTab('room'); setPeer(null); }}><Icon name="users" size={16} /> {t('groups')}</button>
        <button className={tab === 'dm' ? 'on' : ''} onClick={() => setTab('dm')}><Icon name="mail" size={16} /> {t('directTab')}</button>
      </div>
      {tab === 'room' && <GroupsHome me={me} />}
      {tab === 'dm' && !peer && <List me={me} onPick={setPeer} />}
      {tab === 'dm' && peer && (
        <>
          <div style={{ padding: '8px 16px 0' }}><button className="btn ghost" onClick={() => setPeer(null)}><Icon name="back" size={16} /> {peer.full_name}</button></div>
          <Thread me={me} peer={peer} />
        </>
      )}
    </>
  );
}

export default function Chat({ me, onClose }) {
  return (
    <div className="chat">
      <div className="chathead">
        <span style={{ width: 28 }} />
        <b>{t('chat')}</b>
        <button onClick={onClose} aria-label="close"><Icon name="close" size={18} /></button>
      </div>
      <CommunityPanel me={me} />
    </div>
  );
}
