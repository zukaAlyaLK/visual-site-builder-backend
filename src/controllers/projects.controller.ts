import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import * as projectsService from '../services/projects.service';

export async function getProjects(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await projectsService.getUserProjects(req.userId!);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function createProject(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, description } = req.body;

    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const result = await projectsService.createProject(req.userId!, name, description);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getProjectById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = req.params['id'] as string;
    const result = await projectsService.getProjectById(req.userId!, projectId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateProject(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = req.params['id'] as string;
    const { name, description, canvasData } = req.body;
    const result = await projectsService.updateProject(req.userId!, projectId, {
      name,
      description,
      canvasData,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function deleteProject(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = req.params['id'] as string;
    const result = await projectsService.deleteProject(req.userId!, projectId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function inviteMember(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = req.params['id'] as string;
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'email is required' });
      return;
    }

    const result = await projectsService.inviteMember(req.userId!, projectId, email);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getProjectMembers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = req.params['id'] as string;
    const result = await projectsService.getProjectMembers(req.userId!, projectId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function removeMember(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = req.params['id'] as string;
    const targetUserId = req.params['userId'] as string;
    const result = await projectsService.removeMember(req.userId!, projectId, targetUserId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
