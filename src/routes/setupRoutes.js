const express = require('express');
const router = express.Router();
const setupController = require('../controllers/setupController');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

// Ruta: POST /api/setup/negocio
// Protegida: Solo el 'super' admin puede acceder
router.post(
  '/negocio', 
  verificarToken, 
  verificarRol(['super']), 
  setupController.crearNegocioYJefe
);

module.exports = router;