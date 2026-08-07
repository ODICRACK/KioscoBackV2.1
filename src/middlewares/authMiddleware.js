const jwt = require('jsonwebtoken');

const verificarToken = (req, res, next) => {
  // El token viene en los headers como: "Bearer <token>"
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Acceso denegado. Token no proporcionado.' });
  }

  try {
    // Desencriptamos el token usando nuestra palabra secreta del .env
    const usuarioDecodificado = jwt.verify(token, process.env.JWT_SECRET);
    
    // Inyectamos los datos del usuario en la petición (req) para que el controlador los pueda usar
    req.usuario = usuarioDecodificado; 
    
    // Dejamos pasar a la siguiente función
    next(); 
  } catch (error) {
    return res.status(401).json({ message: 'Token inválido o expirado.' });
  }
};

// Middleware adicional para restringir por rol
const verificarRol = (rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ message: 'No tienes permisos para realizar esta acción.' });
    }
    next();
  };
};

module.exports = { verificarToken, verificarRol };