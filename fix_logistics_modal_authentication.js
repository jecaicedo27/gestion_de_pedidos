const fs = require('fs');
const path = require('path');

console.log('🔧 ARREGLANDO AUTENTICACIÓN EN LOGISTICS MODAL');
console.log('=================================================\n');

const logisticsModalPath = path.join(__dirname, 'frontend/src/components/LogisticsModal.js');

console.log('📄 Leyendo LogisticsModal.js...');

let content = fs.readFileSync(logisticsModalPath, 'utf8');

console.log('🔄 Aplicando correcciones...');

// 1. Agregar import del hook useAuth
if (!content.includes("import { useAuth }")) {
  content = content.replace(
    "import * as Icons from 'lucide-react';",
    "import * as Icons from 'lucide-react';\nimport { useAuth } from '../context/AuthContext';"
  );
  console.log('✅ Import de useAuth agregado');
}

// 2. Reemplazar las llamadas que usan localStorage.getItem('token') por el token del contexto
const logisticsModalFunction = content.match(/const LogisticsModal = \([^)]+\) => \{/);
if (logisticsModalFunction) {
  // Agregar el hook useAuth al inicio de la función
  if (!content.includes('const { token } = useAuth();')) {
    content = content.replace(
      /const LogisticsModal = \([^)]+\) => \{\s*const \[formData, setFormData\]/,
      `const LogisticsModal = ({ isOpen, onClose, order, onProcess }) => {
  const { token } = useAuth();
  const [formData, setFormData]`
    );
    console.log('✅ Hook useAuth agregado al componente');
  }
}

// 3. Reemplazar todas las instancias de localStorage.getItem('token') por el token del contexto
content = content.replace(
  /localStorage\.getItem\('token'\)/g,
  'token'
);
console.log('✅ Referencias a localStorage.getItem("token") reemplazadas por token del contexto');

// 4. Agregar verificación de token antes de hacer las llamadas
content = content.replace(
  /const fetchCarriers = async \(\) => \{\s*try \{/,
  `const fetchCarriers = async () => {
    if (!token) {
      console.warn('No hay token disponible para cargar transportadoras');
      return;
    }
    try {`
);

content = content.replace(
  /const fetchMessengers = async \(\) => \{\s*try \{\s*setLoadingMessengers\(true\);/,
  `const fetchMessengers = async () => {
    if (!token) {
      console.warn('No hay token disponible para cargar mensajeros');
      setLoadingMessengers(false);
      return;
    }
    try {
      setLoadingMessengers(true);`
);

console.log('✅ Verificaciones de token agregadas');

// 5. Escribir el archivo corregido
fs.writeFileSync(logisticsModalPath, content);

console.log('\n🎉 CORRECCIONES APLICADAS EXITOSAMENTE');
console.log('📋 Resumen de cambios:');
console.log('   - ✅ Import de useAuth agregado');
console.log('   - ✅ Hook useAuth agregado al componente');
console.log('   - ✅ Referencias a localStorage reemplazadas por token del contexto');
console.log('   - ✅ Verificaciones de token agregadas');
console.log('\n💡 Ahora el LogisticsModal usará correctamente la autenticación del contexto');
console.log('🔄 Recarga la página en el navegador para ver los cambios');
