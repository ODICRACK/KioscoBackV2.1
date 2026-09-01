const express = require('express');
const router = express.Router();
const catalogoController = require('../controllers/catalogoController');
const { verificarToken } = require('../middlewares/authMiddleware');

// Todas las rutas del catálogo requieren estar autenticado
router.use(verificarToken);

// Categorías y Subcategorías
router.get('/categorias', catalogoController.obtenerCategorias);
router.post('/categorias', catalogoController.crearCategoria);
router.delete('/categorias/:id', catalogoController.eliminarCategoria);
router.post('/subcategorias', catalogoController.crearSubCategoria);
router.delete('/subcategorias/:id', catalogoController.eliminarSubCategoria);

// Productos
router.get('/productos', catalogoController.obtenerProductos);
router.post('/productos', catalogoController.crearProducto);
router.put('/productos/:id', catalogoController.editarProducto);
router.delete('/productos/:id', catalogoController.eliminarProducto);

module.exports = router;