const siigoService = require('./backend/services/siigoService');

async function debugImportIssue() {
  console.log('🔍 DEBUGGEANDO PROBLEMA DE IMPORTACIÓN SIIGO');
  console.log('=============================================\n');

  try {
    const invoiceId = '12677'; // Factura que está mostrando problemas
    
    console.log(`📋 Obteniendo detalles de factura ${invoiceId}...`);
    const fullInvoice = await siigoService.getInvoiceDetails(invoiceId);
    
    console.log('📊 DATOS COMPLETOS DE LA FACTURA:');
    console.log(JSON.stringify(fullInvoice, null, 2));
    
    console.log('\n👤 DATOS DEL CLIENTE EN LA FACTURA:');
    const customerFromInvoice = fullInvoice.customer;
    console.log('Customer from invoice:', JSON.stringify(customerFromInvoice, null, 2));
    
    if (customerFromInvoice?.id) {
      console.log(`\n🔍 Obteniendo datos detallados del cliente ${customerFromInvoice.id}...`);
      try {
        const customerInfo = await siigoService.getCustomer(customerFromInvoice.id);
        console.log('📊 DATOS DETALLADOS DEL CLIENTE:');
        console.log(JSON.stringify(customerInfo, null, 2));
        
        console.log('\n🧹 EXTRACCIÓN DE DATOS:');
        console.log('Commercial name:', customerInfo.commercial_name);
        console.log('Name array:', customerInfo.name);
        console.log('Person:', customerInfo.person);
        console.log('Company:', customerInfo.company);
        console.log('Phones:', customerInfo.phones);
        console.log('Address:', customerInfo.address);
        console.log('Identification:', customerInfo.identification);
        console.log('ID Type:', customerInfo.id_type);
        console.log('Email:', customerInfo.email);
        console.log('Contacts:', customerInfo.contacts);
        
      } catch (customerError) {
        console.error('❌ Error obteniendo cliente:', customerError.message);
      }
    } else {
      console.log('⚠️ No hay ID de cliente en la factura');
    }
    
    console.log('\n🔍 SIMULANDO EXTRACCIÓN DE NOMBRE:');
    const extractCustomerName = (customer, customerInfo) => {
      console.log('  Checking commercial_name:', customerInfo.commercial_name);
      if (customerInfo.commercial_name && customerInfo.commercial_name !== 'No aplica') {
        console.log('  ✅ Using commercial_name:', customerInfo.commercial_name);
        return customerInfo.commercial_name;
      }
      
      console.log('  Checking name array:', customerInfo.name);
      if (customerInfo.name && Array.isArray(customerInfo.name) && customerInfo.name.length >= 2) {
        const fullName = customerInfo.name.join(' ').trim();
        console.log('  ✅ Using name array:', fullName);
        return fullName;
      }
      
      console.log('  Checking person first_name:', customerInfo.person?.first_name);
      if (customerInfo.person?.first_name) {
        const personName = `${customerInfo.person.first_name} ${customerInfo.person.last_name || ''}`.trim();
        console.log('  ✅ Using person name:', personName);
        return personName;
      }
      
      console.log('  Checking company name:', customerInfo.company?.name);
      if (customerInfo.company?.name) {
        console.log('  ✅ Using company name:', customerInfo.company.name);
        return customerInfo.company.name;
      }
      
      console.log('  ❌ No valid name found, using fallback');
      return 'Cliente SIIGO';
    };
    
    // Simular los datos que se extraerían
    if (customerFromInvoice?.id) {
      const customerInfo = await siigoService.getCustomer(customerFromInvoice.id);
      const extractedName = extractCustomerName(customerFromInvoice, customerInfo);
      console.log(`\n🎯 NOMBRE EXTRAÍDO: "${extractedName}"`);
    }
    
  } catch (error) {
    console.error('❌ Error en debug:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Ejecutar debug
debugImportIssue();
