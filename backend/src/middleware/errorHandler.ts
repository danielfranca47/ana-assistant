import { Request, Response, NextFunction } from 'express'

// Erro operacional com código HTTP — usado em controllers e services
export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number = 500
  ) {
    super(message)
    this.name = 'AppError'
  }
}

// Middleware global de erros — deve ter 4 parâmetros para o Express reconhecê-lo
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (process.env.NODE_ENV !== 'production') {
    console.error('[Erro]', err.stack ?? err.message)
  } else {
    console.error('[Erro]', err.message)
  }

  const statusCode = err instanceof AppError ? err.statusCode : 500
  const message =
    err instanceof AppError ? err.message : 'Erro interno do servidor'

  res.status(statusCode).json({
    data: null,
    error: message,
    meta: {},
  })
}
