const axios = require('axios');
const fs = require('fs');

class FrontendTestMonitor {
    constructor() {
        this.logFile = `frontend_test_log_${Date.now()}.txt`;
        this.testStartTime = Date.now();
        this.requestCount = 0;
    }

    log(message, data = null) {
        const timestamp = new Date().toISOString();
        const elapsed = Date.now() - this.testStartTime;
        let logEntry = `[${timestamp}] (+${elapsed}ms) ${message}`;
        
        if (data) {
            logEntry += '\n' + JSON.stringify(data, null, 2);
        }
        
        logEntry += '\n' + '='.repeat(80) + '\n';
        
        console.log(logEntry);
        
        // Guardar en archivo
        fs.appendFileSync(this.logFile, logEntry);
    }

    async monitorEndpoint(endpoint, method = 'GET') {
        try {
            const response = await axios({
                method,
                url: `http://localhost:3001${endpoint}`,
                timeout: 5000
            });
            
            this.log(`✅ ENDPOINT DISPONIBLE: ${method} ${endpoint}`, {
                status: response.status,
                available: true
            });
            
            return { available: true, status: response.status };
        } catch (error) {
            this.log(`❌ ENDPOINT NO DISPONIBLE: ${method} ${endpoint}`, {
                available: false,
                error: error.code || error.message
            });
            
            return { available: false, error: error.message };
        }
    }

    async startMonitoring() {
        console.log('🎯 INICIANDO MONITOREO FRONTEND TEST');
        console.log('📝 Log file:', this.logFile);
        console.log('🔍 Haz tu prueba en el frontend AHORA - estaré monitoreando...\n');

        this.log('🚀 INICIANDO MONITOREO DE TEST FRONTEND', {
            timestamp: new Date().toISOString(),
            backend_url: 'http://localhost:3001',
            frontend_url: 'http://localhost:3000'
        });

        // 1. Verificar estado inicial del backend
        this.log('🔍 VERIFICANDO ESTADO INICIAL DEL BACKEND...');
        
        const endpointsToCheck = [
            '/api/auth/login',
            '/api/quotations/process-natural-order', 
            '/api/quotations/create-invoice',
            '/api/quotations/customers/search',
            '/api/config/public'
        ];

        for (const endpoint of endpointsToCheck) {
            await this.monitorEndpoint(endpoint, 'POST');
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        this.log('📡 BACKEND STATUS CHECK COMPLETADO - INICIANDO MONITOREO CONTINUO...');

        // 2. Monitoreo continuo
        let checkCount = 0;
        const checkInterval = setInterval(async () => {
            checkCount++;
            
            // Verificar cada 5 segundos si hay actividad
            try {
                const healthCheck = await axios.get('http://localhost:3001/api/config/public', {
                    timeout: 2000
                });
                
                if (checkCount % 10 === 0) { // Cada 50 segundos mostrar que sigue activo
                    this.log(`💓 MONITOREO ACTIVO (check #${checkCount})`, {
                        backend_responding: true,
                        time_elapsed: Date.now() - this.testStartTime
                    });
                }
            } catch (error) {
                this.log('⚠️ BACKEND NO RESPONDE', {
                    check_number: checkCount,
                    error: error.message
                });
            }
        }, 5000);

        // 3. Interceptar requests (simulación de monitoreo)
        this.log('🎬 LISTO PARA CAPTURAR ACTIVIDAD DEL FRONTEND');
        this.log('👆 HAZ TU PRUEBA EN EL FRONTEND AHORA');
        this.log('📋 Pasos a seguir:');
        this.log('   1. Ve a http://localhost:3000');
        this.log('   2. Navega a Cotizaciones');
        this.log('   3. Selecciona un cliente');
        this.log('   4. Escribe un pedido y procesa con ChatGPT');
        this.log('   5. Intenta crear una factura FV-1');
        this.log('   6. Observa este monitor para ver qué pasa');

        // Simular captura de requests del frontend
        setTimeout(() => {
            this.setupRequestCapture();
        }, 1000);

        // Mantener el monitoreo por 10 minutos
        setTimeout(() => {
            clearInterval(checkInterval);
            this.log('⏰ MONITOREO COMPLETADO - ANÁLISIS DISPONIBLE');
            this.generateReport();
        }, 600000); // 10 minutos
    }

    setupRequestCapture() {
        // Simulador de captura de requests - en un ambiente real usarías un proxy
        this.log('🔄 SIMULANDO CAPTURA DE REQUESTS DEL FRONTEND...');
        this.log('💡 NOTA: Para captura real de requests, usar herramientas como:');
        this.log('   - Chrome DevTools Network tab');
        this.log('   - Postman Interceptor');
        this.log('   - Charles Proxy');
        
        // Test manual cada 30 segundos para ver si hay errores
        const testInterval = setInterval(async () => {
            try {
                // Simular request típico del frontend
                const testResponse = await axios.post('http://localhost:3001/api/quotations/process-natural-order', {
                    customer_id: 1,
                    natural_language_order: 'Test monitoring'
                }, {
                    timeout: 3000,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }).catch(error => {
                    if (error.response?.status === 401) {
                        this.log('🔐 REQUEST SIN AUTH DETECTADO (esto es normal)', {
                            endpoint: '/api/quotations/process-natural-order',
                            status: 401,
                            message: 'Token requerido'
                        });
                    }
                });
            } catch (error) {
                // Ignorar errores de test
            }
        }, 30000);

        setTimeout(() => clearInterval(testInterval), 580000); // Para 20 segundos antes
    }

    generateReport() {
        const report = `
========================================
📊 REPORTE FINAL DE MONITOREO FRONTEND
========================================

🕐 Inicio: ${new Date(this.testStartTime).toISOString()}
🕐 Fin: ${new Date().toISOString()}
⏱️ Duración total: ${Math.round((Date.now() - this.testStartTime) / 1000)} segundos

📄 Log completo guardado en: ${this.logFile}

🔍 PRÓXIMOS PASOS:
1. Revisa el archivo ${this.logFile} para detalles completos
2. Comparte cualquier error que hayas visto en el frontend
3. Si hubo errores, podemos analizarlos juntos

✅ MONITOREO COMPLETADO
========================================
        `;
        
        console.log(report);
        fs.appendFileSync(this.logFile, report);
    }
}

// Iniciar monitoreo
const monitor = new FrontendTestMonitor();
monitor.startMonitoring();

// Manejar Ctrl+C para cerrar limpiamente
process.on('SIGINT', () => {
    console.log('\n🛑 MONITOREO DETENIDO POR USUARIO');
    monitor.generateReport();
    process.exit(0);
});
