const fs = require('fs');

console.log('🔧 Corrigiendo IDs de documentos SIIGO para eliminar errores 400...\n');

// Archivos que necesitan corrección
const filesToFix = [
  {
    file: 'backend/services/siigoInvoiceService.js',
    changes: [
      {
        search: 'documentId: 15047, // FV-1 - Factura No Electrónica',
        replace: 'documentId: 5152, // FV-1 - Factura No Electrónica'
      }
    ]
  },
  {
    file: 'backend/controllers/quotationController.js',
    changes: [
      {
        search: "'FV-1': 5153, // Factura no electrónica",
        replace: "'FV-1': 5152, // Factura no electrónica"
      },
      {
        search: 'documentId: documentConfig[documentType] || 5153',
        replace: 'documentId: documentConfig[documentType] || 5152'
      }
    ]
  }
];

let totalFixed = 0;

filesToFix.forEach(({ file, changes }) => {
  console.log(`📖 Procesando ${file}...`);
  
  try {
    if (!fs.existsSync(file)) {
      console.log(`   ⚠️ Archivo no encontrado: ${file}`);
      return;
    }

    let content = fs.readFileSync(file, 'utf8');
    let fileChanged = false;

    changes.forEach(({ search, replace }) => {
      if (content.includes(search)) {
        content = content.replace(search, replace);
        console.log(`   ✅ Cambiado: ${search.substring(0, 50)}...`);
        fileChanged = true;
        totalFixed++;
      } else {
        console.log(`   ℹ️ No se encontró: ${search.substring(0, 50)}...`);
      }
    });

    if (fileChanged) {
      fs.writeFileSync(file, content, 'utf8');
      console.log(`   💾 Archivo actualizado exitosamente`);
    } else {
      console.log(`   ℹ️ No se realizaron cambios en este archivo`);
    }

  } catch (error) {
    console.error(`   ❌ Error procesando ${file}:`, error.message);
  }
  
  console.log('');
});

console.log(`🎯 Corrección completada:`);
console.log(`   • ${totalFixed} cambios realizados`);
console.log(`   • Document ID corregido de 15047/5153 → 5152`);
console.log(`   • Esto debería eliminar los errores 400 al crear facturas`);

if (totalFixed > 0) {
  console.log('\n📋 Próximos pasos recomendados:');
  console.log('   1. El backend se reiniciará automáticamente');
  console.log('   2. Probar creación de factura desde cotizaciones');
  console.log('   3. Verificar que no aparezcan más errores 400');
} else {
  console.log('\n⚠️ No se realizaron cambios. Es posible que ya estén corregidos.');
}
