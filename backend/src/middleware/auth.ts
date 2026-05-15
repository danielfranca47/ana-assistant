import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { AppError } from './errorHandler'

interface JwtPayload {
  sub: string
  email: string
  iat: number
  exp: number
}

// Valida o token Bearer e anexa o usuário autenticado à requisição
export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Token de autenticação não fornecido', 401))
  }

  const token = authHeader.split(' ')[1]

  try {
    const secret = process.env.JWT_SECRET

    if (!secret) {
      throw new Error('JWT_SECRET não configurado')
    }

    const decoded = jwt.verify(token, secret) as JwtPayload

    req.user = {
      id: decoded.sub,
      email: decoded.email,
    }

    next()
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      next(new AppError('Token inválido ou expirado', 401))
    } else {
      next(err)
    }
  }
}
