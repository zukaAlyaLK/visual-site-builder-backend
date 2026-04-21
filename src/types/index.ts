import { Request } from 'express';

// Расширенный Request с userId от JWT middleware
export interface AuthRequest extends Request {
  userId?: string;
}

// Пользователь без хэша пароля (для ответов API)
export interface SafeUser {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

// Кастомный класс ошибок для передачи HTTP статуса
export class AppError extends Error {
  public status: number;

  constructor(message: string, status: number = 500) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// Структура canvasData
export interface CanvasData {
  elements: CanvasElement[];
  version: number;
}

export interface CanvasElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  props?: Record<string, unknown>;
}

// Участник комнаты WebSocket
export interface RoomParticipant {
  socketId: string;
  userId: string;
  userName: string;
  color: string;
}
