console.log('🔧 Diagnosticando y reparando problema del dropdown de clientes');
console.log('==================================================================');

// Vamos a verificar que el componente se esté importando y renderizando correctamente
const fs = require('fs');
const path = require('path');

function checkComponentImports() {
    console.log('📂 Verificando imports del CustomerSearchDropdown...');
    
    const quotationsPagePath = 'frontend/src/pages/QuotationsPage.js';
    const dropdownPath = 'frontend/src/components/CustomerSearchDropdown.js';
    
    try {
        // Verificar que el archivo del componente existe
        if (fs.existsSync(dropdownPath)) {
            console.log('✅ CustomerSearchDropdown.js existe');
        } else {
            console.error('❌ CustomerSearchDropdown.js NO existe');
            return false;
        }
        
        // Verificar que se importa en QuotationsPage
        const quotationsContent = fs.readFileSync(quotationsPagePath, 'utf8');
        
        if (quotationsContent.includes("import CustomerSearchDropdown from '../components/CustomerSearchDropdown'")) {
            console.log('✅ CustomerSearchDropdown se importa correctamente');
        } else {
            console.log('❌ CustomerSearchDropdown NO se importa correctamente');
            return false;
        }
        
        // Verificar que se usa en el JSX
        if (quotationsContent.includes('<CustomerSearchDropdown')) {
            console.log('✅ CustomerSearchDropdown se usa en el JSX');
        } else {
            console.log('❌ CustomerSearchDropdown NO se usa en el JSX');
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('❌ Error verificando imports:', error.message);
        return false;
    }
}

function checkApiService() {
    console.log('📡 Verificando API service...');
    
    const apiPath = 'frontend/src/services/api.js';
    
    try {
        if (!fs.existsSync(apiPath)) {
            console.error('❌ api.js NO existe');
            return false;
        }
        
        const apiContent = fs.readFileSync(apiPath, 'utf8');
        
        if (apiContent.includes('searchCustomers')) {
            console.log('✅ método searchCustomers existe en API');
        } else {
            console.log('❌ método searchCustomers NO existe en API');
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('❌ Error verificando API service:', error.message);
        return false;
    }
}

function diagnoseIssue() {
    console.log('🔍 Iniciando diagnóstico...');
    
    const importsOk = checkComponentImports();
    const apiOk = checkApiService();
    
    if (!importsOk || !apiOk) {
        console.log('❌ Se encontraron problemas. Necesitamos reparar los archivos.');
        return false;
    }
    
    console.log('✅ Los archivos principales parecen estar bien.');
    console.log('');
    console.log('💡 Posibles causas del problema:');
    console.log('   1. Error de compilación de React');
    console.log('   2. Cache del navegador');
    console.log('   3. Problema de estado en React');
    console.log('   4. Conflicto de CSS o estilos');
    console.log('   5. Error en el bundle de JavaScript');
    
    return true;
}

console.log('🚀 Iniciando diagnóstico del dropdown...');
diagnoseIssue();
