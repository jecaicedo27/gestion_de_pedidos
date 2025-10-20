const axios = require('axios');

async function debugInvoiceCreation() {
  console.log('=== Debugging Error 400 en Creación de Factura ===\n');
  
  try {
    // 1. Login
    console.log('1. Haciendo login...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    const token = loginResponse.data.token;
    console.log('✅ Login exitoso\n');

    // 2. Crear una cotización de prueba primero
    console.log('2. Creando cotización de prueba...');
    const quotationData = {
      customer_id: 1, // Asumiendo que existe un cliente con ID 1
      customer_name: 'Cliente Prueba',
      customer_identification: '123456789',
      products: [
        {
          product_id: 1,
          code: 'SAL250',
          name: 'sal limon x 250',
          quantity: 3,
          unit_price: 8887,
          total: 26661
        }
      ],
      subtotal: 26661,
      tax: 0,
      total: 26661,
      observations: 'Cotización de prueba',
      status: 'pending'
    };

    const quotationResponse = await axios.post(
      'http://localhost:3001/api/quotations',
      quotationData,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    
    const quotationId = quotationResponse.data.quotation.id;
    console.log(`✅ Cotización creada con ID: ${quotationId}\n`);

    // 3. Intentar crear factura con diferentes combinaciones de parámetros
    console.log('3. Probando creación de factura con diferentes parámetros...\n');

    // Test 1: Con parámetros mínimos
    console.log('Test 1: Parámetros mínimos');
    try {
      const response1 = await axios.post(
        'http://localhost:3001/api/quotations/create-invoice',
        {
          quotationId: quotationId,
          documentType: 'FV-1'
        },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      console.log('✅ Éxito con parámetros mínimos');
    } catch (error) {
      console.log('❌ Error:', error.response?.data || error.message);
    }

    // Test 2: Con customer_id y document_type (como lo envía el frontend)
    console.log('\nTest 2: Con customer_id y document_type');
    try {
      const response2 = await axios.post(
        'http://localhost:3001/api/quotations/create-invoice',
        {
          customer_id: 1,
          document_type: 'FV-1'
        },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      console.log('✅ Éxito con customer_id y document_type');
    } catch (error) {
      console.log('❌ Error:', error.response?.data || error.message);
    }

    // Test 3: Con quotation_id en lugar de quotationId
    console.log('\nTest 3: Con quotation_id');
    try {
      const response3 = await axios.post(
        'http://localhost:3001/api/quotations/create-invoice',
        {
          quotation_id: quotationId,
          document_type: 'FV-1'
        },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      console.log('✅ Éxito con quotation_id');
    } catch (error) {
      console.log('❌ Error:', error.response?.data || error.message);
    }

    // Test 4: Con todos los parámetros posibles
    console.log('\nTest 4: Con todos los parámetros');
    try {
      const response4 = await axios.post(
        'http://localhost:3001/api/quotations/create-invoice',
        {
          quotationId: quotationId,
          quotation_id: quotationId,
          customer_id: 1,
          document_type: 'FV-1',
          documentType: 'FV-1'
        },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      console.log('✅ Éxito con todos los parámetros');
    } catch (error) {
      console.log('❌ Error:', error.response?.data || error.message);
    }

    console.log('\n=== Análisis del problema ===');
    console.log('El backend espera recibir "quotationId" pero el frontend puede estar enviando otro nombre de parámetro.');
    console.log('Necesitamos verificar qué parámetros exactos está enviando el frontend.\n');

  } catch (error) {
    console.error('❌ Error general:', error.response?.data || error.message);
  }
}

debugInvoiceCreation();
