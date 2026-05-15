import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as anaService from '../services/ana.service'
import * as transcribeService from '../services/transcribe.service'
import { AppError } from '../middleware/errorHandler'

const chatSchema = z.object({
  message: z.string().min(1, 'Mensagem obrigatória'),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      }),
    )
    .default([]),
})

const rebalanceSchema = z.object({
  done: z.string().default(''),
  undone: z.string().default(''),
  notes: z.string().default(''),
})

export async function chat(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = chatSchema.safeParse(req.body)
    if (!result.success) {
      return next(new AppError(result.error.errors[0].message, 400))
    }

    const { message, history } = result.data
    const reply = await anaService.chat(req.user!.id, message, history)

    res.status(200).json({ data: { reply }, error: null, meta: {} })
  } catch (err) {
    next(err)
  }
}

export async function transcribe(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.file) {
      return next(new AppError('Arquivo de áudio obrigatório', 400))
    }

    const allowed = ['audio/webm', 'audio/mp4', 'audio/m4a', 'audio/mpeg', 'audio/ogg', 'video/webm']
    if (!allowed.includes(req.file.mimetype)) {
      return next(new AppError('Formato de áudio não suportado', 400))
    }

    const transcript = await transcribeService.transcribe(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
    )

    res.status(200).json({ data: { transcript }, error: null, meta: {} })
  } catch (err) {
    next(err)
  }
}

export async function rebalance(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = rebalanceSchema.safeParse(req.body)
    if (!result.success) {
      return next(new AppError(result.error.errors[0].message, 400))
    }

    const { suggestions, reportId } = await anaService.rebalance(
      req.user!.id,
      result.data,
    )

    res
      .status(200)
      .json({ data: { suggestions, reportId }, error: null, meta: {} })
  } catch (err) {
    next(err)
  }
}
