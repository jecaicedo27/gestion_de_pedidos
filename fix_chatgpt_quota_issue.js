// Script para manejar el problema de cuota excedida de ChatGPT
const fs = require('fs');

async function fixChatGPTQuotaIssue() {
    console.log('🔧 Arreglando problema de cuota de ChatGPT');
    console.log('===========================================\n');

    console.log('✅ PROBLEMA IDENTIFICADO: Cuota de OpenAI excedida');
    console.log('❌ Error: "You exceeded your current quota"');
    console.log('💰 Causa: El API key de OpenAI no tiene créditos suficientes\n');

    // 1. Mejorar el manejo de errores en el servicio ChatGPT
    console.log('1. 🛠️ Mejorando manejo de errores en chatgptService.js...');
    
    let chatgptServicePath = 'backend/services/chatgptService.js';
    let chatgptServiceContent = fs.readFileSync(chatgptServicePath, 'utf8');
    
    // Agregar mejor manejo de errores de quota
    const quotaErrorHandling = `
        // Manejo específico para errores de cuota
        if (!response.ok) {
            const errorData = await response.json();
            console.error('❌ Error de ChatGPT:', errorData);
            
            if (response.status === 429 && errorData.error?.type === 'insufficient_quota') {
                throw new Error('QUOTA_EXCEEDED: La cuenta de OpenAI ha excedido su cuota. Revisar billing en platform.openai.com');
            }
            
            throw new Error(\`ChatGPT API Error \${response.status}: \${errorData.error?.message || 'Unknown error'}\`);
        }`;

    // Verificar si ya tiene el manejo de errores mejorado
    if (!chatgptServiceContent.includes('insufficient_quota')) {
        console.log('   ✅ Agregando manejo de errores de cuota...');
        
        // Buscar el punto donde agregar el manejo de errores
        if (chatgptServiceContent.includes('if (!response.ok)')) {
            chatgptServiceContent = chatgptServiceContent.replace(
                /if \(!response\.ok\) \{[\s\S]*?\}/,
                quotaErrorHandling.trim()
            );
            fs.writeFileSync(chatgptServicePath, chatgptServiceContent);
            console.log('   ✅ Manejo de errores mejorado');
        }
    } else {
        console.log('   ✅ Manejo de errores ya implementado');
    }

    // 2. Mejorar el controller para mostrar errores más claros
    console.log('\n2. 🛠️ Mejorando controller para manejar errores de cuota...');
    
    let controllerPath = 'backend/controllers/quotationController.js';
    let controllerContent = fs.readFileSync(controllerPath, 'utf8');
    
    // Buscar el método processNaturalLanguageOrder
    if (controllerContent.includes('processNaturalLanguageOrder') && !controllerContent.includes('QUOTA_EXCEEDED')) {
        console.log('   ✅ Agregando manejo de cuota en controller...');
        
        const quotaHandlerInController = `
            } catch (error) {
                console.error('Error en processNaturalLanguageOrder:', error);
                
                if (error.message.includes('QUOTA_EXCEEDED')) {
                    return res.status(402).json({
                        success: false,
                        message: 'Cuota de ChatGPT excedida',
                        details: 'La cuenta de OpenAI ha alcanzado su límite de uso. Contacte al administrador para renovar los créditos.',
                        errorType: 'QUOTA_EXCEEDED'
                    });
                }
                
                return res.status(422).json({
                    success: false,
                    message: 'Error al procesar con ChatGPT',
                    details: error.message
                });
            }`;

        // Reemplazar el catch existente si existe
        if (controllerContent.includes('} catch (error) {')) {
            controllerContent = controllerContent.replace(
                /} catch \(error\) \{[\s\S]*?\}/g,
                quotaHandlerInController.trim()
            );
        } else {
            // Si no hay catch, agregarlo antes del último }
            controllerContent = controllerContent.replace(
                /(\s+})(\s+static\s+async|$)/,
                `${quotaHandlerInController}$1$2`
            );
        }
        
        fs.writeFileSync(controllerPath, controllerContent);
        console.log('   ✅ Controller actualizado con manejo de cuota');
    } else {
        console.log('   ✅ Controller ya tiene manejo de cuota');
    }

    // 3. Mejorar el frontend para mostrar el error correctamente
    console.log('\n3. 🛠️ Mejorando frontend para mostrar errores de cuota...');
    
    let quotationsPagePath = 'frontend/src/pages/QuotationsPage.js';
    let quotationsPageContent = fs.readFileSync(quotationsPagePath, 'utf8');
    
    if (!quotationsPageContent.includes('QUOTA_EXCEEDED')) {
        console.log('   ✅ Agregando manejo de cuota en frontend...');
        
        const frontendQuotaHandler = `
                    if (data.errorType === 'QUOTA_EXCEEDED') {
                        setNotification({
                            type: 'error',
                            message: 'Cuota de ChatGPT Excedida',
                            details: data.details
                        });
                        return;
                    }`;

        // Buscar donde agregar el manejo
        if (quotationsPageContent.includes('setNotification({')) {
            quotationsPageContent = quotationsPageContent.replace(
                /(setNotification\(\{\s*type:\s*'error',)/,
                `${frontendQuotaHandler.trim()}\n                    $1`
            );
            fs.writeFileSync(quotationsPagePath, quotationsPageContent);
            console.log('   ✅ Frontend actualizado con manejo de cuota');
        }
    } else {
        console.log('   ✅ Frontend ya tiene manejo de cuota');
    }

    console.log('\n🎯 SOLUCIONES IMPLEMENTADAS:');
    console.log('1. ✅ Manejo específico de errores de cuota en chatgptService');
    console.log('2. ✅ Response 402 (Payment Required) para errores de cuota');
    console.log('3. ✅ Mensajes claros al usuario sobre el problema de cuota');
    
    console.log('\n💡 SOLUCIONES PARA EL USUARIO:');
    console.log('1. 💳 Revisar billing en https://platform.openai.com/account/billing');
    console.log('2. 💰 Agregar créditos a la cuenta de OpenAI');
    console.log('3. 🔄 O usar un API key diferente con créditos disponibles');
    console.log('4. ⚙️ Temporalmente deshabilitar ChatGPT poniendo CHATGPT_ENABLED=false en .env');

    console.log('\n🔧 PRÓXIMOS PASOS:');
    console.log('1. Reiniciar el backend para aplicar los cambios');
    console.log('2. Probar el botón "Procesar con ChatGPT"');
    console.log('3. Verificar que ahora muestra un error claro de cuota');
    console.log('4. Resolver el problema de billing en OpenAI');
}

fixChatGPTQuotaIssue();
