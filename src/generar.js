const bcrypt = require('bcrypt'); // Si usas bcryptjs, cambia esto a require('bcryptjs')

const crearNuevaContrasena = async () => {
  // Cambia esto por la contraseña que quieras usar
  const passwordPlana = 'Admin123456'; 
  const saltRounds = 10;

  const nuevoHash = await bcrypt.hash(passwordPlana, saltRounds);
  console.log('Copia este hash exacto:');
  console.log(nuevoHash);
};

crearNuevaContrasena();