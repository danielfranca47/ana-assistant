import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import * as tasksController from '../controllers/tasks.controller'

const router = Router()

router.use(authenticate)
router.get('/', tasksController.listar)
router.post('/', tasksController.criar)
router.patch('/:id', tasksController.atualizar)
router.delete('/:id', tasksController.deletar)

export default router
