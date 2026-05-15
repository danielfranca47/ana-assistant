import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as authService from '../services/auth.service'
import { AppError } from '../middleware/errorHandler'

const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
})

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
})

export async function register(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = registerSchema.safeParse(req.body)
    if (!result.success) {
      return next(new AppError(result.error.errors[0].message, 400))
    }

    const { name, email, password } = result.data
    const user = await authService.register(name, email, password)

    res.status(201).json({ data: user, error: null, meta: {} })
  } catch (err) {
    next(err)
  }
}

export async function login(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = loginSchema.safeParse(req.body)
    if (!result.success) {
      return next(new AppError(result.error.errors[0].message, 400))
    }

    const { email, password } = result.data
    const { user, token } = await authService.login(email, password)

    res.status(200).json({ data: { user, token }, error: null, meta: {} })
  } catch (err) {
    next(err)
  }
}

export async function me(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await authService.getMe(req.user!.id)
    res.status(200).json({ data: user, error: null, meta: {} })
  } catch (err) {
    next(err)
  }
}
