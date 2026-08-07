const db = require('../config/db');

// ==========================================
// RESUMEN DE VENTAS (HISTÓRICO)
// ==========================================
const obtenerResumen = async (req, res) => {
  const { id_negocio } = req.usuario;
  const { fecha, turno } = req.query; // Filtros opcionales desde el frontend

  try {
    // Usamos json_agg para agrupar los detalles (productos y pagos) dentro de la misma consulta SQL
    let query = `
      SELECT 
        v.id, 
        v.fecha_hora, 
        v.turno, 
        u.usuario as cajero,
        (
          SELECT json_agg(json_build_object(
            'id_producto', vp.id_producto,
            'nombre', p.nombre,
            'cantidad', vp.cantidad,
            'monto_individual', vp.monto_individual,
            'subtotal', (vp.cantidad * vp.monto_individual)
          ))
          FROM VENTA_PRODUCTO vp
          JOIN PRODUCTOS p ON vp.id_producto = p.id
          WHERE vp.id_venta = v.id
        ) as productos,
        (
          SELECT json_agg(json_build_object(
            'metodo', vpg.metodo,
            'monto', vpg.monto
          ))
          FROM VENTA_PAGO vpg
          WHERE vpg.id_venta = v.id
        ) as pagos
      FROM VENTAS v
      JOIN USUARIOS u ON v.id_usuario = u.id
      WHERE v.id_negocio = $1
    `;

    const values = [id_negocio];
    let paramIndex = 2;

    // Aplicamos filtros dinámicos si el usuario los envía
    if (fecha) {
      query += ` AND DATE(v.fecha_hora) = $${paramIndex}`;
      values.push(fecha);
      paramIndex++;
    }

    if (turno) {
      query += ` AND v.turno = $${paramIndex}`;
      values.push(turno);
    }

    query += ` ORDER BY v.fecha_hora DESC`;

    const { rows } = await db.query(query, values);

    // Aseguramos que si no hay productos o pagos, devuelva un array vacío en vez de null
    const ventasFormateadas = rows.map(venta => ({
      ...venta,
      productos: venta.productos || [],
      pagos: venta.pagos || []
    }));

    res.json(ventasFormateadas);
  } catch (error) {
    console.error('Error al obtener el resumen:', error);
    res.status(500).json({ message: 'Error al obtener el resumen de ventas' });
  }
};

// ==========================================
// CIERRE DE CAJA (ARQUEO)
// ==========================================
const registrarCierreCaja = async (req, res) => {
  const { saldo_declarado, turno } = req.body;
  const { id_negocio, id_usuario } = req.usuario;

  try {
    // 1. Calculamos el saldo en efectivo que el sistema espera para este usuario, turno y día
    const saldoQuery = await db.query(
      `SELECT COALESCE(SUM(vpg.monto), 0) as total_efectivo
       FROM VENTA_PAGO vpg
       JOIN VENTAS v ON vpg.id_venta = v.id
       WHERE v.id_negocio = $1 
         AND v.id_usuario = $2 
         AND v.turno = $3 
         AND DATE(v.fecha_hora) = CURRENT_DATE
         AND vpg.metodo = 'efectivo'`,
      [id_negocio, id_usuario, turno]
    );

    const saldoSistema = parseFloat(saldoQuery.rows[0].total_efectivo);
    const saldoDeclaradoFloat = parseFloat(saldo_declarado);

    // 2. Registramos el cierre en la base de datos para futuras auditorías
    const { rows } = await db.query(
      `INSERT INTO CIERRES_CAJA 
       (id_negocio, id_usuario, turno, fecha_apertura, fecha_cierre, saldo_final_sistema, saldo_final_declarado) 
       VALUES ($1, $2, $3, CURRENT_DATE::timestamp, CURRENT_TIMESTAMP, $4, $5) 
       RETURNING *`,
      [id_negocio, id_usuario, turno, saldoSistema, saldoDeclaradoFloat]
    );

    // Calculamos el descuadre (Diferencia de caja)
    const diferencia = saldoDeclaradoFloat - saldoSistema;

    res.status(201).json({
      message: 'Cierre de caja registrado exitosamente',
      cierre: rows[0],
      cuadre: {
        esperado: saldoSistema,
        declarado: saldoDeclaradoFloat,
        diferencia: diferencia, // Si es negativo, falta dinero. Si es positivo, sobra.
        estado: diferencia === 0 ? 'Exacto' : (diferencia < 0 ? 'Faltante' : 'Sobrante')
      }
    });
  } catch (error) {
    console.error('Error en el cierre de caja:', error);
    res.status(500).json({ message: 'Error al registrar el cierre de caja' });
  }
};

module.exports = {
  obtenerResumen,
  registrarCierreCaja
};