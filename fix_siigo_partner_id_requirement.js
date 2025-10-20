const mysql = require('mysql2/promise');
const axios = require('axios');
require('dotenv').config({ path: './backend/.env' });

// Función para obtener token de SIIGO
async function getSiigoToken() {
    console.log('\n🔐 Obteniendo token de SIIGO...');
    
    try {
        const response = await axios.post('https://api.siigo.com/auth', {
            username: process.env.SIIGO_API_USERNAME,
            access_key: process.env.SIIGO_API_ACCESS_KEY
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Token obtenido exitosamente');
        return response.data.access_token;
    } catch (error) {
        console.error('❌ Error obteniendo token de SIIGO:', error.response?.data || error.message);
        throw error;
    }
}

// Función para obtener información de la empresa y Partner-Id
async function getCompanyInfo(token) {
    console.log('\n📋 Obteniendo información de la empresa...');
    
    try {
        const response = await axios.get('https://api.siigo.com/v1/users/user', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Información de empresa obtenida');
        console.log('📊 Datos:', JSON.stringify(response.data, null, 2));
        
        // Buscar el Partner-Id en la respuesta
        if (response.data?.active_subscription?.id) {
            console.log('🔑 Partner-Id encontrado:', response.data.active_subscription.id);
            return response.data.active_subscription.id;
        }
        
        return null;
    } catch (error) {
        console.log('❌ Error obteniendo info de empresa:', error.response?.status, error.response?.data?.message || error.message);
        if (error.response?.data) {
            console.log('   Detalle:', JSON.stringify(error.response.data, null, 2));
        }
        return null;
    }
}

// Función para probar productos con Partner-Id
async function testProductsWithPartnerId(token, partnerId) {
    console.log(`\n🧪 Probando consulta de productos con Partner-Id: ${partnerId}`);
    
    const testCodes = ['SHOT000', 'MP171', 'MP172'];
    
    for (const code of testCodes) {
        console.log(`\n🔍 Probando producto: ${code}`);
        
        try {
            const response = await axios.get(`https://api.siigo.com/v1/products?code=${code}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Partner-Id': partnerId,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.data && response.data.length > 0) {
                const product = response.data[0];
                console.log(`✅ ${code}: Encontrado - ${product.name} (Activo: ${product.active})`);
            } else {
                console.log(`⚠️  ${code}: No encontrado en SIIGO`);
            }
        } catch (error) {
            console.log(`❌ ${code}: Error ${error.response?.status} - ${error.response?.data?.message || error.message}`);
        }
        
        // Pequeño delay
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

// Función para actualizar archivo .env
async function updateEnvFile(partnerId) {
    const fs = require('fs');
    const path = './backend/.env';
    
    try {
        let envContent = fs.readFileSync(path, 'utf8');
        
        // Verificar si ya existe SIIGO_API_PARTNER_ID
        if (envContent.includes('SIIGO_API_PARTNER_ID=')) {
            // Reemplazar el valor existente
            envContent = envContent.replace(
                /SIIGO_API_PARTNER_ID=.*/g,
                `SIIGO_API_PARTNER_ID=${partnerId}`
            );
        } else {
            // Agregar al final del archivo
            envContent += `\n# SIIGO API Partner ID\nSIIGO_API_PARTNER_ID=${partnerId}\n`;
        }
        
        fs.writeFileSync(path, envContent);
        console.log(`✅ Archivo .env actualizado con Partner-Id: ${partnerId}`);
        return true;
    } catch (error) {
        console.error('❌ Error actualizando archivo .env:', error.message);
        return false;
    }
}

async function main() {
    try {
        console.log('🚀 SOLUCIONANDO REQUERIMIENTO DE PARTNER-ID DE SIIGO');
        console.log('=' .repeat(70));
        
        // Obtener token de SIIGO
        const token = await getSiigoToken();
        
        // Intentar obtener Partner-Id de la información de la empresa
        let partnerId = await getCompanyInfo(token);
        
        if (!partnerId) {
            console.log('\n🔍 No se pudo obtener Partner-Id automáticamente');
            console.log('💡 Intentemos con algunos valores comunes...');
            
            // Intentar con valores típicos
            const commonPartnerIds = [
                'siigo', 
                'default', 
                process.env.SIIGO_API_USERNAME?.split('@')[1]?.replace('.', '-'),
                'perlas-explosivas'
            ];
            
            for (const testId of commonPartnerIds) {
                if (testId) {
                    console.log(`\n🧪 Probando con Partner-Id: ${testId}`);
                    
                    try {
                        const testResponse = await axios.get('https://api.siigo.com/v1/products?page=1&page_size=1', {
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Partner-Id': testId,
                                'Content-Type': 'application/json'
                            }
                        });
                        
                        if (testResponse.data && testResponse.data.results) {
                            console.log(`✅ Partner-Id funciona: ${testId}`);
                            partnerId = testId;
                            break;
                        }
                    } catch (error) {
                        console.log(`❌ No funciona: ${testId} (${error.response?.status})`);
                    }
                }
                
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        if (partnerId) {
            console.log(`\n🎉 Partner-Id identificado: ${partnerId}`);
            
            // Probar productos específicos
            await testProductsWithPartnerId(token, partnerId);
            
            // Actualizar archivo .env
            const envUpdated = await updateEnvFile(partnerId);
            
            if (envUpdated) {
                console.log('\n✅ SOLUCIÓN APLICADA EXITOSAMENTE');
                console.log('📝 Próximos pasos:');
                console.log('   1. Reinicia el backend para cargar la nueva variable');
                console.log('   2. Los scripts de sincronización ahora deberían funcionar');
                console.log('   3. Los productos específicos ahora deberían poder verificarse');
            }
        } else {
            console.log('\n❌ No se pudo determinar el Partner-Id automáticamente');
            console.log('📞 Contacta al soporte de SIIGO para obtener tu Partner-Id');
            console.log('📖 Documentación: https://developer.siigo.com/introduction/codigos-de-error/header_required');
        }
        
    } catch (error) {
        console.error('❌ Error en el proceso:', error.message);
        process.exit(1);
    }
}

// Ejecutar
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { main };
