const mysql = require('mysql2/promise');

// Configuración de base de datos
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'gestion_pedidos_dev'
};

async function debugPedidoSinAsignar() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('🔌 Conectado a la base de datos');

    // Buscar el pedido FV-2-12571
    const pedidoNumero = 'FV-2-12571';
    
    console.log(`🔍 Buscando pedido ${pedidoNumero}...`);
    
    const [pedidos] = await connection.execute(
      'SELECT * FROM orders WHERE invoice_code = ?',
      [pedidoNumero]
    );
    
    if (pedidos.length === 0) {
      console.log('❌ Pedido no encontrado');
      return;
    }
    
    const pedido = pedidos[0];
    console.log('\n📋 INFORMACIÓN DEL PEDIDO:');
    console.log('================================');
    console.log(`📄 Número: ${pedido.invoice_code}`);
    console.log(`🆔 ID: ${pedido.id}`);
    console.log(`📊 Estado: ${pedido.status}`);
    console.log(`👤 Cliente: ${pedido.customer_name || 'No especificado'}`);
    console.log(`💰 Total: $${pedido.total || 0}`);
    console.log(`📅 Fecha creación: ${pedido.created_at}`);
    console.log(`🔄 Última actualización: ${pedido.updated_at}`);
    console.log(`🚚 Método de entrega: ${pedido.delivery_method || 'No especificado'}`);
    console.log(`💳 Método de pago: ${pedido.payment_method || 'No especificado'}`);
    console.log(`📦 Fecha de envío: ${pedido.shipping_date || 'No programada'}`);
    console.log(`🏃 Mensajero asignado: ${pedido.assigned_messenger_id || 'SIN ASIGNAR'}`);
    console.log(`📍 Dirección: ${pedido.customer_address || 'No especificada'}`);
    console.log(`📞 Teléfono: ${pedido.customer_phone || 'No especificado'}`);
    console.log(`📝 Notas: ${pedido.notes || 'Sin notas'}`);

    // Verificar si tiene mensajero asignado
    if (pedido.assigned_messenger_id) {
      console.log('\n👥 INFORMACIÓN DEL MENSAJERO:');
      console.log('================================');
      
      const [mensajeros] = await connection.execute(
        'SELECT * FROM users WHERE id = ? AND role = "mensajero"',
        [pedido.assigned_messenger_id]
      );
      
      if (mensajeros.length > 0) {
        const mensajero = mensajeros[0];
        console.log(`👤 Nombre: ${mensajero.name}`);
        console.log(`📧 Email: ${mensajero.email}`);
        console.log(`✅ Activo: ${mensajero.active ? 'Sí' : 'No'}`);
      } else {
        console.log('⚠️  Mensajero no encontrado o no es mensajero válido');
      }
    }

    // Verificar los mensajeros disponibles
    console.log('\n🚚 MENSAJEROS DISPONIBLES:');
    console.log('================================');
    
    const [mensajerosDisponibles] = await connection.execute(
      'SELECT id, name, email, active FROM users WHERE role = "mensajero" ORDER BY active DESC, name'
    );
    
    if (mensajerosDisponibles.length === 0) {
      console.log('❌ No hay mensajeros registrados');
    } else {
      mensajerosDisponibles.forEach(mensajero => {
        console.log(`${mensajero.active ? '✅' : '❌'} ID: ${mensajero.id} - ${mensajero.name} (${mensajero.email})`);
      });
    }

    // Analizar por qué está sin asignar
    console.log('\n🔍 ANÁLISIS DEL PROBLEMA:');
    console.log('================================');
    
    if (!pedido.assigned_messenger_id) {
      console.log('🔸 El pedido NO tiene mensajero asignado');
      
      if (pedido.status === 'listo_para_entrega') {
        console.log('🔸 El pedido está LISTO PARA ENTREGA pero sin mensajero');
        console.log('🔸 SOLUCIÓN: Asignar un mensajero desde el frontend');
      } else if (pedido.status === 'en_logistica') {
        console.log('🔸 El pedido está EN LOGÍSTICA pero sin mensajero');
        console.log('🔸 SOLUCIÓN: Completar el proceso de logística y asignar mensajero');
      } else {
        console.log(`🔸 El pedido está en estado: ${pedido.status}`);
        console.log('🔸 Puede necesitar avanzar en el flujo antes de asignar mensajero');
      }
    } else {
      console.log('🔸 El pedido SÍ tiene mensajero asignado');
      console.log('🔸 Verificar si el mensajero está activo o si hay otro problema');
    }

    // Verificar métodos de entrega
    if (pedido.delivery_method === 'recoge_bodega') {
      console.log('🔸 MÉTODO DE ENTREGA: Recoge en bodega');
      console.log('🔸 Este tipo de pedido no necesita mensajero necesariamente');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Conexión cerrada');
    }
  }
}

debugPedidoSinAsignar();
