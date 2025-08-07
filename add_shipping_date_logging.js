const fs = require('fs');
const path = require('path');

// Función para agregar logging detallado al orderController.js
function addShippingDateLogging() {
  console.log('🔧 Agregando logging detallado para shipping_date al orderController.js');
  console.log('=' .repeat(80));
  
  const controllerPath = path.join(__dirname, 'backend', 'controllers', 'orderController.js');
  
  if (!fs.existsSync(controllerPath)) {
    console.error('❌ Error: No se encontró orderController.js');
    return false;
  }
  
  // Leer el archivo actual
  let content = fs.readFileSync(controllerPath, 'utf8');
  
  // Buscar la función updateOrder y agregar logging
  const updateOrderRegex = /\/\/ Actualizar pedido\s*const updateOrder = async \(req, res\) => \{[\s\S]*?try \{/;
  
  if (updateOrderRegex.test(content)) {
    console.log('✅ Función updateOrder encontrada');
    
    // Agregar logging detallado al inicio de updateOrder
    const loggingCode = `
// Actualizar pedido
const updateOrder = async (req, res) => {
  try {
    // 🔍 LOGGING DETALLADO PARA SHIPPING_DATE - INICIO
    console.log('\\n' + '='.repeat(80));
    console.log('🔍 ORDER UPDATE REQUEST - SHIPPING_DATE LOGGING');
    console.log('='.repeat(80));
    console.log('⏰ Timestamp:', new Date().toISOString());
    console.log('👤 User:', req.user?.username || 'unknown');
    console.log('🆔 User Role:', req.user?.role || 'unknown');
    console.log('');
    
    // Log de parámetros de la request
    console.log('📝 REQUEST PARAMETERS:');
    console.log('   Order ID:', req.validatedParams?.id || req.params?.id || 'MISSING');
    console.log('');
    
    // Log detallado del body de la request
    console.log('📦 REQUEST BODY (RAW):');
    console.log('   Body keys:', Object.keys(req.body || {}));
    console.log('   Body content:', JSON.stringify(req.body, null, 2));
    console.log('');
    
    // Log específico para campos críticos
    console.log('🔍 CRITICAL FIELDS ANALYSIS:');
    console.log('   ✅ payment_method:', req.body?.payment_method || 'MISSING');
    console.log('   🚨 shipping_date:', req.body?.shipping_date || 'MISSING');
    console.log('   📝 notes:', req.body?.notes || 'MISSING');
    console.log('   🎯 action:', req.body?.action || 'MISSING');
    console.log('   🆔 orderId:', req.body?.orderId || 'MISSING');
    console.log('');
    
    // Verificar si shipping_date está presente
    if (req.body?.shipping_date) {
      console.log('✅ SHIPPING_DATE FOUND IN REQUEST:');
      console.log('   Value:', req.body.shipping_date);
      console.log('   Type:', typeof req.body.shipping_date);
      console.log('   Length:', req.body.shipping_date.length);
      console.log('   Is valid date?', !isNaN(Date.parse(req.body.shipping_date)));
    } else {
      console.log('🚨 WARNING: SHIPPING_DATE NOT FOUND IN REQUEST BODY');
      console.log('   This may be the source of the problem!');
    }
    console.log('');
    
    // Log de validatedData si existe
    if (req.validatedData) {
      console.log('✅ VALIDATED DATA:');
      console.log('   Keys:', Object.keys(req.validatedData));
      console.log('   shipping_date in validated:', req.validatedData.shipping_date || 'MISSING');
      console.log('   Content:', JSON.stringify(req.validatedData, null, 2));
    } else {
      console.log('⚠️  No validated data found');
    }
    console.log('');
    // 🔍 LOGGING DETALLADO PARA SHIPPING_DATE - FIN
    
    const { id } = req.validatedParams;
    const updateData = req.validatedData;`;
    
    // Reemplazar el inicio de la función
    content = content.replace(
      /\/\/ Actualizar pedido\s*const updateOrder = async \(req, res\) => \{\s*try \{\s*const \{ id \} = req\.validatedParams;\s*const updateData = req\.validatedData;/,
      loggingCode
    );
    
    // Agregar logging en el mapeo de campos
    const mappingLoggingCode = `
      // 🔍 FIELD MAPPING LOGGING - INICIO
      console.log('🔧 FIELD MAPPING PROCESS:');
      console.log('   Processing', Object.keys(updateData).length, 'fields');
      console.log('');
      
      Object.keys(updateData).forEach(key => {
        if (!['items'].includes(key)) {
          const dbField = key === 'customerName' ? 'customer_name' :
                         key === 'customerPhone' ? 'customer_phone' :
                         key === 'customerAddress' ? 'customer_address' :
                         key === 'customerEmail' ? 'customer_email' :
                         key === 'deliveryDate' ? 'delivery_date' :
                         key === 'shippingDate' ? 'shipping_date' : key;
          
          console.log('   🔧 Mapping:', key, '->', dbField, '=', '"' + updateData[key] + '"');
          
          // Especial atención a shipping_date
          if (key === 'shipping_date' || key === 'shippingDate') {
            console.log('   🚨 SHIPPING_DATE FIELD DETECTED:');
            console.log('      Original key:', key);
            console.log('      Mapped to:', dbField);
            console.log('      Value:', updateData[key]);
            console.log('      Will be included in UPDATE:', true);
          }
          
          updateFields.push(\`\${dbField} = ?\`);
          updateValues.push(updateData[key]);
        }
      });
      
      console.log('');
      console.log('📊 FINAL UPDATE ARRAYS:');
      console.log('   Update fields:', updateFields);
      console.log('   Update values:', updateValues);
      console.log('');
      
      // Verificar si shipping_date está en los campos finales
      const shippingFieldIndex = updateFields.findIndex(field => field.includes('shipping_date'));
      if (shippingFieldIndex >= 0) {
        console.log('✅ SHIPPING_DATE IN FINAL UPDATE:');
        console.log('   Field:', updateFields[shippingFieldIndex]);
        console.log('   Value:', updateValues[shippingFieldIndex]);
        console.log('   Index:', shippingFieldIndex);
      } else {
        console.log('🚨 ERROR: SHIPPING_DATE NOT IN FINAL UPDATE ARRAYS');
        console.log('   This explains why the date is not being saved!');
      }
      console.log('');
      // 🔍 FIELD MAPPING LOGGING - FIN
`;
    
    // Buscar donde está el mapeo de campos y agregar logging
    content = content.replace(
      /Object\.keys\(updateData\)\.forEach\(key => \{\s*if \(key !== 'items' && updateData\[key\] !== undefined\) \{/,
      `${mappingLoggingCode}
      
      Object.keys(updateData).forEach(key => {
        if (key !== 'items' && updateData[key] !== undefined) {`
    );
    
    // Agregar logging antes de la ejecución de la query
    const queryLoggingCode = `
      // 🔍 SQL EXECUTION LOGGING - INICIO
      console.log('🔧 EXECUTING SQL UPDATE:');
      console.log('   Query:', \`UPDATE orders SET \${updateFields.join(', ')} WHERE id = ?\`);
      console.log('   Values:', updateValues);
      console.log('   Order ID:', id);
      console.log('');
      
      // Verificación final de shipping_date
      const finalShippingIndex = updateFields.findIndex(f => f.includes('shipping_date'));
      if (finalShippingIndex >= 0) {
        console.log('✅ FINAL SHIPPING_DATE CHECK:');
        console.log('   SQL field:', updateFields[finalShippingIndex]);
        console.log('   SQL value:', updateValues[finalShippingIndex]);
      } else {
        console.log('🚨 FINAL WARNING: NO SHIPPING_DATE IN SQL');
      }
      console.log('');
      // 🔍 SQL EXECUTION LOGGING - FIN
      `;
    
    // Agregar logging antes de la ejecución SQL
    content = content.replace(
      /await connection\.execute\(\s*\`UPDATE orders SET \$\{updateFields\.join\(', '\)\} WHERE id = \?\`,\s*updateValues\s*\);/,
      `${queryLoggingCode}
        
        const updateResult = await connection.execute(
          \`UPDATE orders SET \${updateFields.join(', ')} WHERE id = ?\`,
          updateValues
        );
        
        // 🔍 UPDATE RESULT LOGGING
        console.log('📊 UPDATE RESULT:');
        console.log('   Affected rows:', updateResult.affectedRows);
        console.log('   Changed rows:', updateResult.changedRows);
        console.log('   Warnings:', updateResult.warningCount);
        console.log('');`
    );
    
    // Agregar logging al final de la función
    const finalLoggingCode = `
    // 🔍 FINAL VERIFICATION LOGGING
    console.log('🔍 FINAL ORDER VERIFICATION:');
    const [verificationResult] = await query(
      'SELECT id, order_number, shipping_date, payment_method, status, updated_at FROM orders WHERE id = ?',
      [id]
    );
    
    if (verificationResult.length > 0) {
      const finalOrder = verificationResult[0];
      console.log('   Order:', finalOrder.order_number);
      console.log('   Status:', finalOrder.status);
      console.log('   Payment Method:', finalOrder.payment_method);
      console.log('   🚨 Shipping Date:', finalOrder.shipping_date || 'NULL');
      console.log('   Updated At:', finalOrder.updated_at);
      
      if (finalOrder.shipping_date) {
        console.log('✅ SUCCESS: Shipping date was saved successfully!');
      } else {
        console.log('🚨 PROBLEM: Shipping date is still NULL after update!');
      }
    }
    
    console.log('='.repeat(80));
    console.log('🔍 ORDER UPDATE LOGGING COMPLETE');
    console.log('='.repeat(80) + '\\n');
    `;
    
    // Agregar el logging final justo antes del response exitoso
    content = content.replace(
      /res\.json\(\{\s*success: true,\s*message: 'Pedido actualizado exitosamente',\s*data: updatedOrder\[0\]\s*\}\);/,
      `${finalLoggingCode}
      
      res.json({
        success: true,
        message: 'Pedido actualizado exitosamente',
        data: updatedOrder[0]
      });`
    );
    
    // Escribir el archivo modificado
    fs.writeFileSync(controllerPath, content, 'utf8');
    
    console.log('✅ Logging agregado exitosamente al orderController.js');
    console.log('');
    console.log('📋 LOGGING FEATURES AGREGADAS:');
    console.log('   • Request body completo');
    console.log('   • Análisis de campos críticos');
    console.log('   • Verificación de shipping_date en request');
    console.log('   • Mapeo de campos paso a paso');
    console.log('   • Query SQL final');
    console.log('   • Verificación post-update');
    console.log('');
    console.log('🔧 PRÓXIMOS PASOS:');
    console.log('   1. Reiniciar el backend: npm start');
    console.log('   2. Abrir terminal/consola del backend');
    console.log('   3. Intentar procesar un pedido en el modal');
    console.log('   4. Revisar los logs detallados en la consola');
    console.log('');
    
    return true;
  } else {
    console.error('❌ Error: No se pudo encontrar la función updateOrder');
    return false;
  }
}

// Ejecutar
if (addShippingDateLogging()) {
  console.log('✅ Sistema de logging listo para debugging');
} else {
  console.log('❌ Error configurando el logging');
}
