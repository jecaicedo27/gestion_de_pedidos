const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Iniciando configuración del proyecto...\n');

// Función para ejecutar comandos
const runCommand = (command, description) => {
  console.log(`📋 ${description}...`);
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`✅ ${description} completado\n`);
  } catch (error) {
    console.error(`❌ Error en: ${description}`);
    console.error(error.message);
    process.exit(1);
  }
};

// Función para verificar si un archivo existe
const fileExists = (filePath) => {
  return fs.existsSync(filePath);
};

// Función para copiar archivo si no existe
const copyFileIfNotExists = (source, destination, description) => {
  if (!fileExists(destination)) {
    console.log(`📋 ${description}...`);
    try {
      fs.copyFileSync(source, destination);
      console.log(`✅ ${description} completado\n`);
    } catch (error) {
      console.error(`❌ Error copiando archivo: ${error.message}`);
      process.exit(1);
    }
  } else {
    console.log(`ℹ️  ${description} - archivo ya existe\n`);
  }
};

// Verificar Node.js
console.log('🔍 Verificando requisitos...');
try {
  const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
  console.log(`✅ Node.js: ${nodeVersion}`);
} catch (error) {
  console.error('❌ Node.js no está instalado');
  process.exit(1);
}

try {
  const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
  console.log(`✅ npm: ${npmVersion}\n`);
} catch (error) {
  console.error('❌ npm no está disponible');
  process.exit(1);
}

// Copiar archivo .env si no existe
copyFileIfNotExists(
  path.join(__dirname, '../backend/.env.example'),
  path.join(__dirname, '../backend/.env'),
  'Copiando archivo de configuración .env'
);

// Instalar dependencias del proyecto principal
runCommand('npm install', 'Instalando dependencias principales');

// Instalar dependencias del backend
runCommand('cd backend && npm install', 'Instalando dependencias del backend');

// Instalar dependencias del frontend
runCommand('cd frontend && npm install', 'Instalando dependencias del frontend');

// Ejecutar migraciones de base de datos
console.log('📋 Configurando base de datos...');
console.log('⚠️  Asegúrate de que MySQL esté ejecutándose antes de continuar');
console.log('💡 Si usas XAMPP, inicia Apache y MySQL\n');

try {
  runCommand('npm run migrate', 'Ejecutando migraciones de base de datos');
} catch (error) {
  console.log('⚠️  Las migraciones fallaron. Esto puede ser normal si MySQL no está ejecutándose.');
  console.log('💡 Puedes ejecutar "npm run migrate" manualmente cuando MySQL esté disponible.\n');
}

console.log('🎉 ¡Configuración completada exitosamente!\n');

console.log('📋 Próximos pasos:');
console.log('1. Asegúrate de que MySQL esté ejecutándose (XAMPP recomendado)');
console.log('2. Si las migraciones no se ejecutaron, ejecuta: npm run migrate');
console.log('3. Inicia el proyecto en modo desarrollo: npm run dev');
console.log('4. Accede a http://localhost:3000 en tu navegador\n');

console.log('👤 Usuarios de prueba:');
console.log('   admin / admin123 (Administrador)');
console.log('   facturador1 / facturador123 (Facturador)');
console.log('   cartera1 / cartera123 (Cartera)');
console.log('   logistica1 / logistica123 (Logística)');
console.log('   mensajero1 / mensajero123 (Mensajero)\n');

console.log('🔗 URLs importantes:');
console.log('   Frontend: http://localhost:3000');
console.log('   Backend API: http://localhost:3001');
console.log('   API Health: http://localhost:3001/api/health\n');

console.log('✅ ¡Proyecto listo para desarrollo!');
