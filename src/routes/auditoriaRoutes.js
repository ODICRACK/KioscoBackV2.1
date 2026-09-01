const express = require('express');
const router = express.Router();
const auditoriaController = require('../controllers/auditoriaController');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

router.use(verificarToken);

// Solo el admin puede ver la auditoría
router.get('/', verificarRol(['jefe', 'super']), auditoriaController.obtenerAuditorias);

module.exports = router;
