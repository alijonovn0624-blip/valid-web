import { Icon } from './icons.jsx';
import { useState } from 'react';
import { api } from './api';
import { t, LANGS, apiError } from './i18n.js';

export function Modal({ title, onClose, back, children }) {
  return (
    <div className="modalback" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modalhead">
          {back ? <button onClick={back} aria-label="back"><Icon name="back" size={18} /></button> : <span style={{ width: 28 }} />}
          <b>{title}</b>
          <button onClick={onClose} aria-label="close"><Icon name="close" size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Log out: Cancel / Log out / Delete account (faqat student va teacher)
export function LogoutDialog({ user, onClose }) {
  const [step, setStep] = useState('choose');
  const [pw, setPw] = useState('');
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const canDelete = user.role === 'student' || user.role === 'teacher';
  const signOut = () => { localStorage.removeItem('token'); location.reload(); };
  const del = async () => {
    setBusy(true); setErr('');
    try {
      await api('/api/auth/delete-account', { method: 'POST', body: { password: pw, confirm: 'DELETE' } });
      localStorage.removeItem('token');
      location.reload();
    } catch (x) { setErr(apiError(x)); setBusy(false); }
  };
  if (step === 'delete')
    return (
      <Modal title={t('deleteTitle')} onClose={onClose} back={() => setStep('choose')}>
        <div className="warnbox">{t('deleteWarn')}</div>
        <input type="password" placeholder={t('deletePwd')} value={pw} onChange={(e) => setPw(e.target.value)} />
        <label className="chk"><input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} /> {t('deleteUnderstand')}</label>
        {err && <div className="err">{err}</div>}
        <button className="btn dangerbtn" disabled={!sure || !pw || busy} onClick={del}>{busy ? t('deleting') : t('deleteBtn')}</button>
        <button className="btn ghost" onClick={() => setStep('choose')}>{t('cancel')}</button>
      </Modal>
    );
  return (
    <Modal title={t('logout')} onClose={onClose}>
      <p className="muted">{t('logoutQ')}</p>
      <button className="opt" onClick={onClose}><span className="oi"><Icon name="undo" size={20} /></span><span><b>{t('cancel')}</b><small>{t('cancelSub')}</small></span></button>
      <button className="opt" onClick={signOut}><span className="oi"><Icon name="logout" size={20} /></span><span><b>{t('logout')}</b><small>{t('logoutSub')}</small></span></button>
      {canDelete && (
        <button className="opt danger" onClick={() => setStep('delete')}><span className="oi"><Icon name="trash" size={20} /></span><span><b>{t('deleteTitle')}</b><small>{t('deleteSub')}</small></span></button>
      )}
      <button className="btn" style={{ width: '100%' }} onClick={onClose}>{t('cancel')}</button>
    </Modal>
  );
}

export function LangPanel({ lang, onPick, onClose }) {
  return (
    <Modal title={t('languages')} onClose={onClose}>
      {LANGS.map(([k, name]) => (
        <button key={k} className={'opt langitem ' + (lang === k ? 'sel' : '')} onClick={() => onPick(k)}>
          <span className="code2">{k.toUpperCase()}</span><b style={{ flex: 1 }}>{name}</b>{lang === k && <span><Icon name="check" size={18} /></span>}
        </button>
      ))}
    </Modal>
  );
}

export function HelpPanel({ onClose }) {
  return (
    <Modal title={t('help')} onClose={onClose}>
      <p>{t('helpText')}</p>
      <button className="btn" style={{ width: '100%' }} onClick={onClose}>{t('back')}</button>
    </Modal>
  );
}
