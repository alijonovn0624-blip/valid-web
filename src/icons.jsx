import { useState } from 'react';
// Single icon system for the whole app: Lucide only (outline, consistent stroke). No emoji as UI icons.
import {
  House, UsersRound, ChartNoAxesCombined, CalendarCheck, MessagesSquare, SquarePlay, CalendarDays, ClipboardCheck,
  ChartColumn, BookOpen, Swords, Coins, GraduationCap, UserRoundPlus, Hourglass, UserRoundCheck, UserRoundX, Trophy,
  Wallet, Users, Layers, Ticket, Download, Check, Bell, Moon, Sun, Globe, LogOut, User, Settings, CircleHelp, Menu,
  MessageCircle, X, ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Mail, Trash2, Pencil, Archive, ArchiveRestore,
  Star, Clock, CircleCheck, CircleAlert, TriangleAlert, Medal, MapPin, Play, Heart, Flame, Plus, CircleDashed,
  UserRoundSearch, ChartLine, Undo2, MonitorSmartphone, Circle, Hand, CalendarClock, Info, ChevronDown, ChevronUp, Table, Thermometer, NotebookPen, Paperclip, Volume2, Crown, Search, KeyRound, Bookmark, Lock, Mic, SendHorizontal, FileText, Image, Link,
  Gamepad2, Zap, Shuffle, Target, Flag, Palette, Droplet, Leaf, GraduationCap as Cap
} from 'lucide-react';

const MAP = {
  home: House, students: UsersRound, progress: ChartNoAxesCombined, attendance: CalendarCheck, groups: Layers,
  community: MessagesSquare, stories: SquarePlay, events: CalendarDays, homework: ClipboardCheck, grades: ChartColumn,
  courses: BookOpen, battles: Swords, coins: Coins, teachers: GraduationCap, promo: Ticket,
  newStudent: UserRoundPlus, pending: Hourglass, approved: UserRoundCheck, absent: UserRoundX, trophy: Trophy, wallet: Wallet,
  avgPoints: GraduationCap, users: Users, present: ClipboardCheck, rate: ChartNoAxesCombined, download: Download, check: Check,
  bell: Bell, moon: Moon, sun: Sun, globe: Globe, logout: LogOut, user: User, settings: Settings, help: CircleHelp, menu: Menu,
  chat: MessageCircle, close: X, back: ArrowLeft, next: ArrowRight, prev: ChevronLeft, chevR: ChevronRight, mail: Mail,
  trash: Trash2, edit: Pencil, archive: Archive, restore: ArchiveRestore, star: Star, clock: Clock, ok: CircleCheck,
  alert: CircleAlert, warn: TriangleAlert, medal: Medal, pin: MapPin, play: Play, heart: Heart, flame: Flame, plus: Plus,
  unmarked: CircleDashed, search: UserRoundSearch, trend: ChartLine, undo: Undo2, dash: MonitorSmartphone, dot: Circle,
  wave: Hand, calendarClock: CalendarClock, info: Info, chart: ChartColumn, calendar: CalendarDays, clip: Paperclip, volume: Volume2, crown: Crown, find: Search, key: KeyRound, lock: Lock, palette: Palette, droplet: Droplet, leaf: Leaf, gamepad: Gamepad2, zap: Zap, shuffle: Shuffle, target: Target, flag: Flag, cap: Cap, bookmark: Bookmark, mic: Mic, send: SendHorizontal, file: FileText, image: Image, link: Link, illness: Thermometer, note: NotebookPen, chevD: ChevronDown, chevU: ChevronUp, table: Table,
};

// Central registry of the local 3D icon files in public/assets/icons/. A missing file silently falls back to the Lucide outline icon.
const ASSETS = {
  attendance: 'attendance.png', events: 'events.png', homework: 'homework.png', trophy: 'ranking.png', ranking: 'ranking.png', star: 'points.png', points: 'points.png',
  vocabulary: 'vocabulary.png', grammar: 'grammar.png', community: 'community.png', messages: 'messages.png', achievements: 'achievements.png', progress: 'progress.png',
};
const MISSING = new Set();
export function AppIcon({ name, size = 24, className = '', fallback }) {
  const [bad, setBad] = useState(() => MISSING.has(name));
  const file = ASSETS[name];
  if (!file || bad) return <Icon name={fallback || name} size={Math.round(size * 0.85)} className={className} />;
  return <img className={'appicon ' + className} src={'/assets/icons/' + file} width={size} height={size} alt="" loading="lazy" decoding="async" onError={() => { MISSING.add(name); setBad(true); }} />;
}

export function Icon({ name, size = 18, className = '', strokeWidth = 1.9, fill, ...p }) {
  const C = MAP[name];
  if (!C) return null;
  return <C size={size} strokeWidth={strokeWidth} className={'lic ' + className} aria-hidden="true" fill={fill} {...p} />;
}

// Status strings keep a leading marker (✅ ❌ ⚠️) internally; it is rendered as an icon, never as an emoji.
export function Status({ msg }) {
  if (!msg) return null;
  const m = /^(✅|❌|⚠️)\s*/.exec(msg);
  const rest = m ? msg.slice(m[0].length) : msg;
  const name = m ? (m[1] === '✅' ? 'ok' : m[1] === '❌' ? 'alert' : 'warn') : null;
  return <span className="statusmsg">{name && <Icon name={name} size={16} />}<span>{rest}</span></span>;
}
