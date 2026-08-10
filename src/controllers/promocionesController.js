const db = require('../config/db');

// ==========================================
// OBTENER PROMOCIONES ACTIVAS
// ==========================================
const obtenerPromociones = async (req, res) => {
  const { id_negocio } = req.usuario;

  try {
    // Usamos json_agg para devolver la promo junto con el array de las subcategorías que la integran
    const query = `
      SELECT 
        p.id, 
        p.nombre,
        p.precio,
        COALESCE(
          json_agg(
            json_build_object('id', ps.id_subcategoria, 'nombre', s.nombre)
          ) FILTER (WHERE ps.id_subcategoria IS NOT NULL), '[]'
        ) as subcategorias
      FROM PROMOCIONES p
      LEFT JOIN PROMOCION_SUB ps ON p.id = ps.id_promocion
      LEFT JOIN SUB_CATEGORIAS s ON ps.id_subcategoria = s.id
      WHERE p.id_negocio = $1 AND p.eliminado = false
      GROUP BY p.id, p.nombre
      ORDER BY p.id DESC
    `;

    const { rows } = await db.query(query, [id_negocio]);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener promociones:', error);
    res.status(500).json({ message: 'Error al obtener las promociones' });
  }
};

// ==========================================
// CREAR PROMOCIÓN (Transacción)
// ==========================================
const crearPromocion = async (req, res) => {
  const { nombre, precio, subcategorias } = req.body; 
  // "subcategorias" debe ser un array de IDs: [101, 102]
  const { id_negocio } = req.usuario;

  if (!subcategorias || subcategorias.length === 0) {
    return res.status(400).json({ message: 'La promoción debe tener al menos una subcategoría asignada' });
  }

  const pool = db.getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Insertamos la cabecera de la promoción
    const promoResult = await client.query(
      'INSERT INTO PROMOCIONES (id_negocio, nombre, precio) VALUES ($1, $2, $3) RETURNING id',
      [id_negocio, nombre, precio]
    );
    const id_promocion = promoResult.rows[0].id;

    // 2. Vinculamos cada subcategoría enviada
    for (const id_subcategoria of subcategorias) {
      // Validamos que la subcategoría pertenezca al negocio para evitar inyecciones cruzadas
      const subCheck = await client.query(
        `SELECT s.id FROM SUB_CATEGORIAS s
         JOIN CATEGORIAS c ON s.id_categoria = c.id
         WHERE s.id = $1 AND c.id_negocio = $2 AND s.eliminado = false`,
        [id_subcategoria, id_negocio]
      );

      if (subCheck.rows.length === 0) {
        throw new Error(`La subcategoría con ID ${id_subcategoria} no es válida o no pertenece al negocio.`);
      }

      // Insertamos el vínculo
      await client.query(
        'INSERT INTO PROMOCION_SUB (id_promocion, id_subcategoria) VALUES ($1, $2)',
        [id_promocion, id_subcategoria]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({ 
      message: 'Promoción creada con éxito',
      id_promocion 
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear promoción:', error.message);
    res.status(400).json({ message: error.message || 'Error interno al procesar la promoción' });
  } finally {
    client.release();
  }
};

// ==========================================
// ELIMINAR PROMOCIÓN (Soft Delete)
// ==========================================
const eliminarPromocion = async (req, res) => {
  const { id } = req.params;
  const { id_negocio } = req.usuario;

  try {
    const { rows } = await db.query(
      'UPDATE PROMOCIONES SET eliminado = true WHERE id = $1 AND id_negocio = $2 RETURNING id',
      [id, id_negocio]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Promoción no encontrada o no pertenece a su negocio' });
    }

    res.json({ message: 'Promoción eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar promoción:', error);
    res.status(500).json({ message: 'Error al intentar eliminar la promoción' });
  }
};

module.exports = {
  obtenerPromociones,
  crearPromocion,
  eliminarPromocion
};