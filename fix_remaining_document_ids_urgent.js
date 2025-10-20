const fs = require('fs');
const path = require('path');

console.log('🚨 DIAGNÓSTICO URGENTE - Buscando IDs incorrectos');
console.log('='.repeat(60));

// Files to check
const criticalFiles = [
  'backend/services/siigoInvoiceService.js',
  'backend/controllers/quotationController.js', 
  'backend/services/chatgptService.js'
];

console.log('🔍 1. BUSCANDO DOCUMENT IDs INCORRECTOS...\n');

criticalFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`📁 Revisando: ${file}`);
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      // Looking for wrong document IDs
      if (line.includes('5153') || line.includes('15047')) {
        console.log(`❌ LÍNEA ${index + 1}: ${line.trim()}`);
      }
    });
    console.log();
  } else {
    console.log(`⚠️  Archivo no encontrado: ${file}\n`);
  }
});

console.log('🔍 2. BUSCANDO TAX IDs INCORRECTOS...\n');

criticalFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`📁 Revisando: ${file}`);
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      // Looking for wrong tax IDs
      if (line.includes('13156')) {
        console.log(`❌ LÍNEA ${index + 1}: ${line.trim()}`);
      }
    });
    console.log();
  }
});

console.log('🔍 3. BUSCANDO POSIBLES UNDEFINED PARAMS...\n');

criticalFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`📁 Revisando: ${file}`);
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      // Looking for potential undefined issues
      if (line.includes('INSERT INTO') && line.includes('?')) {
        console.log(`💾 LÍNEA ${index + 1}: ${line.trim()}`);
      }
    });
    console.log();
  }
});

console.log('✅ Diagnóstico completado');
