import express from 'express';
import cors from 'cors';
import path from 'path';
import authRoutes from './routes/auth.routes';
import projectRoutes from './routes/projects.routes';
import uploadRoutes from './routes/upload.routes';
import { swaggerSpec, swaggerUi } from './swagger';
import { errorMiddleware } from './middleware/error.middleware';

const app = express();

// CORS — только от фронтенда
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);

app.use(express.json());

// Статические файлы из папки uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health-check
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Роуты
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/upload', uploadRoutes);

// Глобальный обработчик ошибок (должен быть последним)
app.use(errorMiddleware);

export default app;
