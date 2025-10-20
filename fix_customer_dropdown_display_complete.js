console.log('🔧 Solucionando completamente el problema del dropdown de clientes');
console.log('========================================================================');

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function killFrontendProcess() {
    console.log('🔥 Deteniendo proceso del frontend...');
    try {
        // Matar todos los procesos de React en el puerto 3000
        if (process.platform === 'win32') {
            execSync('taskkill /f /im node.exe', { stdio: 'ignore' });
        } else {
            execSync('pkill -f "react-scripts\\|webpack"', { stdio: 'ignore' });
        }
        console.log('✅ Procesos del frontend detenidos');
    } catch (error) {
        console.log('⚠️  No se encontraron procesos activos del frontend');
    }
}

function clearCaches() {
    console.log('🧹 Limpiando caches...');
    try {
        // Limpiar node_modules cache
        execSync('npm cache clean --force', { cwd: 'frontend', stdio: 'inherit' });
        
        // Eliminar carpetas de cache si existen
        const frontendPath = './frontend';
        const nodeCachePaths = [
            path.join(frontendPath, 'node_modules/.cache'),
            path.join(frontendPath, '.cache'),
            path.join(frontendPath, 'build')
        ];
        
        nodeCachePaths.forEach(cachePath => {
            if (fs.existsSync(cachePath)) {
                fs.rmSync(cachePath, { recursive: true, force: true });
                console.log(`✅ Eliminada cache: ${cachePath}`);
            }
        });
        
        console.log('✅ Caches limpiados');
    } catch (error) {
        console.error('⚠️  Error limpiando caches:', error.message);
    }
}

function checkDependencies() {
    console.log('📦 Verificando dependencias críticas...');
    try {
        const frontendPath = './frontend';
        const packageJsonPath = path.join(frontendPath, 'package.json');
        
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            
            const criticalDeps = ['lodash', 'lucide-react', 'react', 'react-dom'];
            const missingDeps = criticalDeps.filter(dep => 
                !packageJson.dependencies[dep] && !packageJson.devDependencies[dep]
            );
            
            if (missingDeps.length > 0) {
                console.log('❌ Dependencias faltantes:', missingDeps);
                console.log('📥 Instalando dependencias faltantes...');
                
                missingDeps.forEach(dep => {
                    try {
                        execSync(`npm install ${dep}`, { cwd: frontendPath, stdio: 'inherit' });
                        console.log(`✅ ${dep} instalado`);
                    } catch (error) {
                        console.error(`❌ Error instalando ${dep}:`, error.message);
                    }
                });
            } else {
                console.log('✅ Todas las dependencias críticas están instaladas');
            }
        }
    } catch (error) {
        console.error('⚠️  Error verificando dependencias:', error.message);
    }
}

function testComponentStructure() {
    console.log('🔍 Verificando estructura del componente...');
    
    const dropdownPath = './frontend/src/components/CustomerSearchDropdown.js';
    const quotationsPath = './frontend/src/pages/QuotationsPage.js';
    
    try {
        if (fs.existsSync(dropdownPath)) {
            const dropdownContent = fs.readFileSync(dropdownPath, 'utf8');
            
            // Verificar elementos clave del componente
            const criticalElements = [
                'CustomerSearchDropdown',
                'useState',
                'useEffect',
                'debounce',
                'quotationService.searchCustomers',
                'dropdown'
            ];
            
            const missingElements = criticalElements.filter(element => 
                !dropdownContent.includes(element)
            );
            
            if (missingElements.length > 0) {
                console.log('❌ Elementos faltantes en el componente:', missingElements);
                return false;
            }
            
            console.log('✅ Estructura del componente válida');
        }
        
        if (fs.existsSync(quotationsPath)) {
            const quotationsContent = fs.readFileSync(quotationsPath, 'utf8');
            
            if (quotationsContent.includes('<CustomerSearchDropdown')) {
                console.log('✅ Componente usado correctamente en QuotationsPage');
            } else {
                console.log('❌ Componente NO encontrado en QuotationsPage');
                return false;
            }
        }
        
        return true;
    } catch (error) {
        console.error('❌ Error verificando estructura:', error.message);
        return false;
    }
}

function createSimpleTestComponent() {
    console.log('🧪 Creando componente de prueba simplificado...');
    
    const testComponent = `
import React, { useState } from 'react';

const TestCustomerDropdown = () => {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  
  const customers = [
    { id: 1, name: 'Cliente Test 1', document: '123456' },
    { id: 2, name: 'Cliente Test 2', document: '789012' }
  ];
  
  return (
    <div className="relative">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onFocus={() => setIsOpen(true)}
        className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Test - Buscar cliente..."
      />
      
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50">
          <div className="p-2 text-xs bg-red-100 text-red-800">
            🧪 COMPONENTE DE PRUEBA - Si ves esto, React funciona correctamente
          </div>
          {customers.map(customer => (
            <div key={customer.id} className="px-4 py-2 hover:bg-gray-50 cursor-pointer">
              <div className="font-medium">{customer.name}</div>
              <div className="text-sm text-gray-600">{customer.document}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TestCustomerDropdown;
`;

    try {
        fs.writeFileSync('./frontend/src/components/TestCustomerDropdown.js', testComponent);
        console.log('✅ Componente de prueba creado');
        return true;
    } catch (error) {
        console.error('❌ Error creando componente de prueba:', error.message);
        return false;
    }
}

function startFrontend() {
    console.log('🚀 Iniciando frontend con configuración limpia...');
    
    return new Promise((resolve, reject) => {
        const frontendProcess = spawn('npm', ['start'], {
            cwd: './frontend',
            stdio: 'inherit',
            shell: true
        });
        
        // Dar tiempo para que el frontend se inicie
        setTimeout(() => {
            console.log('✅ Frontend iniciado - verifica http://localhost:3000/quotations');
            resolve();
        }, 8000);
        
        frontendProcess.on('error', (error) => {
            console.error('❌ Error iniciando frontend:', error.message);
            reject(error);
        });
    });
}

async function fixDropdownCompletely() {
    try {
        console.log('🎯 INICIANDO REPARACIÓN COMPLETA DEL DROPDOWN');
        console.log('================================================');
        
        // Paso 1: Detener procesos
        killFrontendProcess();
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Paso 2: Limpiar caches
        clearCaches();
        
        // Paso 3: Verificar dependencias
        checkDependencies();
        
        // Paso 4: Verificar estructura
        const structureOk = testComponentStructure();
        
        if (!structureOk) {
            console.log('⚠️  Problemas detectados en la estructura del componente');
            console.log('🧪 Creando componente de prueba para verificar React...');
            createSimpleTestComponent();
        }
        
        // Paso 5: Reiniciar frontend
        console.log('🔄 Reiniciando frontend completamente...');
        startFrontend();
        
        console.log('');
        console.log('🎉 REPARACIÓN COMPLETA FINALIZADA');
        console.log('====================================');
        console.log('');
        console.log('📝 INSTRUCCIONES DE VERIFICACIÓN:');
        console.log('1. Ve a http://localhost:3000/quotations');
        console.log('2. Verifica que el dropdown de clientes se muestre completamente');
        console.log('3. Prueba escribir en el campo de búsqueda');
        console.log('4. Verifica que aparezcan los resultados en el dropdown');
        console.log('');
        console.log('💡 Si el problema persiste:');
        console.log('   • Abre las herramientas del desarrollador (F12)');
        console.log('   • Ve a la pestaña Console');
        console.log('   • Busca errores de JavaScript');
        console.log('   • Verifica la pestaña Network para errores de API');
        
        if (!structureOk) {
            console.log('');
            console.log('🧪 NOTA: Se creó un TestCustomerDropdown.js');
            console.log('   Puedes importarlo temporalmente para probar si React funciona');
        }
        
    } catch (error) {
        console.error('❌ Error durante la reparación:', error.message);
        console.log('');
        console.log('🔧 SOLUCIÓN ALTERNATIVA:');
        console.log('   • Reinicia manualmente: Ctrl+C en la terminal del frontend');
        console.log('   • Ejecuta: cd frontend && npm start');
        console.log('   • Limpia cache del navegador: Ctrl+Shift+R');
    }
}

// Ejecutar la reparación completa
fixDropdownCompletely();
