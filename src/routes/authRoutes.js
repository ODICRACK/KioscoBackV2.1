const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

// Ruta pública: POST /api/auth/login
router.post('/login', authController.login);

// Rutas protegidas para el Jefe: gestión de usuarios del negocio
router.get('/usuarios', verificarToken, verificarRol(['jefe', 'super']), authController.obtenerUsuarios);
router.post('/usuarios', verificarToken, verificarRol(['jefe', 'super']), authController.crearUsuario);
router.delete('/usuarios/:id', verificarToken, verificarRol(['jefe', 'super']), authController.eliminarUsuario);

module.exports = router;