const db = require('../config/db');

// Función interna para registrar en la tabla AUDITORIA
const registrarAuditoria = async (id_negocio, id_usuario, accion, entidad, id_entidad, detalles, client = null) => {
  // CORRECCIÓN 1: Envolver la consulta en comillas invertidas (backticks)
  const query = `
    INSERT INTO AUDITORIA (id_negocio, id_usuario, accion, entidad, id_entidad, detalles)
    VALUES ($1, $2, $3, $4, $5, $6)
  `;
  
  const values = [id_negocio, id_usuario, accion, entidad, id_entidad, JSON.stringify(detalles || {})];
  
  if (client) {
    await client.query(query, values);
  } else {
    await db.query(query, values);
  }
};

const obtenerAuditorias = async (req, res) => {
  const { id_negocio } = req.usuario;

  try {
    // CORRECCIÓN 2: Envolver la consulta en comillas invertidas
    // CORRECCIÓN 3: Cambiar u.nombre por u.usuario (según la estructura de tu BD)
    const { rows } = await db.query(`
      SELECT a.*, u.usuario as usuario_nombre
      FROM AUDITORIA a
      LEFT JOIN USUARIOS u ON a.id_usuario = u.id
      WHERE a.id_negocio = $1
      ORDER BY a.fecha_hora DESC
      LIMIT 1000
    `, [id_negocio]);

    res.json(rows);
  } catch (error) {
    console.error('Error al obtener auditoria:', error);
    res.status(500).json({ message: 'Error al obtener registros de auditoría' });
  }
};

module.exports = {
  registrarAuditoria,
  obtenerAuditorias
};