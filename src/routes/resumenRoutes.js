const express = require('express');
const router = express.Router();
const resumenController = require('../controllers/resumenController');
const { verificarToken } = require('../middlewares/authMiddleware');

// Protegemos todas las rutas
router.use(verificarToken);

// Ruta: GET /api/resumen
router.get('/', resumenController.obtenerResumen);

// Ruta: POST /api/resumen/cierre
router.post('/cierre', resumenController.registrarCierreCaja);

module.exports = router;