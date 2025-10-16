const { query } = require('../backend/config/database');

const createSampleOrders = async () => {
  try {
    console.log('✅ Conectado a la base de datos');
    console.log('🔄 Creando pedidos de ejemplo...');

    // Datos de ejemplo para pedidos
    const sampleOrders = [
      {
        order_number: 'ORD-2025-001',
        customer_name: 'María García',
        customer_phone: '3001234567',
        customer_email: 'maria.garcia@email.com',
        customer_address: 'Calle 123 #45-67, Bogotá',
        total_amount: 150000,
        status: 'pendiente_facturacion',
        delivery_method: 'domicilio_ciudad',
        payment_method: 'efectivo',
        shipping_payment_method: 'contraentrega',
        notes: 'Entregar en horario de oficina'
      },
      {
        order_number: 'ORD-2025-002',
        customer_name: 'Carlos Rodríguez',
        customer_phone: '3109876543',
        customer_email: 'carlos.rodriguez@email.com',
        customer_address: 'Carrera 50 #30-20, Medellín',
        total_amount: 280000,
        status: 'pendiente_facturacion',
        delivery_method: 'envio_nacional',
        payment_method: 'transferencia',
        shipping_payment_method: 'contado',
        notes: 'Cliente prefiere entrega en la mañana'
      },
      {
        order_number: 'ORD-2025-003',
        customer_name: 'Ana López',
        customer_phone: '3157654321',
        customer_email: 'ana.lopez@email.com',
        customer_address: 'Avenida 80 #25-15, Cali',
        total_amount: 95000,
        status: 'pendiente_facturacion',
        delivery_method: 'recogida_tienda',
        payment_method: 'tarjeta_credito',
        shipping_payment_method: 'contado',
        notes: 'Recogerá el viernes por la tarde'
      },
      {
        order_number: 'ORD-2025-004',
        customer_name: 'Pedro Martínez',
        customer_phone: '3201112233',
        customer_email: 'pedro.martinez@email.com',
        customer_address: 'Calle 72 #11-35, Barranquilla',
        total_amount: 320000,
        status: 'revision_cartera',
        delivery_method: 'domicilio_ciudad',
        payment_method: 'pago_electronico',
        shipping_payment_method: 'contado',
        notes: 'Pago realizado por PSE'
      },
      {
        order_number: 'ORD-2025-005',
        customer_name: 'Laura Sánchez',
        customer_phone: '3134445566',
        customer_email: 'laura.sanchez@email.com',
        customer_address: 'Transversal 15 #40-25, Bucaramanga',
        total_amount: 180000,
        status: 'en_logistica',
        delivery_method: 'envio_nacional',
        payment_method: 'efectivo',
        shipping_payment_method: 'contraentrega',
        notes: 'Envío urgente'
      },
      {
        order_number: 'ORD-2025-006',
        customer_name: 'Roberto Silva',
        customer_phone: '3187778899',
        customer_email: 'roberto.silva@email.com',
        customer_address: 'Diagonal 25 #18-42, Pereira',
        total_amount: 75000,
        status: 'en_reparto',
        delivery_method: 'domicilio_ciudad',
        payment_method: 'efectivo',
        shipping_payment_method: 'contraentrega',
        notes: 'Llamar antes de llegar'
      }
    ];

    // Obtener el ID del usuario admin para asignar como creador
    const adminUser = await query('SELECT id FROM users WHERE username = ? LIMIT 1', ['admin']);
    const createdBy = adminUser.length > 0 ? adminUser[0].id : 1;

    // Insertar pedidos
    for (const order of sampleOrders) {
      const result = await query(`
        INSERT INTO orders (
          order_number, customer_name, customer_phone, customer_email, 
          customer_address, total_amount, status, delivery_method, 
          payment_method, shipping_payment_method, notes, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [
        order.order_number,
        order.customer_name,
        order.customer_phone,
        order.customer_email,
        order.customer_address,
        order.total_amount,
        order.status,
        order.delivery_method,
        order.payment_method,
        order.shipping_payment_method,
        order.notes,
        createdBy
      ]);

      console.log(`✅ Pedido creado: ${order.order_number} - ${order.customer_name} (${order.status})`);
    }

    // Mostrar resumen
    const orderStats = await query(`
      SELECT 
        status,
        COUNT(*) as count,
        CASE 
          WHEN status = 'pendiente_facturacion' THEN 'Pendiente por Facturación'
          WHEN status = 'revision_cartera' THEN 'Revisión por Cartera'
          WHEN status = 'en_logistica' THEN 'En Logística'
          WHEN status = 'en_reparto' THEN 'En Reparto'
          WHEN status = 'entregado_transportadora' THEN 'Entregado a Transportadora'
          WHEN status = 'entregado_cliente' THEN 'Entregado a Cliente'
          WHEN status = 'cancelado' THEN 'Cancelado'
          ELSE status
        END as label
      FROM orders 
      GROUP BY status 
      ORDER BY count DESC
    `);

    console.log('\n📊 Resumen de pedidos creados:');
    orderStats.forEach(stat => {
      console.log(`   - ${stat.label}: ${stat.count} pedidos`);
    });

    console.log('\n🎉 Pedidos de ejemplo creados exitosamente');

  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      console.log('⚠️  Algunos pedidos ya existen en la base de datos');
    } else {
      console.error('❌ Error creando pedidos:', error);
      process.exit(1);
    }
  }
};

// Ejecutar creación
createSampleOrders()
  .then(() => {
    console.log('\n✅ Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error en el proceso:', error);
    process.exit(1);
  });
