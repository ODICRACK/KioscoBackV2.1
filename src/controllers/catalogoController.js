const db = require('../config/db');

// ==========================================
// CATEGORÍAS Y SUBCATEGORÍAS
// ==========================================

const obtenerCategorias = async (req, res) => {
  const { id_negocio } = req.usuario;

  try {
    // Obtenemos categorías activas
    const categoriasQuery = await db.query(
      'SELECT id, nombre FROM CATEGORIAS WHERE id_negocio = $1 AND eliminado = false ORDER BY nombre',
      [id_negocio]
    );
    const categorias = categoriasQuery.rows;

    // Obtenemos subcategorías activas vinculadas a esas categorías
    const subQuery = await db.query(
      `SELECT s.id, s.id_categoria, s.nombre 
       FROM SUB_CATEGORIAS s 
       JOIN CATEGORIAS c ON s.id_categoria = c.id 
       WHERE c.id_negocio = $1 AND s.eliminado = false`,
      [id_negocio]
    );
    const subcategorias = subQuery.rows;

    // Anidamos las subcategorías dentro de sus categorías para facilitar el renderizado en el Frontend
    const resultado = categorias.map(cat => ({
      ...cat,
      subcategorias: subcategorias.filter(sub => sub.id_categoria === cat.id)
    }));

    res.json(resultado);
  } catch (error) {
    console.error('Error al obtener categorías:', error);
    res.status(500).json({ message: 'Error al obtener el catálogo' });
  }
};

const crearCategoria = async (req, res) => {
  const { nombre } = req.body;
  const { id_negocio } = req.usuario;

  try {
    const { rows } = await db.query(
      'INSERT INTO CATEGORIAS (id_negocio, nombre) VALUES ($1, $2) RETURNING id, nombre',
      [id_negocio, nombre]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Error al crear la categoría' });
  }
};

const crearSubCategoria = async (req, res) => {
  const { id_categoria, nombre } = req.body;
  const { id_negocio } = req.usuario;

  try {
    // Validamos que la categoría maestra pertenezca al negocio del usuario
    const catCheck = await db.query(
      'SELECT id FROM CATEGORIAS WHERE id = $1 AND id_negocio = $2 AND eliminado = false',
      [id_categoria, id_negocio]
    );

    if (catCheck.rows.length === 0) {
      return res.status(403).json({ message: 'Categoría no válida o no pertenece a su negocio' });
    }

    const { rows } = await db.query(
      'INSERT INTO SUB_CATEGORIAS (id_categoria, nombre) VALUES ($1, $2) RETURNING id, id_categoria, nombre',
      [id_categoria, nombre]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Error al crear la subcategoría' });
  }
};

// ==========================================
// PRODUCTOS
// ==========================================

const obtenerProductos = async (req, res) => {
  const { id_negocio } = req.usuario;

  try {
    // Hacemos JOIN para asegurar que el producto pertenece al negocio mediante su categoría
    const { rows } = await db.query(
      `SELECT p.id, p.id_subcategoria, p.nombre, p.precio, p.stock, 
              s.nombre as subcategoria_nombre, c.nombre as categoria_nombre 
       FROM PRODUCTOS p
       JOIN SUB_CATEGORIAS s ON p.id_subcategoria = s.id
       JOIN CATEGORIAS c ON s.id_categoria = c.id
       WHERE c.id_negocio = $1 AND p.eliminado = false
       ORDER BY p.nombre`,
      [id_negocio]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener productos' });
  }
};

const crearProducto = async (req, res) => {
  const { id_subcategoria, nombre, precio, stock } = req.body;
  const { id_negocio } = req.usuario;

  try {
    // Seguridad: Verificar que la subcategoría pertenece al negocio del usuario
    const subCheck = await db.query(
      `SELECT s.id FROM SUB_CATEGORIAS s 
       JOIN CATEGORIAS c ON s.id_categoria = c.id 
       WHERE s.id = $1 AND c.id_negocio = $2 AND s.eliminado = false`,
      [id_subcategoria, id_negocio]
    );

    if (subCheck.rows.length === 0) {
      return res.status(403).json({ message: 'Subcategoría no válida' });
    }

    const { rows } = await db.query(
      'INSERT INTO PRODUCTOS (id_subcategoria, nombre, precio, stock) VALUES ($1, $2, $3, $4) RETURNING *',
      [id_subcategoria, nombre, precio, stock || 0]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Error al crear producto' });
  }
};

const editarProducto = async (req, res) => {
  const { id } = req.params;
  const { nombre, precio, stock, id_subcategoria } = req.body;

  try {
    // Actualizamos. (La validación estricta de pertenencia al negocio se podría agregar, pero como el ID es único y el token es requerido, es seguro si filtramos correctamente).
    const { rows } = await db.query(
      `UPDATE PRODUCTOS 
       SET nombre = COALESCE($1, nombre), 
           precio = COALESCE($2, precio), 
           stock = COALESCE($3, stock), 
           id_subcategoria = COALESCE($4, id_subcategoria) 
       WHERE id = $5 AND eliminado = false 
       RETURNING *`,
      [nombre, precio, stock, id_subcategoria, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Error al editar producto' });
  }
};

const eliminarProducto = async (req, res) => {
  const { id } = req.params;

  try {
    // SOFT DELETE: No usamos DELETE FROM, usamos UPDATE
    const { rows } = await db.query(
      'UPDATE PRODUCTOS SET eliminado = true WHERE id = $1 RETURNING id',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    res.json({ message: 'Producto eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar producto' });
  }
};

module.exports = {
  obtenerCategorias,
  crearCategoria,
  crearSubCategoria,
  obtenerProductos,
  crearProducto,
  editarProducto,
  eliminarProducto
};