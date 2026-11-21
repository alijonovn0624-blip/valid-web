import { Icon, Status } from './icons.jsx';
import { useState } from 'react';
import { api, API } from './api';
import { t, LANGS, apiError } from './i18n.js';
import { LogoutDialog } from './Dialogs.jsx';
import { Modal } from './Pages.jsx';

const AVATARS = Array.from({ length: 12 }, (_, k) => 'a' + String(k + 1).padStart(2, '0'));

const ageOf = (b) => {
  if (!b) return '';
  const [y, m, d] = b.split('-').map(Number);
  const n = new Date();
  let a = n.getFullYear() - y;
  if (n.getMonth() + 1 < m || (n.getMonth() + 1 === m && n.getDate() < d)) a--;
  return a >= 0 ? a : '';
};

// showPrefs=false — faqat "Personal information" sahifasi (dashboard)
export default function Settings({ user, reload, theme, setTheme, lang, changeLang, showPrefs = true }) {
  const parts = (user.full_name || '').split(' ');
  const [f, setF] = useState({
    firstName: user.first_name ?? parts[0] ?? '',
    lastName: user.last_name ?? parts.slice(1).join(' '),
    birthday: user.birthday ?? '',
  });
  const [em, setEm] = useState({ newEmail: '', password: '' });
  const [emStep, setEmStep] = useState(0);
  const [emCode, setEmCode] = useState('');
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [dlg, setDlg] = useState(false);

  const ok = (m) => setMsg('✅ ' + (m || t('saved')));
  const bad = (x) => setMsg('❌ ' + apiError(x));
  const patch = (body) => api('/api/auth/profile', { method: 'PATCH', body });

  const savePersonal = async (e) => {
    e.preventDefault(); setMsg('');
    try { await patch({ firstName: f.firstName, lastName: f.lastName, ...(f.birthday ? { birthday: f.birthday } : {}) }); ok(); await reload(); }
    catch (x) { bad(x); }
  };
  const pickTheme = (v) => { setTheme(v); patch({ theme: v }).catch(() => {}); };
  const pickLang = (v) => { changeLang(v); patch({ language: v }).catch(() => {}); };
  const [avDlg, setAvDlg] = useState(false);
  const pickAvatar = async (id) => {
    setBusy(true); setMsg('');
    try { await api('/api/auth/avatar-preset', { method: 'POST', body: { id } }); setAvDlg(false); ok(); await reload(); } catch (x) { bad(x); }
    setBusy(false);
  };
  const changePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBusy(true); setMsg('');
    const fd = new FormData();
    fd.append('avatar', file);
    try { await api('/api/auth/avatar', { method: 'POST', body: fd }); ok(); await reload(); } catch (x) { bad(x); }
    setBusy(false);
  };
  const sendEmailCode = async (e) => {
    e.preventDefault(); setMsg('');
    try {
      const r = await api('/api/auth/change-email', { method: 'POST', body: em });
      ok(r.emailSent ? t('codeSentTo') + ' ' + em.newEmail : t('devNote'));
      setEmStep(1);
    } catch (x) { bad(x); }
  };
  const confirmEmail = async (e) => {
    e.preventDefault(); setMsg('');
    try {
      await api('/api/auth/confirm-email-change', { method: 'POST', body: { code: emCode } });
      ok(); setEmStep(0); setEm({ newEmail: '', password: '' }); setEmCode('');
      await reload();
    } catch (x) { bad(x); }
  };
  const changePw = async (e) => {
    e.preventDefault(); setMsg('');
    try { await api('/api/auth/change-password', { method: 'POST', body: pw }); ok(); setPw({ currentPassword: '', newPassword: '' }); }
    catch (x) { bad(x); }
  };

  return (
    <>
      {showPrefs && <h2>{t('profile')}</h2>}
      {msg && <div className="note"><Status msg={msg} /></div>}

      <div className="card">
        {user.avatar_url
          ? <img className="avatar" src={API + user.avatar_url} alt="" />
          : <div className="avatar" style={{ display: 'grid', placeItems: 'center' }}><Icon name="user" size={40} strokeWidth={1.5} /></div>}
        <div className="avopts">
          <label className="btn ghost" style={{ textAlign: 'center' }}>
            <Icon name="image" size={16} /> {busy ? t('uploading') : t('fromGallery')}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={changePhoto} hidden />
          </label>
          <button type="button" className="btn ghost" onClick={() => setAvDlg(true)}><Icon name="user" size={16} /> {t('chooseAvatar')}</button>
        </div>
        <b style={{ textAlign: 'center' }}>{user.full_name}</b>
        <small style={{ textAlign: 'center' }}>{user.email} · {t('role')}: {user.role} · {t('level')}: {user.level}</small>
      </div>
      {avDlg && (
        <Modal title={t('chooseAvatar')} onClose={() => setAvDlg(false)}>
          <div className="avgrid">{AVATARS.map((id) => (
            <button type="button" key={id} className={'avpick' + (user.avatar_url === '/avatars/' + id + '.svg' ? ' on' : '')} disabled={busy} onClick={() => pickAvatar(id)} aria-label={id}>
              <img src={API + '/avatars/' + id + '.svg'} alt="" loading="lazy" />
            </button>
          ))}</div>
        </Modal>
      )}

      <form className="card" onSubmit={savePersonal}>
        <h3>{t('personalInfo')}</h3>
        <label className="muted">{t('firstName')}</label>
        <input value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} required />
        <label className="muted">{t('lastName')}</label>
        <input value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} required />
        <label className="muted">{t('birthday')}</label>
        <input type="date" value={f.birthday} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setF({ ...f, birthday: e.target.value })} />
        {f.birthday && <small>{t('age')}: {ageOf(f.birthday)} {t('years')}</small>}
        <label className="muted">{t('email')}</label>
        <input value={user.email || ''} readOnly />
        <button className="btn">{t('save')}</button>
      </form>

      {showPrefs && (
        <div className="card">
          <h3>{t('appearance')}</h3>
          <div className="seg">
            <button className={theme === 'dark' ? 'on' : ''} onClick={() => pickTheme('dark')}><Icon name="moon" size={16} /> {t('dark')}</button>
            <button className={theme === 'light' ? 'on' : ''} onClick={() => pickTheme('light')}><Icon name="sun" size={16} /> {t('light')}</button>
          </div>
          <h3>{t('language')}</h3>
          <div className="seg wrap">
            {LANGS.map(([k, name]) => <button key={k} className={lang === k ? 'on' : ''} onClick={() => pickLang(k)}>{name}</button>)}
          </div>
        </div>
      )}

      {emStep === 0 ? (
        <form className="card" onSubmit={sendEmailCode}>
          <h3>{t('changeEmail')}</h3>
          <input type="email" placeholder={t('newEmail')} value={em.newEmail} onChange={(e) => setEm({ ...em, newEmail: e.target.value })} required />
          <input type="password" placeholder={t('password')} value={em.password} onChange={(e) => setEm({ ...em, password: e.target.value })} required />
          <button className="btn">{t('sendCode')}</button>
        </form>
      ) : (
        <form className="card" onSubmit={confirmEmail}>
          <h3>{t('changeEmail')}</h3>
          <small>{t('codeSentTo')} {em.newEmail}</small>
          <input inputMode="numeric" maxLength={6} placeholder={t('enterCode')} value={emCode} onChange={(e) => setEmCode(e.target.value.replace(/\D/g, ''))} required />
          <button className="btn">{t('confirmCode')}</button>
          <button type="button" className="btn ghost" onClick={() => setEmStep(0)}>{t('cancel')}</button>
        </form>
      )}

      <form className="card" onSubmit={changePw}>
        <h3>{t('changePassword')}</h3>
        <input type="password" placeholder={t('currentPassword')} value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required />
        <input type="password" placeholder={t('newPassword')} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required minLength={6} />
        <button className="btn">{t('save')}</button>
      </form>

      {showPrefs && <button className="btn ghost" style={{ width: '100%' }} onClick={() => setDlg(true)}>{t('logout')}</button>}
      {dlg && <LogoutDialog user={user} onClose={() => setDlg(false)} />}
    </>
  );
}
