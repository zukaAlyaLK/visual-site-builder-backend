import { Router } from 'express';
import { register, login, me } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// POST /api/auth/register
router.post('/register', register);

// POST /api/auth/login
router.post('/login', login);

// GET /api/auth/me  (приватный маршрут)
router.get('/me', authMiddleware, me);

export default router;
