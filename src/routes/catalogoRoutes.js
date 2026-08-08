const express = require('express');
const router = express.Router();
const catalogoController = require('../controllers/catalogoController');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

// Todas las rutas del catálogo requieren estar autenticado
router.use(verificarToken);

// Categorías y Subcategorías
router.get('/categorias', catalogoController.obtenerCategorias);
router.post('/categorias', verificarRol(['jefe', 'super']), catalogoController.crearCategoria);
router.delete('/categorias/:id', verificarRol(['jefe', 'super']), catalogoController.eliminarCategoria);
router.post('/subcategorias', verificarRol(['jefe', 'super']), catalogoController.crearSubCategoria);
router.delete('/subcategorias/:id', verificarRol(['jefe', 'super']), catalogoController.eliminarSubCategoria);

// Productos
router.get('/productos', catalogoController.obtenerProductos);
router.post('/productos', verificarRol(['jefe', 'super']), catalogoController.crearProducto);
router.put('/productos/:id', verificarRol(['jefe', 'super']), catalogoController.editarProducto);
router.delete('/productos/:id', verificarRol(['jefe', 'super']), catalogoController.eliminarProducto);

module.exports = router;