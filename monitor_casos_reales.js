const mysql = require('./backend/node_modules/mysql2/promise');
const axios = require('./backend/node_modules/axios');
const colors = require('./backend/node_modules/colors');
require('./backend/node_modules/dotenv').config({ path: './backend/.env' });

// Configuración
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gestion_pedidos_dev'
};

const API_BASE_URL = 'http://localhost:3001/api';

class MonitorCasosReales {
  constructor() {
    this.connection = null;
    this.currentOrder = null;
    this.logs = [];
  }

  // Conectar a la base de datos
  async connect() {
    try {
      this.connection = await mysql.createConnection(dbConfig);
      console.log('✅ Conectado a la base de datos'.green);
      return true;
    } catch (error) {
      console.error('❌ Error conectando a BD:'.red, error.message);
      return false;
    }
  }

  // Obtener pedidos reales de SIIGO
  async getPedidosReales() {
    try {
      const [orders] = await this.connection.execute(`
        SELECT 
          o.id,
          o.order_number,
          o.invoice_code,
          o.customer_name,
          o.customer_phone,
          o.status,
          o.total_amount,
          o.siigo_invoice_number,
          o.order_source,
          o.created_at,
          COUNT(oi.id) as items_count
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.order_source = 'siigo_automatic'
        GROUP BY o.id
        ORDER BY o.created_at DESC
        LIMIT 20
      `);
      
      console.log(`\n📋 Encontrados ${orders.length} pedidos reales de SIIGO`.cyan);
      return orders;
    } catch (error) {
      console.error('❌ Error obteniendo pedidos:'.red, error.message);
      return [];
    }
  }

  // Mostrar detalles del pedido
  async showOrderDetails(orderId) {
    try {
      // Datos del pedido
      const [orderData] = await this.connection.execute(
        'SELECT * FROM orders WHERE id = ?',
        [orderId]
      );
      
      // Items del pedido
      const [items] = await this.connection.execute(
        'SELECT * FROM order_items WHERE order_id = ?',
        [orderId]
      );
      
      const order = orderData[0];
      this.currentOrder = order;
      
      console.log('\n========================================'.yellow);
      console.log('📦 DETALLES DEL PEDIDO'.yellow.bold);
      console.log('========================================'.yellow);
      console.log(`ID: ${order.id}`.white);
      console.log(`Número: ${order.order_number}`.white);
      console.log(`Factura SIIGO: ${order.siigo_invoice_number || 'N/A'}`.white);
      console.log(`Cliente: ${order.customer_name}`.white);
      console.log(`Teléfono: ${order.customer_phone}`.white);
      console.log(`Estado: ${order.status}`.cyan);
      console.log(`Total: $${order.total_amount}`.green);
      console.log(`Método Pago: ${order.payment_method || 'N/A'}`.white);
      console.log(`Método Entrega: ${order.delivery_method || 'N/A'}`.white);
      console.log(`Fecha Envío: ${order.shipping_date || 'N/A'}`.white);
      
      if (items.length > 0) {
        console.log('\n📝 ITEMS DEL PEDIDO:'.cyan);
        items.forEach(item => {
          console.log(`  - ${item.name} x${item.quantity} = $${item.price}`.gray);
        });
      }
      
      console.log('========================================'.yellow);
      
      return { order, items };
    } catch (error) {
      console.error('❌ Error mostrando detalles:'.red, error.message);
      return null;
    }
  }

  // Verificar funcionalidad específica
  async testFunctionality(functionality, orderId) {
    console.log(`\n🔍 Probando: ${functionality}`.magenta);
    
    try {
      switch (functionality) {
        case 'view':
          // Probar visualización en API
          const viewResponse = await axios.get(`${API_BASE_URL}/orders/${orderId}`);
          console.log('✅ Vista API funcionando'.green);
          this.log('success', 'view', 'Vista API OK');
          break;
          
        case 'edit':
          // Probar edición
          const editData = {
            notes: `Prueba de edición - ${new Date().toISOString()}`
          };
          const editResponse = await axios.put(`${API_BASE_URL}/orders/${orderId}`, editData);
          console.log('✅ Edición funcionando'.green);
          this.log('success', 'edit', 'Edición OK');
          break;
          
        case 'status':
          // Probar cambio de estado
          const newStatus = 'confirmado';
          const statusResponse = await axios.put(`${API_BASE_URL}/orders/${orderId}/status`, {
            status: newStatus
          });
          console.log(`✅ Cambio de estado a "${newStatus}" funcionando`.green);
          this.log('success', 'status', `Estado cambiado a ${newStatus}`);
          break;
          
        case 'packaging':
          // Probar empaque
          const packagingResponse = await axios.post(`${API_BASE_URL}/packaging/${orderId}/start`);
          console.log('✅ Inicio de empaque funcionando'.green);
          this.log('success', 'packaging', 'Empaque iniciado');
          break;
          
        case 'pdf':
          // Probar generación de PDF
          const pdfResponse = await axios.get(`${API_BASE_URL}/pdf/invoice/${orderId}`);
          console.log('✅ Generación de PDF funcionando'.green);
          this.log('success', 'pdf', 'PDF generado');
          break;
          
        default:
          console.log('⚠️  Funcionalidad no reconocida'.yellow);
      }
    } catch (error) {
      console.error(`❌ Error en ${functionality}:`.red, error.response?.data || error.message);
      this.log('error', functionality, error.response?.data?.message || error.message);
      
      // Información adicional de debug
      if (error.response) {
        console.log('Status:', error.response.status);
        console.log('Headers:', error.response.headers);
      }
    }
  }

  // Registrar log
  log(type, functionality, message) {
    this.logs.push({
      timestamp: new Date(),
      type,
      functionality,
      message,
      orderId: this.currentOrder?.id,
      orderNumber: this.currentOrder?.order_number
    });
  }

  // Mostrar resumen
  showSummary() {
    console.log('\n========================================'.blue);
    console.log('📊 RESUMEN DE PRUEBAS'.blue.bold);
    console.log('========================================'.blue);
    
    const successes = this.logs.filter(l => l.type === 'success').length;
    const errors = this.logs.filter(l => l.type === 'error').length;
    
    console.log(`✅ Exitosas: ${successes}`.green);
    console.log(`❌ Errores: ${errors}`.red);
    
    if (errors > 0) {
      console.log('\n❌ ERRORES ENCONTRADOS:'.red);
      this.logs.filter(l => l.type === 'error').forEach(log => {
        console.log(`  - ${log.functionality} (Pedido ${log.orderNumber}): ${log.message}`.red);
      });
    }
  }

  // Cerrar conexión
  async close() {
    if (this.connection) {
      await this.connection.end();
      console.log('\n🔌 Conexión cerrada'.gray);
    }
  }
}

// Función principal
async function main() {
  const monitor = new MonitorCasosReales();
  
  console.log('🚀 MONITOR DE CASOS REALES - PERLAS EXPLOSIVAS'.cyan.bold);
  console.log('==========================================='.cyan);
  
  // Conectar
  if (!await monitor.connect()) {
    return;
  }
  
  // Obtener pedidos
  const pedidos = await monitor.getPedidosReales();
  
  if (pedidos.length === 0) {
    console.log('No se encontraron pedidos de SIIGO'.yellow);
    await monitor.close();
    return;
  }
  
  // Mostrar lista de pedidos
  console.log('\n📋 PEDIDOS DISPONIBLES PARA PROBAR:'.cyan);
  pedidos.forEach((p, index) => {
    console.log(`${index + 1}. ${p.order_number} - ${p.customer_name} - $${p.total_amount} - ${p.status}`.white);
  });
  
  console.log('\n💡 USO:'.yellow);
  console.log('1. El sistema mostrará cada pedido'.gray);
  console.log('2. Indique qué funcionalidad desea probar'.gray);
  console.log('3. El monitor detectará errores automáticamente'.gray);
  console.log('4. Presione Ctrl+C para salir'.gray);
  
  // Ejemplo: Probar primer pedido
  const primerPedido = pedidos[0];
  await monitor.showOrderDetails(primerPedido.id);
  
  console.log('\n🔧 FUNCIONALIDADES DISPONIBLES:'.cyan);
  console.log('- view: Ver pedido por API'.gray);
  console.log('- edit: Editar pedido'.gray);
  console.log('- status: Cambiar estado'.gray);
  console.log('- packaging: Iniciar empaque'.gray);
  console.log('- pdf: Generar PDF'.gray);
  
  // Mantener el monitor activo
  console.log('\n⏳ Monitor activo. Esperando instrucciones...'.yellow);
  
  // Manejar cierre
  process.on('SIGINT', async () => {
    monitor.showSummary();
    await monitor.close();
    process.exit(0);
  });
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { MonitorCasosReales };
