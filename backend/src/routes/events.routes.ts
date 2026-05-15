import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import * as eventsController from '../controllers/events.controller'

const router = Router()

router.use(authenticate)
router.get('/', eventsController.listar)
router.post('/', eventsController.criar)
router.patch('/:id', eventsController.atualizar)
router.delete('/:id', eventsController.deletar)

export default router
