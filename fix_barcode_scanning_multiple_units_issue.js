const fetch = require('node-fetch');

console.log('🔧 CORRIGIENDO SISTEMA DE ESCANEO DE CÓDIGOS DE BARRAS MÚLTIPLES');
console.log('================================================================================');

const API_BASE = 'http://localhost:5000';
let authToken = null;

// Función para login y obtener token
async function login() {
  try {
    console.log('🔑 Haciendo login...');
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@test.com',
        password: 'admin123'
      }),
    });

    if (response.ok) {
      const data = await response.json();
      authToken = data.token;
      console.log('✅ Login exitoso');
      return true;
    } else {
      console.log('❌ Error en login');
      return false;
    }
  } catch (error) {
    console.error('❌ Error en login:', error.message);
    return false;
  }
}

// Función para crear orden de prueba
async function createTestOrder() {
  try {
    console.log('🛒 Creando orden de prueba con productos múltiples...');
    
    const orderData = {
      customer_name: 'Test Cliente Escaneo',
      customer_phone: '3001234567',
      customer_address: 'Dirección de prueba',
      delivery_method: 'domicilio_local',
      items: [
        { name: 'LIQUIPOPS MORA 25 GR', quantity: 3, price: 1500 }, // 3 unidades - requiere escaneos múltiples
        { name: 'LIQUIPOPS FRESA 25 GR', quantity: 2, price: 1500 }, // 2 unidades - requiere escaneos múltiples  
        { name: 'LIQUIPOPS UVA 25 GR', quantity: 1, price: 1500 }, // 1 unidad - escaneo único
      ],
      notes: 'Orden de prueba para verificar escaneo múltiple de códigos de barras'
    };

    const response = await fetch(`${API_BASE}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(orderData),
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Orden creada exitosamente:', result.data.id);
      return result.data.id;
    } else {
      const error = await response.text();
      console.log('❌ Error creando orden:', error);
      return null;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    return null;
  }
}

// Función para cambiar estado a empaque
async function startPackaging(orderId) {
  try {
    console.log(`📦 Iniciando empaque para orden ${orderId}...`);
    
    // Cambiar estado a en_empaque
    const response = await fetch(`${API_BASE}/api/packaging/start/${orderId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (response.ok) {
      console.log('✅ Empaque iniciado correctamente');
      return true;
    } else {
      const error = await response.text();
      console.log('❌ Error iniciando empaque:', error);
      return false;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

// Función para obtener checklist y verificar estado inicial
async function getPackagingChecklist(orderId) {
  try {
    console.log(`📋 Obteniendo checklist para orden ${orderId}...`);
    
    const response = await fetch(`${API_BASE}/api/packaging/checklist/${orderId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Checklist obtenido:');
      
      result.data.checklist.forEach(item => {
        console.log(`  • ${item.item_name}: ${item.required_quantity} unidades`);
        console.log(`    - Verificado: ${item.is_verified ? 'SÍ' : 'NO'}`);
        console.log(`    - Código: ${item.product_code || 'N/A'}`);
        console.log(`    - Código de barras: ${item.barcode || 'N/A'}`);
        console.log(`    - Escaneos: ${item.scanned_count || 0}/${item.required_scans || item.required_quantity}`);
      });
      
      return result.data.checklist;
    } else {
      const error = await response.text();
      console.log('❌ Error obteniendo checklist:', error);
      return null;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    return null;
  }
}

// Función para simular escaneo de código de barras
async function scanBarcode(orderId, barcode, productName) {
  try {
    console.log(`📱 ESCANEANDO: "${barcode}" para "${productName}"`);
    
    const response = await fetch(`${API_BASE}/api/packaging/verify-barcode/${orderId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        barcode: barcode
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ ${result.message}`);
      console.log(`   📊 Progreso: ${result.data.scan_progress}`);
      console.log(`   🔢 Escaneo #${result.data.scan_number}`);
      console.log(`   ✓ Verificado: ${result.data.is_verified ? 'SÍ' : 'NO'}`);
      
      if (result.data.auto_completed) {
        console.log(`🎉 ¡PEDIDO AUTO-COMPLETADO!`);
      }
      
      return result.data;
    } else {
      const error = await response.json();
      console.log(`❌ ERROR: ${error.message}`);
      return null;
    }
  } catch (error) {
    console.error('❌ Error en escaneo:', error.message);
    return null;
  }
}

// Función principal para probar el sistema
async function testBarcodeScanning() {
  console.log('🧪 INICIANDO PRUEBA DE ESCANEO DE CÓDIGOS DE BARRAS MÚLTIPLES');
  console.log('===============================================================');
  
  // 1. Login
  if (!await login()) {
    console.log('❌ No se pudo hacer login');
    return;
  }

  // 2. Crear orden de prueba
  const orderId = await createTestOrder();
  if (!orderId) {
    console.log('❌ No se pudo crear orden de prueba');
    return;
  }

  // 3. Iniciar empaque
  if (!await startPackaging(orderId)) {
    console.log('❌ No se pudo iniciar empaque');
    return;
  }

  // 4. Obtener checklist inicial
  console.log('\n📋 ESTADO INICIAL:');
  console.log('==================');
  let checklist = await getPackagingChecklist(orderId);
  if (!checklist) return;

  // 5. Probar escaneos múltiples
