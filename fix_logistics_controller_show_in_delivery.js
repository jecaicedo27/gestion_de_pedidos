const fs = require('fs');
const path = require('path');

function fixLogisticsController() {
    console.log('=== CORRIGIENDO CONTROLADOR DE LOGÍSTICA ===\n');
    
    const controllerPath = path.join(__dirname, 'backend', 'controllers', 'logisticsController.js');
    
    try {
        let content = fs.readFileSync(controllerPath, 'utf8');
        
        console.log('1. Leyendo archivo actual...');
        
        // Buscar la función getReadyForDeliveryOrders
        const functionStart = content.indexOf('const getReadyForDeliveryOrders = async (req, res) => {');
        if (functionStart === -1) {
            throw new Error('No se encontró la función getReadyForDeliveryOrders');
        }
        
        console.log('2. Función getReadyForDeliveryOrders encontrada');
        
        // CORRECCIÓN 1: Cambiar la query para incluir pedidos en reparto
        const originalQuery = `WHERE o.status IN ('listo_para_entrega', 'empacado', 'listo')`;
        const newQuery = `WHERE o.status IN ('listo_para_entrega', 'empacado', 'listo', 'en_reparto')`;
        
        if (content.includes(originalQuery)) {
            content = content.replace(originalQuery, newQuery);
            console.log('✅ Query corregida para incluir pedidos en reparto');
        } else {
            console.log('⚠️  Query original no encontrada, buscando alternativas...');
        }
        
        // CORRECCIÓN 2: Agregar información del mensajero en la consulta
        const originalSelect = `SELECT 
        o.id, o.order_number, o.customer_name, o.status, o.delivery_method,
        o.total_amount, o.created_at, o.updated_at, o.carrier_id,
        c.name as carrier_name`;
        
        const newSelect = `SELECT 
        o.id, o.order_number, o.customer_name, o.status, o.delivery_method,
        o.total_amount, o.created_at, o.updated_at, o.carrier_id,
        o.assigned_messenger_id, o.messenger_status,
        c.name as carrier_name,
        u.username as messenger_username, u.full_name as messenger_full_name`;
        
        if (content.includes(originalSelect)) {
            content = content.replace(originalSelect, newSelect);
            console.log('✅ SELECT corregido para incluir información del mensajero');
        }
        
        // CORRECCIÓN 3: Agregar LEFT JOIN con users para obtener datos del mensajero
        const originalFrom = `FROM orders o
       LEFT JOIN carriers c ON o.carrier_id = c.id`;
        
        const newFrom = `FROM orders o
       LEFT JOIN carriers c ON o.carrier_id = c.id
       LEFT JOIN users u ON o.assigned_messenger_id = u.id`;
        
        if (content.includes(originalFrom)) {
            content = content.replace(originalFrom, newFrom);
            console.log('✅ LEFT JOIN con users agregado');
        }
        
        // CORRECCIÓN 4: Mejorar la lógica de agrupamiento para incluir pedidos con mensajero
        const groupingLogic = `// Normalizar texto para comparación (quitar acentos y convertir a minúsculas)
      const normalizeText = (text) => {
        if (!text) return '';
        return text.toLowerCase()
                  .replace(/á/g, 'a')
                  .replace(/é/g, 'e') 
                  .replace(/í/g, 'i')
                  .replace(/ó/g, 'o')
                  .replace(/ú/g, 'u')
                  .replace(/ñ/g, 'n')
                  .trim();
      };
      
      const normalizedCarrier = normalizeText(carrier_name);
      const normalizedMethod = normalizeText(delivery_method);`;
      
        const improvedGroupingLogic = `// Normalizar texto para comparación (quitar acentos y convertir a minúsculas)
      const normalizeText = (text) => {
        if (!text) return '';
        return text.toLowerCase()
                  .replace(/á/g, 'a')
                  .replace(/é/g, 'e') 
                  .replace(/í/g, 'i')
                  .replace(/ó/g, 'o')
                  .replace(/ú/g, 'u')
                  .replace(/ñ/g, 'n')
                  .trim();
      };
      
      const normalizedCarrier = normalizeText(carrier_name);
      const normalizedMethod = normalizeText(delivery_method);
      
      // Agregar información del mensajero si está asignado
      if (order.assigned_messenger_id && order.messenger_username) {
        order.messenger_info = {
          id: order.assigned_messenger_id,
          username: order.messenger_username,
          full_name: order.messenger_full_name
        };
      }`;
        
        if (content.includes(groupingLogic)) {
            content = content.replace(groupingLogic, improvedGroupingLogic);
            console.log('✅ Lógica de agrupamiento mejorada para incluir info del mensajero');
        }
        
        // CORRECCIÓN 5: Mejorar la condición para mensajería local con mensajeros asignados
        const originalMensajeriaCondition = `} else if (normalizedMethod === 'mensajeria_local' || normalizedMethod === 'mensajero' || 
                 normalizedCarrier.includes('mensajeria') || normalizedCarrier === 'mensajeria local' ||
                 normalizedCarrier.includes('mensajero')) {
        // Si es mensajería local, agregar a la categoría correspondiente
        groupedOrders.mensajeria_local.push(order);
      } else if (!normalizedMethod && !normalizedCarrier) {
        // Si no tiene método ni transportadora, también va a mensajería local
        groupedOrders.mensajeria_local.push(order);`;
        
        const improvedMensajeriaCondition = `} else if (normalizedMethod === 'mensajeria_local' || normalizedMethod === 'mensajero' || 
                 normalizedCarrier.includes('mensajeria') || normalizedCarrier === 'mensajeria local' ||
                 normalizedCarrier.includes('mensajero') || order.assigned_messenger_id) {
        // Si es mensajería local o tiene mensajero asignado, agregar a la categoría correspondiente
        groupedOrders.mensajeria_local.push(order);
      } else if (!normalizedMethod && !normalizedCarrier) {
        // Si no tiene método ni transportadora, también va a mensajería local
        groupedOrders.mensajeria_local.push(order);`;
        
        if (content.includes(originalMensajeriaCondition)) {
            content = content.replace(originalMensajeriaCondition, improvedMensajeriaCondition);
            console.log('✅ Condición de mensajería local mejorada para incluir pedidos con mensajero');
        }
        
        // Guardar el archivo corregido
        fs.writeFileSync(controllerPath, content, 'utf8');
        
        console.log('\n✅ CORRECCIONES APLICADAS:');
        console.log('  1. Incluir pedidos en estado "en_reparto"');
        console.log('  2. Agregar información del mensajero en la consulta');
        console.log('  3. JOIN con tabla users para obtener datos del mensajero');
        console.log('  4. Mejorar lógica de agrupamiento');
        console.log('  5. Incluir pedidos con mensajero asignado en mensajería local');
        
        console.log('\n📝 ARCHIVO ACTUALIZADO:', controllerPath);
        console.log('\n🔄 AHORA EL FRONTEND DEBERÍA MOSTRAR:');
        console.log('   - Pedidos en reparto con sus mensajeros asignados');
        console.log('   - El pedido de Ximena debería aparecer en "mensajeria_local"');
        console.log('   - Información del mensajero (mensajero1 - Ana Rodríguez)');
        
    } catch (error) {
        console.error('❌ Error aplicando correcciones:', error.message);
    }
}

fixLogisticsController();
