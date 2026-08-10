const express = require('express');
const router = express.Router();
const ventasController = require('../controllers/ventasController');
const { verificarToken } = require('../middlewares/authMiddleware');

// Protegemos todas las rutas de ventas
router.use(verificarToken);

// Ruta: POST /api/ventas
router.post('/', ventasController.crearVenta);

// Ruta: PUT /api/ventas/:id
router.put('/:id', ventasController.editarVenta);

module.exports = router;