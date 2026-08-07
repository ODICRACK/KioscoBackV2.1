const express = require('express');
const router = express.Router();
const catalogoController = require('../controllers/catalogoController');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

// Todas las rutas del catálogo requieren estar autenticado
router.use(verificarToken);

// Categorías y Subcategorías
router.get('/categorias', catalogoController.obtenerCategorias);
// Solo el Jefe (o roles superiores) deberían crear categorías
router.post('/categorias', verificarRol(['jefe', 'super']), catalogoController.crearCategoria);
router.post('/subcategorias', verificarRol(['jefe', 'super']), catalogoController.crearSubCategoria);

// Productos
router.get('/productos', catalogoController.obtenerProductos);
router.post('/productos', verificarRol(['jefe', 'super']), catalogoController.crearProducto);
router.put('/productos/:id', verificarRol(['jefe', 'super']), catalogoController.editarProducto);
router.delete('/productos/:id', verificarRol(['jefe', 'super']), catalogoController.eliminarProducto);

module.exports = router;