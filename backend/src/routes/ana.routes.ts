import { Router } from 'express'
import multer from 'multer'
import { authenticate } from '../middleware/auth'
import * as anaController from '../controllers/ana.controller'

const router = Router()

// Áudio em memória — máximo 25 MB (limite do Whisper)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
})

router.use(authenticate)
router.post('/chat', anaController.chat)
router.post('/rebalance', anaController.rebalance)
router.post('/transcribe', upload.single('audio'), anaController.transcribe)

export default router
