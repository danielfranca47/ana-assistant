import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as tasksService from '../services/tasks.service'
import { AppError } from '../middleware/errorHandler'

const criarSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)'),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Horário inválido (use HH:MM)')
    .optional(),
  duration: z.number().int().positive('Duração deve ser positiva').optional(),
  priority: z.enum(['alta', 'media', 'baixa']).default('media'),
  category: z.string().optional(),
  status: z.enum(['pending', 'done', 'current', 'late']).default('pending'),
})

const atualizarSchema = z
  .object({
    name: z.string().min(1, 'Nome obrigatório').optional(),
    time: z
      .string()
      .regex(/^\d{2}:\d{2}$/, 'Horário inválido (use HH:MM)')
      .optional(),
    duration: z.number().int().positive('Duração deve ser positiva').optional(),
    priority: z.enum(['alta', 'media', 'baixa']).optional(),
    category: z.string().optional(),
    status: z.enum(['pending', 'done', 'current', 'late']).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'Nenhum campo para atualizar',
  })

export async function listar(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const date =
      typeof req.query.date === 'string' ? req.query.date : undefined
    const tasks = await tasksService.listar(req.user!.id, date)
    res.status(200).json({ data: tasks, error: null, meta: {} })
  } catch (err) {
    next(err)
  }
}

export async function criar(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = criarSchema.safeParse(req.body)
    if (!result.success) {
      return next(new AppError(result.error.errors[0].message, 400))
    }

    const task = await tasksService.criar(req.user!.id, result.data)
    res.status(201).json({ data: task, error: null, meta: {} })
  } catch (err) {
    next(err)
  }
}

export async function atualizar(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = atualizarSchema.safeParse(req.body)
    if (!result.success) {
      return next(new AppError(result.error.errors[0].message, 400))
    }

    const task = await tasksService.atualizar(
      req.user!.id,
      req.params.id,
      result.data,
    )
    res.status(200).json({ data: task, error: null, meta: {} })
  } catch (err) {
    next(err)
  }
}

export async function deletar(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await tasksService.deletar(req.user!.id, req.params.id)
    res.status(200).json({ data: null, error: null, meta: {} })
  } catch (err) {
    next(err)
  }
}
