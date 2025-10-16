const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixInvoicePaymentCalculation() {
    console.log('🔧 Corrigiendo cálculo de pagos en facturas SIIGO...\n');
    
    try {
        // Leer el archivo actual
        const fs = require('fs').promises;
        const filePath = './backend/services/siigoInvoiceService.js';
        
        console.log('📄 Leyendo archivo actual...');
        let content = await fs.readFile(filePath, 'utf8');
        
        // Buscar el método calculateTotalsFromFormattedItems
        console.log('🔍 Buscando método de cálculo...');
        
        // Reemplazar el cálculo del IVA - NO incluir IVA en el total
        const oldCalculation = `  calculateTotalsFromFormattedItems(formattedItems) {
    const subtotal = formattedItems.reduce((sum, item) => {
      const quantity = parseFloat(item.quantity || 1);
      const price = parseFloat(item.price || 0);
      return sum + (quantity * price);
    }, 0);

    const taxRate = 0.19; // 19% IVA
    const tax = subtotal * taxRate;
    const total = subtotal + tax;

    return { subtotal, tax, total };
  }`;
        
        const newCalculation = `  calculateTotalsFromFormattedItems(formattedItems) {
    const subtotal = formattedItems.reduce((sum, item) => {
      const quantity = parseFloat(item.quantity || 1);
      const price = parseFloat(item.price || 0);
      return sum + (quantity * price);
    }, 0);

    // IMPORTANTE: SIIGO calcula el IVA internamente
    // NO incluir IVA en el total del pago - usar solo subtotal
    const taxRate = 0.19; // 19% IVA (solo referencia, no se usa para el pago)
    const tax = subtotal * taxRate;
    const total = subtotal; // Total sin IVA para el pago

    return { subtotal, tax, total };
  }`;
        
        if (content.includes(oldCalculation)) {
            content = content.replace(oldCalculation, newCalculation);
            console.log('✅ Método de cálculo actualizado');
        } else {
            console.log('⚠️ No se encontró el método exacto, buscando alternativa...');
            
            // Buscar patrón más general
            const regex = /calculateTotalsFromFormattedItems\(formattedItems\)\s*{[\s\S]*?return\s*{\s*subtotal,\s*tax,\s*total\s*};\s*}/;
            
            if (regex.test(content)) {
                content = content.replace(regex, newCalculation);
                console.log('✅ Método de cálculo actualizado (patrón alternativo)');
            } else {
                console.log('❌ No se pudo encontrar el método para actualizar');
                return;
            }
        }
        
        // Guardar el archivo actualizado
        console.log('💾 Guardando cambios...');
        await fs.writeFile(filePath, content, 'utf8');
        
        console.log('\n✅ Corrección aplicada exitosamente');
        console.log('\n📝 Cambios realizados:');
        console.log('   - El total del pago ahora será igual al subtotal (sin IVA)');
        console.log('   - SIIGO calculará el IVA internamente');
        console.log('   - Esto corrige el error "invalid_total_payments"');
        
        console.log('\n⚠️ IMPORTANTE: El backend necesita reiniciarse para aplicar los cambios');
        console.log('   Presiona Ctrl+C en la terminal del backend y ejecuta: node restart_backend_complete.js');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Ejecutar
fixInvoicePaymentCalculation();
