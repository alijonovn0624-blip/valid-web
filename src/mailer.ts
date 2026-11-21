import nodemailer from 'nodemailer';

// Google App password ko'pincha probel bilan beriladi — probellar olib tashlanadi
const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');

const transport = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    })
  : null;

// Server ishga tushganda SMTP ulanishini tekshiradi va natijani terminalda ko'rsatadi
if (transport) {
  transport.verify().then(
    () => console.log(`[MAIL] SMTP tayyor: ${process.env.SMTP_USER} (${process.env.SMTP_HOST})`),
    (e) => console.error('[MAIL] SMTP XATO — kodlar emailga bormaydi:', e.message),
  );
} else {
  console.log('[MAIL] SMTP sozlanmagan (.env da SMTP_HOST yo\'q): tasdiqlash xatlari yuborilmaydi');
}

// 'sent' — SMTP server xabarni qabul qildi; 'dev' — SMTP sozlanmagan (kod faqat terminalda)
export async function sendCode(to: string, code: string): Promise<'sent' | 'dev'> {
  if (!transport) {
    // Kod hech qachon logga yozilmaydi: SMTP sozlanmagan bo'lsa xat yuborilmaydi
    console.warn('[MAIL] SMTP sozlanmagan — xat yuborilmadi');
    return 'dev';
  }
  const info = await transport.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject: 'Valid EduAction — tasdiqlash kodi',
    text: `Tasdiqlash kodingiz: ${code}\nKod 10 daqiqa amal qiladi. Agar siz so'ramagan bo'lsangiz, bu xatni e'tiborsiz qoldiring.`,
  });
  if (!info.accepted || info.accepted.length === 0) throw new Error('Email qabul qilinmadi');
  return 'sent';
}
