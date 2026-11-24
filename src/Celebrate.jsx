import { useEffect, useRef, useState } from 'react';
import { t } from './i18n.js';
import { Icon } from './icons.jsx';

const reduced = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const rnd = (a, b) => a + Math.random() * (b - a);
const COLORS = ['#ffd23f', '#ff5d8f', '#4cc9f0', '#7cf29a', '#b388ff', '#ff9f43', '#ffffff'];

/* Vocabulary Test: golden trophy + confetti from both sides + falling ribbons + fireworks + sparkles (canvas, lightweight) */
export function VocabCelebration({ total, correct, onContinue }) {
  const cv = useRef(null);
  const sp = useRef(Array.from({ length: 26 }, () => ({ x: rnd(2, 98), y: rnd(4, 96), s: rnd(8, 18), d: rnd(0, 3), t: rnd(1.4, 3) })));
  useEffect(() => {
    const c = cv.current; if (!c || reduced()) return undefined;
    const ctx = c.getContext('2d'); let W = 0, H = 0, raf = 0, last = performance.now();
    const fit = () => { const r = c.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2); W = r.width; H = r.height; c.width = W * dpr; c.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    fit(); window.addEventListener('resize', fit);
    const conf = [], rib = [], fw = [];
    const burst = (side) => { // confetti shot from the lower sides toward the middle
      for (let i = 0; i < 46; i++) { const a = (side < 0 ? rnd(-1.25, -0.55) : rnd(-2.6, -1.9)); const v = rnd(7, 15);
        conf.push({ x: side < 0 ? 0 : W, y: H * 0.78, vx: Math.cos(a) * v * (side < 0 ? 1 : 1), vy: Math.sin(a) * v, w: rnd(6, 11), h: rnd(4, 8), r: rnd(0, 6), vr: rnd(-0.3, 0.3), c: COLORS[(Math.random() * COLORS.length) | 0], life: 1 }); }
      for (let i = 0; i < 7; i++) { const a = (side < 0 ? rnd(-1.1, -0.6) : rnd(-2.5, -2.0)); const v = rnd(8, 14);
        rib.push({ x: side < 0 ? 0 : W, y: H * 0.78, vx: Math.cos(a) * v, vy: Math.sin(a) * v, len: rnd(70, 130), ph: rnd(0, 6), c: COLORS[(Math.random() * 6) | 0], life: 1 }); }
    };
    const boom = () => { const x = rnd(W * 0.12, W * 0.88), y = rnd(H * 0.1, H * 0.45), col = COLORS[(Math.random() * 6) | 0];
      for (let i = 0; i < 46; i++) { const a = (i / 46) * Math.PI * 2, v = rnd(1.5, 4.6); fw.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: Math.random() < 0.3 ? '#ffffff' : col, life: 1 }); } };
    burst(-1); burst(1); boom();
    let tf = 0;
    const loop = (now) => {
      const dt = Math.min(48, now - last) / 16.7; last = now; tf += dt * 16.7;
      ctx.clearRect(0, 0, W, H);
      if (tf > 700) { tf = 0; boom(); if (Math.random() < 0.5) burst(Math.random() < 0.5 ? -1 : 1); }
      for (const p of fw) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.035 * dt; p.vx *= 0.985; p.life -= 0.011 * dt; if (p.life > 0) { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.c; ctx.shadowBlur = 8; ctx.shadowColor = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, 7); ctx.fill(); } }
      ctx.shadowBlur = 0;
      for (const p of rib) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.22 * dt; p.vx *= 0.985; p.ph += 0.16 * dt; p.life -= 0.0042 * dt;
        if (p.life > 0) { ctx.globalAlpha = Math.min(1, p.life * 1.6); ctx.strokeStyle = p.c; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p.x, p.y);
          for (let k = 1; k <= 6; k++) ctx.lineTo(p.x - p.vx * k * 2.2 + Math.sin(p.ph + k) * 9, p.y - p.vy * k * 2.2 + k * 3); ctx.stroke(); } }
      for (const p of conf) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.3 * dt; p.vx *= 0.99; p.r += p.vr * dt; p.life -= 0.006 * dt;
        if (p.life > 0 && p.y < H + 20) { ctx.globalAlpha = Math.min(1, p.life * 2); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore(); } }
      ctx.globalAlpha = 1;
      for (let i = fw.length - 1; i >= 0; i--) if (fw[i].life <= 0) fw.splice(i, 1);
      for (let i = rib.length - 1; i >= 0; i--) if (rib[i].life <= 0) rib.splice(i, 1);
      for (let i = conf.length - 1; i >= 0; i--) if (conf[i].life <= 0 || conf[i].y > H + 30) conf.splice(i, 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', fit); };
  }, []);
  const bad = total - correct;
  return (
    <div className="cel" role="dialog" aria-modal="true">
      <canvas ref={cv} className="cel-cv" />
      {sp.current.map((s, i) => <i key={i} className="cel-sp" style={{ left: s.x + '%', top: s.y + '%', width: s.s, height: s.s, animationDelay: s.d + 's', animationDuration: s.t + 's' }} />)}
      <div className="cel-box">
        <div className="cel-trophy">
          <span className="cel-glow" />
          <svg viewBox="0 0 120 130" width="150" height="162" aria-hidden="true">
            <defs><linearGradient id="tg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff3a8" /><stop offset=".45" stopColor="#ffc21a" /><stop offset="1" stopColor="#d98200" /></linearGradient></defs>
            <path d="M28 14h64v34c0 20-14 34-32 34S28 68 28 48z" fill="url(#tg)" />
            <path d="M28 22H10c0 20 8 34 24 38M92 22h18c0 20-8 34-24 38" fill="none" stroke="url(#tg)" strokeWidth="7" strokeLinecap="round" />
            <rect x="53" y="80" width="14" height="22" fill="url(#tg)" /><rect x="36" y="100" width="48" height="10" rx="4" fill="url(#tg)" /><rect x="30" y="110" width="60" height="9" rx="4" fill="#c27400" />
            <path d="M60 28l6 13 14 2-10 10 3 14-13-7-13 7 3-14-10-10 14-2z" fill="#fff7cc" />
          </svg>
        </div>
        <h1 className="cel-title">{t('celTitle')}</h1>
        <p className="cel-sub"><Icon name="ok" size={20} /> {t('celVocabDone')}</p>
        <p className="cel-msg">{t('celMotivation')}</p>
        <div className="cel-stats">
          <div><b>{total}</b><small>{t('totalWords')}</small></div>
          <div className="ok"><b>{correct}</b><small>{t('correctN')}</small></div>
          <div className="bad"><b>{bad}</b><small>{t('incorrectN')}</small></div>
        </div>
        <button type="button" className="cel-btn" autoFocus onClick={onContinue}>{t('continueBtn')}</button>
      </div>
    </div>
  );
}

function useCount(target, ms = 1300, delay = 600) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (reduced()) { setV(target); return undefined; }
    let raf = 0, t0 = 0; const id = setTimeout(() => { const step = (now) => { if (!t0) t0 = now; const p = Math.min(1, (now - t0) / ms); setV(Math.round(target * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(step); }; raf = requestAnimationFrame(step); }, delay);
    return () => { clearTimeout(id); cancelAnimationFrame(raf); };
  }, [target, ms, delay]);
  return v;
}

/* Exercises: "MISSION COMPLETED" - neon / gaming style (cyan, turquoise, electric purple, neon green): energy waves, rings, circular progress, floating shapes, counting stats */
export function MissionComplete({ total, correct, onContinue }) {
  const bad = Math.max(0, total - correct), acc = total ? Math.round((correct / total) * 100) : 0;
  const nT = useCount(total), nC = useCount(correct), nB = useCount(bad), nA = useCount(acc);
  const shapes = useRef(Array.from({ length: 16 }, (_, i) => ({ x: rnd(2, 96), s: rnd(10, 26), d: rnd(0, 8), t: rnd(7, 14), k: i % 3, c: i % 4 })));
  const R = 70, C = 2 * Math.PI * R;
  return (
    <div className="msn" role="dialog" aria-modal="true">
      <div className="msn-grid" />
      <div className="msn-aurora" />
      {shapes.current.map((s, i) => <i key={i} className={`msn-shape k${s.k} c${s.c}`} style={{ left: s.x + '%', width: s.s, height: s.s, animationDelay: -s.d + 's', animationDuration: s.t + 's' }} />)}
      <div className="msn-box">
        <div className="msn-stage">
          <span className="msn-wave w1" /><span className="msn-wave w2" /><span className="msn-wave w3" />
          <svg className="msn-ring" viewBox="0 0 160 160" aria-hidden="true">
            <defs><linearGradient id="mg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#22e6ff" /><stop offset=".55" stopColor="#8b5cff" /><stop offset="1" stopColor="#39ff88" /></linearGradient></defs>
            <circle cx="80" cy="80" r={R} fill="none" stroke="#ffffff14" strokeWidth="9" />
            <circle className="msn-prog" cx="80" cy="80" r={R} fill="none" stroke="url(#mg)" strokeWidth="9" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C} transform="rotate(-90 80 80)" style={{ '--c': C }} />
            <circle className="msn-orbit" cx="80" cy="80" r="78" fill="none" stroke="#22e6ff55" strokeWidth="1.5" strokeDasharray="3 9" />
          </svg>
          <div className="msn-badge">
            <svg viewBox="0 0 100 110" aria-hidden="true"><defs><linearGradient id="mb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#22e6ff" /><stop offset="1" stopColor="#8b5cff" /></linearGradient></defs>
              <path d="M50 4l40 22v46L50 106 10 72V26z" fill="#0b1b4d" stroke="url(#mb)" strokeWidth="4" />
              <path d="M32 54l13 13 25-27" fill="none" stroke="#39ff88" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        </div>
        <h1 className="msn-title" aria-label={t('msTitle')}>{[...t('msTitle')].map((ch, i) => <span key={i} style={{ animationDelay: i * 0.05 + 's' }}>{ch === ' ' ? ' ' : ch}</span>)}</h1>
        <p className="msn-ex">{t('msExcellent')}</p>
        <p className="msn-sub">{t('msDone')}</p>
        <p className="msn-msg">{t('msMotivation')}</p>
        <div className="msn-stats">
          <div><b>{nT}</b><small>{t('msTotalQ')}</small></div>
          <div className="g"><b>{nC}</b><small>{t('msCorrect')}</small></div>
          <div className="r"><b>{nB}</b><small>{t('msIncorrect')}</small></div>
          <div className="c"><b>{nA}%</b><small>{t('msAccuracy')}</small></div>
        </div>
        <button type="button" className="msn-btn" autoFocus onClick={onContinue}><span>{t('continueBtn')}</span><Icon name="chevR" size={18} /></button>
      </div>
    </div>
  );
}
