// dotenv deve ser o primeiro import para popular process.env antes de qualquer módulo
import 'dotenv/config'
import app from './app'

const PORT = Number(process.env.PORT) || 3001

app.listen(PORT, () => {
  console.log(`Servidor Ana iniciado na porta ${PORT}`)
  console.log(`Ambiente: ${process.env.NODE_ENV ?? 'development'}`)
})
