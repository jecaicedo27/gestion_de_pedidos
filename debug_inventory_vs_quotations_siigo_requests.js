const fetch = require('node-fetch');
const fs = require('fs');

// Función para realizar login y obtener token
async function login() {
  try {
    const response = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });

    if (!response.ok) {
      throw new Error(`Login failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Login exitoso');
    
    return data.data?.data?.token || data.token || data.data?.token;
  } catch (error) {
    console.error('❌ Error en login:', error.message);
    throw error;
  }
}

// Función para buscar un cliente de prueba
async function findTestCustomer(token) {
  try {
    const response = await fetch('http://localhost:3001/api/quotations/customers/search?q=prueba&limit=5', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    if (data.success && data.customers && data.customers.length > 0) {
      console.log('✅ Cliente encontrado:', data.customers[0].name);
      return data.customers[0];
    } else {
      throw new Error('No se encontró cliente de prueba');
    }
  } catch (error) {
    console.error('❌ Error buscando cliente:', error);
    throw error;
  }
}

// Test 1: Crear factura desde quotaciones (FUNCIONA)
async function testQuotationsInvoice(token, customer) {
  console.log('\n🧪 TEST 1: Creando factura desde sistema de COTIZACIONES (que funciona)...');
  
  const quotationsPayload = {
    customer_id: customer.id,
    items: [
      {
        code: 'IMPLE04', // Código que sabemos que funciona
        product_code: 'IMPLE04',
        product_name: 'Implemento de Prueba Cotizaciones',
        quantity: 1,
        price: 106,
        unit_price: 106,
        siigo_code: 'IMPLE04'
      }
    ],
    document_type: 'FV-1',
    notes: 'Factura de prueba desde cotizaciones',
    natural_language_order: 'Test desde cotizaciones - debe funcionar'
  };

  console.log('📊 Payload cotizaciones:', JSON.stringify(quotationsPayload, null, 2));

  try {
    const response = await fetch('http://localhost:3001/api/quotations/create-invoice', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(quotationsPayload)
    });

    const responseText = await response.text();
    console.log('📝 Response status:', response.status);
    console.log('📝 Response raw:', responseText);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Error parsing response:', parseError.message);
      return { success: false, error: 'Invalid JSON response', raw: responseText };
    }

    if (data.success) {
      console.log('✅ Cotizaciones invoice CREADA:', data.data?.siigo_invoice_number);
      
      // Guardar request exitoso para comparación
      fs.writeFileSync('./successful_quotations_request.json', JSON.stringify({
        payload: quotationsPayload,
        response: data,
        siigo_request_data: data.data?.siigo_request_data
      }, null, 2));
      
      return { success: true, data: data.data };
    } else {
      console.error('❌ Error en cotizaciones:', data.message);
      return { success: false, error: data.message, details: data };
    }
  } catch (error) {
    console.error('❌ Error de red cotizaciones:', error.message);
    return { success: false, error: error.message };
  }
}

// Test 2: Crear factura desde inventario (FALLA)
async function testInventoryInvoice(token, customer) {
  console.log('\n🧪 TEST 2: Creando factura desde sistema de INVENTARIO (que falla)...');
  
  // Usar exactamente el mismo payload que cotizaciones pero simulando que viene del inventario
  const inventoryPayload = {
    customer_id: customer.id,
    items: [
      {
        code: 'IMPLE04', // Mismo código exitoso
        product_code: 'IMPLE04',
        product_name: 'Implemento de Prueba Inventario',
        quantity: 1,
        price: 106,
        unit_price: 106,
        siigo_code: 'IMPLE04'
      }
    ],
    document_type: 'FV-1',
    notes: 'Factura de prueba desde inventario',
    natural_language_order: 'Test desde inventario - reproduciendo error 422'
  };

  console.log('📊 Payload inventario:', JSON.stringify(inventoryPayload, null, 2));

  try {
    const response = await fetch('http://localhost:3001/api/quotations/create-invoice', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(inventoryPayload)
    });

    const responseText = await response.text();
    console.log('📝 Response status:', response.status);
    console.log('📝 Response raw:', responseText);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Error parsing response:', parseError.message);
      return { success: false, error: 'Invalid JSON response', raw: responseText };
    }

    if (data.success) {
      console.log('✅ Inventario invoice CREADA:', data.data?.siigo_invoice_number);
      return { success: true, data: data.data };
    } else {
      console.error('❌ Error en inventario:', data.message);
      console.error('❌ Detalles:', data.details);
      console.error('❌ Error específico:', data.error);
      
      // Guardar request fallido para comparación
      fs.writeFileSync('./failed_inventory_request.json', JSON.stringify({
        payload: inventoryPayload,
        response: data,
        siigo_request_data: data.siigo_request_data
      }, null, 2));
      
      return { success: false, error: data.message, details: data };
    }
  } catch (error) {
    console.error('❌ Error de red inventario:', error.message);
    return { success: false, error: error.message };
  }
}

// Test 3: Comparar payload real de inventario con productos LIQUIPOPS
async function testInventoryWithLiquipopsProducts(token, customer) {
  console.log('\n🧪 TEST 3: Probando con productos LIQUIPOPS reales (que causaron el error)...');
  
  const liquipopsPayload = {
    customer_id: customer.id,
    items: [
      {
        code: 'LIQUIPOPS01',
        product_code: 'COMPANY-P-ESSKIS-70381453-0038', // Código problemático real
        product_name: 'LIQUIPOPS SABOR A FRESA X 1200 GR',
        quantity: 1,
        price: 1000,
        unit_price: 1000,
        siigo_code: 'COMPANY-P-ESSKIS-70381453-0038',
        original_siigo_code: 'COMPANY-P-ESSKIS-70381453-0038',
        fallback_generated: true
      },
      {
        code: 'LIQUIPOPS02', 
        product_code: 'COMPANY-P-ESSKIS-70381453-0039', // Código problemático real
        product_name: 'LIQUIPOPS SABOR A FRESA X 3400 GR',
        quantity: 1,
        price: 2500,
        unit_price: 2500,
        siigo_code: 'COMPANY-P-ESSKIS-70381453-0039',
        original_siigo_code: 'COMPANY-P-ESSKIS-70381453-0039',
        fallback_generated: true
      }
    ],
    document_type: 'FV-1',
    notes: 'Factura con productos LIQUIPOPS problemáticos',
    natural_language_order: 'Productos LIQUIPOPS que causaron error 422'
  };

  console.log('📊 Payload LIQUIPOPS problemático:', JSON.stringify(liquipopsPayload, null, 2));

  try {
    const response = await fetch('http://localhost:3001/api/quotations/create-invoice', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(liquipopsPayload)
    });

    const responseText = await response.text();
    console.log('📝 Response status:', response.status);
    console.log('📝 Response raw:', responseText);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Error parsing response:', parseError.message);
      return { success: false, error: 'Invalid JSON response', raw: responseText };
    }

    if (data.success) {
      console.log('✅ LIQUIPOPS invoice CREADA:', data.data?.siigo_invoice_number);
      return { success: true, data: data.data };
    } else {
      console.error('❌ Error con LIQUIPOPS:', data.message);
      console.error('❌ Detalles LIQUIPOPS:', data.details);
      console.error('❌ Error específico LIQUIPOPS:', data.error);
      
      // Guardar request LIQUIPOPS fallido
      fs.writeFileSync('./failed_liquipops_request.json', JSON.stringify({
        payload: liquipopsPayload,
        response: data,
        siigo_request_data: data.siigo_request_data
      }, null, 2));
      
      return { success: false, error: data.message, details: data };
    }
  } catch (error) {
    console.error('❌ Error de red LIQUIPOPS:', error.message);
    return { success: false, error: error.message };
  }
}

// Función principal
async function main() {
  console.log('🔍 DEBUGGER: Comparando requests SIIGO entre Cotizaciones vs Inventario\n');

  try {
    // 1. Login
    const token = await login();
    
    // 2. Buscar cliente de prueba
    const customer = await findTestCustomer(token);
    
    // 3. Test con cotizaciones (funciona)
    const quotationsResult = await testQuotationsInvoice(token, customer);
    
    // 4. Test con inventario (falla)
    const inventoryResult = await testInventoryInvoice(token, customer);
    
    // 5. Test con productos LIQUIPOPS problemáticos
    const liquipopsResult = await testInventoryWithLiquipopsProducts(token, customer);
    
    // 6. Análisis de resultados
    console.log('\n📊 ANÁLISIS DE RESULTADOS:');
    console.log('=====================================');
    console.log(`Cotizaciones (debería funcionar): ${quotationsResult.success ? '✅ ÉXITO' : '❌ FALLÓ'}`);
    console.log(`Inventario (reproduce error): ${inventoryResult.success ? '✅ ÉXITO' : '❌ FALLÓ'}`);  
    console.log(`LIQUIPOPS problemáticos: ${liquipopsResult.success ? '✅ ÉXITO' : '❌ FALLÓ'}`);
    
    if (!quotationsResult.success && !inventoryResult.success) {
      console.log('\n🔍 AMBOS SISTEMAS FALLAN - el problema puede ser más profundo');
    } else if (quotationsResult.success && !inventoryResult.success) {
      console.log('\n🔍 COTIZACIONES FUNCIONA pero INVENTARIO FALLA');
      console.log('El problema está en alguna diferencia sutil entre los sistemas');
    } else if (!quotationsResult.success && inventoryResult.success) {
      console.log('\n🔍 INVENTARIO FUNCIONA pero COTIZACIONES FALLA');
      console.log('Resultado inesperado - revisar lógica');
    } else {
      console.log('\n🔍 AMBOS SISTEMAS FUNCIONAN');
      console.log('El error puede ser intermitente o ya fue solucionado');
    }
    
    // 7. Verificar archivos generados
    if (fs.existsSync('./successful_quotations_request.json')) {
      console.log('\n📁 Archivo generado: successful_quotations_request.json');
    }
    if (fs.existsSync('./failed_inventory_request.json')) {
      console.log('📁 Archivo generado: failed_inventory_request.json');
    }
    if (fs.existsSync('./failed_liquipops_request.json')) {
      console.log('📁 Archivo generado: failed_liquipops_request.json');
    }
    
    console.log('\n🎯 RECOMENDACIONES:');
    if (!inventoryResult.success && inventoryResult.details) {
      console.log('- Revisar detalles del error 422 en failed_inventory_request.json');
      console.log('- Comparar siigo_request_data entre archivos exitosos y fallidos');
      console.log('- Verificar si el problema está en códigos de productos inactivos');
      console.log('- Considerar implementar mejor sistema de fallback de códigos');
    }

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

// Ejecutar
main().catch(console.error);
