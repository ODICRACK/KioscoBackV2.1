const db = require('../config/db');
const bcrypt = require('bcrypt');

const crearNegocioYJefe = async (req, res) => {
  const { nombreNegocio, usuarioJefe, passwordJefe } = req.body;

  // Obtenemos un cliente exclusivo del pool para hacer la transacción
  const client = await db.query('SELECT 1'); // Truco para probar si hay conexión, pero usaremos pool directamente con promesas
  
  try {
    // Iniciamos la transacción
    await db.query('BEGIN');

    // 1. Validar que no exista ya el negocio (Regla: Solo 1 negocio activo)
    // Excluimos el ID 1 que es el SISTEMA_MAESTRO
    const negociosExistentes = await db.query('SELECT id FROM NEGOCIOS WHERE id > 1');

    // 2. Insertar el Negocio
    const insertNegocio = await db.query(
      'INSERT INTO NEGOCIOS (nombre) VALUES ($1) RETURNING id',
      [nombreNegocio]
    );
    const idNuevoNegocio = insertNegocio.rows[0].id;

    // 3. Encriptar la contraseña del Jefe (Costo 10 es el estándar recomendado)
    const salt = await bcrypt.genSalt(10);
    const passwordHasheada = await bcrypt.hash(passwordJefe, salt);

    // 4. Insertar el Usuario Jefe
    await db.query(
      'INSERT INTO USUARIOS (id_negocio, usuario, password, rol) VALUES ($1, $2, $3, $4)',
      [idNuevoNegocio, usuarioJefe, passwordHasheada, 'jefe']
    );

    // Si todo salió bien, confirmamos los cambios en la BD
    await db.query('COMMIT');

    res.status(201).json({ 
      message: 'Negocio y usuario Jefe creados con éxito',
      negocio_id: idNuevoNegocio 
    });

  } catch (error) {
    // Si algo falla, deshacemos todos los INSERT parciales
    await db.query('ROLLBACK');
    console.error('Error al crear negocio y jefe:', error);
    
    // Verificamos si es un error de usuario duplicado (código 23505 en PostgreSQL)
    if (error.code === '23505') {
      return res.status(400).json({ message: 'El nombre de usuario ya está en uso' });
    }
    
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

module.exports = { crearNegocioYJefe };