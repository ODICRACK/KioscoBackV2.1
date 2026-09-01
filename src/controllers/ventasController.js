const db = require('../config/db');
const { registrarAuditoria } = require('./auditoriaController');

const crearVenta = async (req, res) => {
  const { productos, pagos, turno } = req.body;
  const { id_negocio, id_usuario } = req.usuario;

  // Obtenemos un cliente dedicado exclusivamente para esta transacción
  const pool = db.getPool();
  const client = await pool.connect();

  try {
    // 1. Iniciamos la transacción segura
    await client.query('BEGIN');

    // 2. Insertamos la Cabecera de la Venta
    const ventaResult = await client.query(
      `INSERT INTO VENTAS (id_negocio, id_usuario, turno) 
       VALUES ($1, $2, $3) RETURNING id`,
      [id_negocio, id_usuario, turno]
    );
    const id_venta = ventaResult.rows[0].id;

    // 3. Procesamos los Productos (Detalle y Stock)
    for (const item of productos) {
      // Bloqueamos la fila del producto (FOR UPDATE) para que otro cajero no pueda venderlo al mismo tiempo
      const stockResult = await client.query(
        'SELECT stock, precio, nombre FROM PRODUCTOS WHERE id = $1 AND eliminado = false FOR UPDATE',
        [item.id_producto]
      );

      if (stockResult.rows.length === 0) {
        throw new Error(`El producto con ID ${item.id_producto} no existe o fue eliminado.`);
      }

      const productoDB = stockResult.rows[0];

      if (productoDB.stock < item.cantidad) {
        throw new Error(`Stock insuficiente para: ${productoDB.nombre}. Stock actual: ${productoDB.stock}`);
      }

      // Descontamos el stock
      await client.query(
        'UPDATE PRODUCTOS SET stock = stock - $1 WHERE id = $2',
        [item.cantidad, item.id_producto]
      );

      // Insertamos el detalle de la venta congelando el precio
      await client.query(
        `INSERT INTO VENTA_PRODUCTO (id_venta, id_producto, cantidad, monto_individual) 
         VALUES ($1, $2, $3, $4)`,
        [id_venta, item.id_producto, item.cantidad, item.monto_individual]
      );
    }

    // 4. Procesamos los Pagos (Efectivo / Transferencia / Mixto)
    for (const pago of pagos) {
      if (pago.monto > 0) {
        await client.query(
          `INSERT INTO VENTA_PAGO (id_venta, metodo, monto) 
           VALUES ($1, $2, $3)`,
          [id_venta, pago.metodo, pago.monto]
        );
      }
    }

    // 5. Confirmamos todos los cambios en la base de datos
    await client.query('COMMIT');

    res.status(201).json({ 
      message: 'Venta registrada con éxito',
      id_venta 
    });

  } catch (error) {
    // Si cualquier paso falla (ej. falta de stock), revertimos TODO.
    await client.query('ROLLBACK');
    console.error('Error procesando la venta:', error.message);
    
    // Enviamos el mensaje de error específico (ej. "Stock insuficiente")
    res.status(400).json({ message: error.message || 'Error al procesar la venta' });
  } finally {
    // Liberamos el cliente para que otro usuario pueda usarlo
    client.release();
  }
};

const editarVenta = async (req, res) => {
  const { id } = req.params;
  const { items, productos } = req.body;
  const productosNuevos = items || productos || [];
  const { id_negocio } = req.usuario;

  const pool = db.getPool(); // Asegúrate de que db.getPool() exista en tu db.js
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Verificar que la venta existe
    const ventaCheck = await client.query(
      'SELECT id FROM VENTAS WHERE id = $1 AND id_negocio = $2',
      [id, id_negocio]
    );

    if (ventaCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Venta no encontrada' });
    }

    // 2. Obtener productos actuales y DEVOLVER TODO EL STOCK
    const actualesResult = await client.query(
      'SELECT id_producto, cantidad FROM VENTA_PRODUCTO WHERE id_venta = $1',
      [id]
    );
    const actuales = actualesResult.rows;

    for (const itemActual of actuales) {
      await client.query(
        'UPDATE PRODUCTOS SET stock = stock + $1 WHERE id = $2',
        [itemActual.cantidad, itemActual.id_producto]
      );
    }

    // 3. Eliminar los items anteriores
    await client.query('DELETE FROM VENTA_PRODUCTO WHERE id_venta = $1', [id]);

    // 4. Procesar los NUEVOS items (restar stock verificando que alcance y guardar)
    for (const item of productosNuevos) {
      const prodId = item.id_producto || item.id;
      const cant = item.cantidad || 1;
      const monto = item.monto_individual || item.precio || 0;

      // Bloquear fila y verificar stock
      const stockResult = await client.query(
        'SELECT stock, nombre FROM PRODUCTOS WHERE id = $1 AND eliminado = false FOR UPDATE',
        [prodId]
      );

      if (stockResult.rows.length === 0) {
        throw new Error(`El producto con ID ${prodId} no existe o fue eliminado.`);
      }

      const productoDB = stockResult.rows[0];
      if (productoDB.stock < cant) {
        throw new Error(`Stock insuficiente para: ${productoDB.nombre}. Stock actual: ${productoDB.stock}`);
      }

      // Descontar nuevo stock
      await client.query(
        'UPDATE PRODUCTOS SET stock = stock - $1 WHERE id = $2',
        [cant, prodId]
      );

      // Insertar nuevo detalle
      await client.query(
        `INSERT INTO VENTA_PRODUCTO (id_venta, id_producto, cantidad, monto_individual) 
         VALUES ($1, $2, $3, $4)`,
        [id, prodId, cant, monto]
      );
    }

    // 5. Registrar auditoría
    await registrarAuditoria(id_negocio, req.usuario.id_usuario || req.usuario.id, 'EDICION_VENTA', 'VENTA', id, { 
      items_antiguos: actuales, 
      items_nuevos: productosNuevos 
    }, client);
    
    await client.query('COMMIT');
    res.json({ message: 'Venta actualizada correctamente' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al editar venta:', error);
    res.status(500).json({ message: error.message || 'Error al editar venta' });
  } finally {
    client.release();
  }
};

const eliminarVenta = async (req, res) => {
  const { id } = req.params;
  const { id_negocio } = req.usuario;

  const pool = db.getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Verificar que la venta existe y pertenece al negocio del usuario
    const ventaCheck = await client.query(
      'SELECT id FROM VENTAS WHERE id = $1 AND id_negocio = $2',
      [id, id_negocio]
    );

    if (ventaCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Venta no encontrada' });
    }

    // 2. Obtener productos actuales de la venta para restaurar stock
    const actualesResult = await client.query(
      'SELECT id_producto, cantidad FROM VENTA_PRODUCTO WHERE id_venta = $1',
      [id]
    );
    const actuales = actualesResult.rows;

    // Restaurar stock
    for (const itemActual of actuales) {
      await client.query(
        'UPDATE PRODUCTOS SET stock = stock + $1 WHERE id = $2',
        [itemActual.cantidad, itemActual.id_producto]
      );
    }

    // 3. Eliminar dependencias y la venta
    await client.query('DELETE FROM VENTA_PAGO WHERE id_venta = $1', [id]);
    await client.query('DELETE FROM VENTA_PRODUCTO WHERE id_venta = $1', [id]);
    await client.query('DELETE FROM VENTAS WHERE id = $1', [id]);

    await registrarAuditoria(id_negocio, req.usuario.id_usuario || req.usuario.id, 'ELIMINACION_VENTA', 'VENTA', id, {
      items_eliminados: actuales
    }, client);
    await client.query('COMMIT');
    res.json({ message: 'Venta eliminada correctamente' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al eliminar venta:', error);
    res.status(500).json({ message: 'Error al eliminar venta' });
  } finally {
    client.release();
  }
};

module.exports = { crearVenta, editarVenta, eliminarVenta };