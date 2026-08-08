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

const obtenerUsuarios = async (req, res) => {
  const { id_negocio } = req.usuario;

  try {
    const { rows } = await db.query(
      'SELECT id, usuario, rol, turno FROM USUARIOS WHERE id_negocio = $1 ORDER BY usuario',
      [id_negocio]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ message: 'Error al obtener lista de usuarios' });
  }
};

const crearUsuario = async (req, res) => {
  const { usuario, password } = req.body;
  const { id_negocio } = req.usuario;

  if (!usuario || !password) {
    return res.status(400).json({ message: 'Usuario y contraseña son requeridos' });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const passwordHasheada = await bcrypt.hash(password, salt);

    const { rows } = await db.query(
      'INSERT INTO USUARIOS (id_negocio, usuario, password, rol) VALUES ($1, $2, $3, $4) RETURNING id, usuario, rol',
      [id_negocio, usuario, passwordHasheada, 'cajero']
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error al crear usuario:', error);
    if (error.code === '23505') {
      return res.status(400).json({ message: 'El nombre de usuario ya está en uso' });
    }
    res.status(500).json({ message: 'Error al crear usuario empleado' });
  }
};

const eliminarUsuario = async (req, res) => {
  const { id } = req.params;
  const { id_negocio, id_usuario } = req.usuario;

  if (Number(id) === Number(id_usuario)) {
    return res.status(400).json({ message: 'No puede eliminar su propio usuario' });
  }

  try {
    const { rows } = await db.query(
      'DELETE FROM USUARIOS WHERE id = $1 AND id_negocio = $2 RETURNING id',
      [id, id_negocio]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json({ message: 'Usuario eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ message: 'Error al eliminar usuario' });
  }
};

module.exports = {
  login,
  obtenerUsuarios,
  crearUsuario,
  eliminarUsuario
};