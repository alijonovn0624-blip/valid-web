import 'express-async-errors';
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import pointsRoutes from './routes/points';
import attendanceRoutes from './routes/attendance';
import storiesRoutes from './routes/stories';
import eventsRoutes from './routes/events';
import chatRoutes from './routes/chat';
import signupRoutes from './routes/signup';
import adminRoutes from './routes/admin';
import teacherRoutes from './routes/teacher';
import studentsRoutes from './routes/students';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', signupRoutes); // register/login/verify (avval)
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/teacher', studentsRoutes);
app.use('/api/points', pointsRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/stories', storiesRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/chat', chatRoutes);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Server xatosi' });
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => console.log(`Server: http://localhost:${port}`));

process.on('uncaughtException', (e) => console.error('uncaughtException:', e.message));
process.on('unhandledRejection', (e: any) => console.error('unhandledRejection:', e?.message ?? e));
