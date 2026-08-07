const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const login = async (req, res) => {
  const { usuario, password } = req.body;

  try {
    // 1. Buscamos al usuario en la base de datos
    const { rows } = await db.query(
      'SELECT id, id_negocio, usuario, password, rol, turno FROM USUARIOS WHERE usuario = $1',
      [usuario]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
    }

    const user = rows[0];

    // 2. Comparamos la contraseña encriptada
    const passwordValida = await bcrypt.compare(password, user.password);
    
    if (!passwordValida) {
      return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
    }

    // 3. Generamos el Token con la información vital (Payload)
    const tokenPayload = {
      id_usuario: user.id,
      id_negocio: user.id_negocio,
      rol: user.rol,
      turno: user.turno
    };

    // El token durará 12 horas
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '12h' });

    // 4. Respondemos al Frontend
    res.json({
      message: 'Inicio de sesión exitoso',
      token,
      usuario: {
        id: user.id,
        usuario: user.usuario,
        rol: user.rol,
        turno: user.turno
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

module.exports = { login };