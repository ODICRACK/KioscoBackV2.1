const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json()); // Permite recibir body en formato JSON

// Ruta de prueba básica
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Servidor del Kiosco funcionando perfectamente' });
});

// Aquí luego importaremos nuestras rutas reales
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/setup', require('./routes/setupRoutes'));
app.use('/api/catalogo', require('./routes/catalogoRoutes'));
app.use('/api/ventas', require('./routes/ventasRoutes'));
app.use('/api/resumen', require('./routes/resumenRoutes'));
app.use('/api/promociones', require('./routes/promocionesRoutes'));
app.use("/api/autoria", require("./routes/auditoriaRoutes"))

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});