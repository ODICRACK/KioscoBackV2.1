const express = require('express');
const router = express.Router();
const promocionesController = require('../controllers/promocionesController');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

// Todas las rutas requieren un token válido
router.use(verificarToken);

// GET: Todos los empleados pueden ver las promos activas para ofrecerlas en la venta
router.get('/', promocionesController.obtenerPromociones);

// POST/PUT/DELETE: Todos los empleados pueden gestionar promos
router.post('/', promocionesController.crearPromocion);
router.put('/:id', promocionesController.editarPromocion);
router.delete('/:id', promocionesController.eliminarPromocion);

module.exports = router;