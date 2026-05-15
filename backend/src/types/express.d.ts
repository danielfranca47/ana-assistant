// Augmentação do tipo Request do Express para incluir o usuário autenticado

declare namespace Express {
  interface Request {
    user?: {
      id: string
      email: string
    }
  }
}
