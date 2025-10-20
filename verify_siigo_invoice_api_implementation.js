const fs = require('fs');
const path = require('path');

console.log('🔍 VERIFICANDO IMPLEMENTACIÓN DE SIIGO INVOICE SERVICE');
console.log('='.repeat(60));

// First, let's fetch the official SIIGO API documentation
const fetchSiigoDocumentation = async () => {
    try {
        console.log('\n📖 Obteniendo documentación oficial de SIIGO API...');
        console.log('URL: https://siigoapi.docs.apiary.io/#reference/facturas-de-venta/crear-factura');
        
        const fetch = require('node-fetch');
        const response = await fetch('https://siigoapi.docs.apiary.io/#reference/facturas-de-venta/crear-factura');
        
        if (response.ok) {
            console.log('✅ Documentación obtenida exitosamente');
            return await response.text();
        } else {
            console.log('❌ Error al obtener la documentación:', response.status);
            return null;
        }
    } catch (error) {
        console.log('❌ Error al conectar con la documentación:', error.message);
        return null;
    }
};

// Read current implementation
const readCurrentImplementation = () => {
    try {
        console.log('\n📋 Leyendo implementación actual...');
        const servicePath = path.join(__dirname, 'backend', 'services', 'siigoInvoiceService.js');
        
        if (fs.existsSync(servicePath)) {
            const content = fs.readFileSync(servicePath, 'utf8');
            console.log('✅ Archivo siigoInvoiceService.js encontrado');
            return content;
        } else {
            console.log('❌ Archivo siigoInvoiceService.js no encontrado');
            return null;
        }
    } catch (error) {
        console.log('❌ Error al leer el archivo:', error.message);
        return null;
    }
};

// Analyze current implementation structure
const analyzeCurrentImplementation = (content) => {
    console.log('\n🔍 Analizando estructura actual...');
    
    const analysis = {
        hasCreateInvoiceMethod: content.includes('createInvoice'),
        hasPrepareDataMethod: content.includes('prepareInvoiceData'),
        hasValidationMethod: content.includes('validateCustomerData'),
        usesDocumentId5154: content.includes('5154'),
        usesDocumentTypeFV2: content.includes('FV-2') || content.includes('FV'),
        hasIVACalculation: content.includes('IVA') || content.includes('tax'),
        hasPaymentProcessing: content.includes('payment'),
        hasSiigoAPICall: content.includes('/v1/invoices') || content.includes('invoices'),
        hasErrorHandling: content.includes('try') && content.includes('catch')
    };
    
    console.log('📊 Características encontradas:');
    Object.entries(analysis).forEach(([key, value]) => {
        console.log(`   ${value ? '✅' : '❌'} ${key}`);
    });
    
    return analysis;
};

// Main verification process
const main = async () => {
    console.log('\n🚀 Iniciando verificación...');
    
    // Step 1: Read current implementation
    const currentImplementation = readCurrentImplementation();
    if (!currentImplementation) {
        console.log('\n❌ No se puede continuar sin la implementación actual');
        return;
    }
    
    // Step 2: Analyze current implementation
    const analysis = analyzeCurrentImplementation(currentImplementation);
    
    // Step 3: Try to fetch documentation (optional)
    console.log('\n🌐 Intentando obtener documentación oficial...');
    const documentation = await fetchSiigoDocumentation();
    
    // Step 4: Show current implementation key parts
    console.log('\n📋 IMPLEMENTACIÓN ACTUAL - MÉTODOS PRINCIPALES:');
    console.log('-'.repeat(50));
    
    const methods = currentImplementation.match(/^\s*(async\s+)?(\w+)\s*\([^)]*\)\s*{/gm);
    if (methods) {
        methods.forEach(method => {
            console.log(`🔧 ${method.trim()}`);
        });
    }
    
    // Step 5: Check for SIIGO API endpoint structure
    console.log('\n🔌 ENDPOINTS Y CONFIGURACIÓN:');
    console.log('-'.repeat(50));
    
    const endpoints = currentImplementation.match(/https?:\/\/[^\s'"]+/g);
    if (endpoints) {
        endpoints.forEach(endpoint => {
            console.log(`🌐 ${endpoint}`);
        });
    }
    
    // Step 6: Look for data structure patterns
    console.log('\n📊 ESTRUCTURA DE DATOS:');
    console.log('-'.repeat(50));
    
    if (currentImplementation.includes('document')) {
        console.log('✅ Configuración de documento encontrada');
    }
    if (currentImplementation.includes('customer')) {
        console.log('✅ Configuración de cliente encontrada');
    }
    if (currentImplementation.includes('items')) {
        console.log('✅ Configuración de items encontrada');
    }
    if (currentImplementation.includes('payments')) {
        console.log('✅ Configuración de pagos encontrada');
    }
    
    console.log('\n📋 RESUMEN DE VERIFICACIÓN:');
    console.log('='.repeat(50));
    console.log('✅ Implementación actual analizada');
    if (documentation) {
        console.log('✅ Documentación oficial obtenida');
    } else {
        console.log('⚠️  Documentación oficial no disponible - verificación manual requerida');
    }
    
    console.log('\n🎯 PRÓXIMOS PASOS RECOMENDADOS:');
    console.log('1. Comparar estructura de datos con documentación oficial');
    console.log('2. Verificar endpoints y métodos HTTP');
    console.log('3. Validar campos requeridos y opcionales');
    console.log('4. Confirmar formato de respuesta esperado');
    console.log('5. Probar con datos reales');
};

// Execute verification
main().catch(error => {
    console.error('❌ Error durante la verificación:', error);
});
