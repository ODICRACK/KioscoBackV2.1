const db = require('../config/db');

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

module.exports = { crearVenta };