import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  getProjects,
  createProject,
  getProjectById,
  updateProject,
  deleteProject,
  inviteMember,
  getProjectMembers,
  removeMember,
} from '../controllers/projects.controller';

const router = Router();

// Все маршруты проектов требуют JWT
router.use(authMiddleware);

// GET  /api/projects          — список проектов пользователя
router.get('/', getProjects);

// POST /api/projects          — создать проект
router.post('/', createProject);

// GET  /api/projects/:id      — получить проект по ID
router.get('/:id', getProjectById);

// PUT  /api/projects/:id      — обновить проект (only owner)
router.put('/:id', updateProject);

// DELETE /api/projects/:id    — удалить проект (only owner)
router.delete('/:id', deleteProject);

// POST /api/projects/:id/invite       — пригласить участника
router.post('/:id/invite', inviteMember);

// GET  /api/projects/:id/members      — список участников
router.get('/:id/members', getProjectMembers);

// DELETE /api/projects/:id/members/:userId — удалить участника
router.delete('/:id/members/:userId', removeMember);

export default router;
