import express from 'express'
import cors from 'cors'
import { errorHandler } from './middleware/errorHandler'
import authRouter from './routes/auth.routes'
import tasksRouter from './routes/tasks.routes'
import eventsRouter from './routes/events.routes'
import anaRouter from './routes/ana.routes'

const app = express()

// Aceita requisições do frontend Vite em desenvolvimento
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)

app.use(express.json())

// Verificação de saúde do servidor
app.get('/api/v1/health', (_req, res) => {
  res.status(200).json({
    data: { status: 'ok', timestamp: new Date().toISOString() },
    error: null,
    meta: {},
  })
})

app.use('/api/v1/auth', authRouter)
app.use('/api/v1/tasks', tasksRouter)
app.use('/api/v1/events', eventsRouter)
app.use('/api/v1/ana', anaRouter)

// Middleware de erros deve ser registrado por último
app.use(errorHandler)

export default app
