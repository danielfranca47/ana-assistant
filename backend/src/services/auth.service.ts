import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'
import { AppError } from '../middleware/errorHandler'

const prisma = new PrismaClient()

type UserSemPassword = {
  id: string
  name: string
  email: string
  createdAt: Date
  updatedAt: Date
}

function omitPassword(user: {
  id: string
  name: string
  email: string
  password: string
  createdAt: Date
  updatedAt: Date
}): UserSemPassword {
  const { password: _, ...rest } = user
  return rest
}

export async function register(
  name: string,
  email: string,
  password: string,
): Promise<UserSemPassword> {
  const existente = await prisma.user.findUnique({ where: { email } })
  if (existente) {
    throw new AppError('E-mail já cadastrado', 409)
  }

  const hash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: { name, email, password: hash },
  })

  return omitPassword(user)
}

export async function login(
  email: string,
  password: string,
): Promise<{ user: UserSemPassword; token: string }> {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    throw new AppError('Credenciais inválidas', 401)
  }

  const senhaCorreta = await bcrypt.compare(password, user.password)
  if (!senhaCorreta) {
    throw new AppError('Credenciais inválidas', 401)
  }

  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET não configurado')
  }

  const token = jwt.sign({ sub: user.id, email: user.email }, secret, {
    expiresIn: '7d',
  })

  return { user: omitPassword(user), token }
}

export async function getMe(userId: string): Promise<UserSemPassword> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  return omitPassword(user)
}
