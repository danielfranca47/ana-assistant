import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as eventsService from '../services/events.service'
import { AppError } from '../middleware/errorHandler'

const horarioRegex = /^\d{2}:\d{2}$/
const dataRegex = /^\d{4}-\d{2}-\d{2}$/

const criarSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  date: z.string().regex(dataRegex, 'Data inválida (use YYYY-MM-DD)'),
  startTime: z.string().regex(horarioRegex, 'Horário inválido (use HH:MM)').optional(),
  endTime: z.string().regex(horarioRegex, 'Horário inválido (use HH:MM)').optional(),
  category: z.enum(['work', 'meet', 'pers', 'break']).default('pers'),
  notes: z.string().optional(),
})

const atualizarSchema = z
  .object({
    name: z.string().min(1, 'Nome obrigatório').optional(),
    date: z.string().regex(dataRegex, 'Data inválida (use YYYY-MM-DD)').optional(),
    startTime: z.string().regex(horarioRegex, 'Horário inválido (use HH:MM)').optional(),
    endTime: z.string().regex(horarioRegex, 'Horário inválido (use HH:MM)').optional(),
    category: z.enum(['work', 'meet', 'pers', 'break']).optional(),
    notes: z.string().optional(),
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
    const from = typeof req.query.from === 'string' ? req.query.from : undefined
    const to = typeof req.query.to === 'string' ? req.query.to : undefined
    const events = await eventsService.listar(req.user!.id, from, to)
    res.status(200).json({ data: events, error: null, meta: {} })
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

    const event = await eventsService.criar(req.user!.id, result.data)
    res.status(201).json({ data: event, error: null, meta: {} })
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

    const event = await eventsService.atualizar(
      req.user!.id,
      req.params.id,
      result.data,
    )
    res.status(200).json({ data: event, error: null, meta: {} })
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
    await eventsService.deletar(req.user!.id, req.params.id)
    res.status(200).json({ data: null, error: null, meta: {} })
  } catch (err) {
    next(err)
  }
}
