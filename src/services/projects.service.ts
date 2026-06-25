import { Role } from '@prisma/client';
import { AppError } from '../types';
import { prisma } from '../prisma';

// Получить все проекты пользователя (владелец + участник)
export async function getUserProjects(userId: string) {
  const ownedProjects = await prisma.project.findMany({
    where: { ownerId: userId },
    select: {
      id: true,
      name: true,
      description: true,
      updatedAt: true,
      createdAt: true,
    },
  });

  const memberProjects = await prisma.projectMember.findMany({
    where: { userId, role: Role.EDITOR },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          description: true,
          updatedAt: true,
          createdAt: true,
        },
      },
    },
  });

  const owned = ownedProjects.map((p: typeof ownedProjects[number]) => ({ ...p, role: Role.OWNER }));
  const member = memberProjects.map((m: typeof memberProjects[number]) => ({ ...m.project, role: m.role }));

  return { projects: [...owned, ...member] };
}

// Создать проект и добавить создателя как OWNER
export async function createProject(userId: string, name: string, description?: string) {
  const project = await prisma.project.create({
    data: {
      name,
      description,
      ownerId: userId,
      members: {
        create: {
          userId,
          role: Role.OWNER,
        },
      },
    },
  });

  return { project };
}

// Получить проект (только участники)
export async function getProjectById(userId: string, projectId: string) {
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });

  if (!member) {
    throw new AppError('Project not found or access denied', 403);
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  if (!project) {
    throw new AppError('Project not found', 404);
  }

  return { project };
}

// Обновить проект
// - name / description: только owner
// - canvasData: любой участник (EDITOR / OWNER)
export async function updateProject(
  userId: string,
  projectId: string,
  data: { name?: string; description?: string; canvasData?: object }
) {
  // If name or description are being changed, require owner rights
  if (data.name !== undefined || data.description !== undefined) {
    await assertOwner(userId, projectId);
  } else {
    // For canvasData-only updates, just verify the user is a project member
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!member) {
      throw new AppError('Access denied: You are not a member of this project', 403);
    }
  }

  const project = await prisma.project.update({
    where: { id: projectId },
    data,
  });

  return { project };
}

// Удалить проект (только owner)
export async function deleteProject(userId: string, projectId: string) {
  await assertOwner(userId, projectId);

  await prisma.project.delete({ where: { id: projectId } });

  return { success: true };
}

// Пригласить участника по email (роль EDITOR)
export async function inviteMember(requestingUserId: string, projectId: string, email: string) {
  await assertOwner(requestingUserId, projectId);

  const userToInvite = await prisma.user.findUnique({ where: { email } });
  if (!userToInvite) {
    throw new AppError('User with this email not found', 404);
  }

  // Проверить, не является ли уже участником
  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: userToInvite.id } },
  });

  if (existing) {
    throw new AppError('User is already a member of this project', 409);
  }

  const member = await prisma.projectMember.create({
    data: {
      projectId,
      userId: userToInvite.id,
      role: Role.EDITOR,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return {
    member: {
      userId: member.userId,
      name: member.user.name,
      email: member.user.email,
      role: member.role,
    },
  };
}

// Получить список участников проекта
export async function getProjectMembers(userId: string, projectId: string) {
  // Проверка доступа — только участники
  const access = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });

  if (!access) {
    throw new AppError('Access denied', 403);
  }

  const members = await prisma.projectMember.findMany({
    where: { projectId },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return {
    members: members.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
    })),
  };
}

// Удалить участника (только owner)
export async function removeMember(requestingUserId: string, projectId: string, targetUserId: string) {
  await assertOwner(requestingUserId, projectId);

  // Нельзя удалить самого владельца
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (project?.ownerId === targetUserId) {
    throw new AppError('Cannot remove the project owner', 400);
  }

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: targetUserId } },
  });

  if (!member) {
    throw new AppError('Member not found', 404);
  }

  await prisma.projectMember.delete({
    where: { projectId_userId: { projectId, userId: targetUserId } },
  });

  return { success: true };
}

// Вспомогательная функция: проверка, что пользователь является владельцем
async function assertOwner(userId: string, projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });

  if (!project) {
    throw new AppError('Project not found', 404);
  }

  if (project.ownerId !== userId) {
    throw new AppError('Forbidden: only the owner can perform this action', 403);
  }
}
