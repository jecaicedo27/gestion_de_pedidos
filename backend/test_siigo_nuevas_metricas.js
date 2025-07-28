// Cargar variables de entorno primero
require('dotenv').config({ path: './.env' });

const axios = require('axios');

// Configuración de prueba
const API_URL = 'http://localhost:3001';
const TEST_NIT = '59856269'; // NIT de prueba

// Verificar que las variables de entorno están cargadas
console.log('🔍 Variables de entorno SIIGO:');
console.log('- SIIGO_ENABLED:', process.env.SIIGO_ENABLED);
console.log('- SIIGO_API_BASE_URL:', process.env.SIIGO_API_BASE_URL);
console.log('- SIIGO_API_USERNAME:', process.env.SIIGO_API_USERNAME);
console.log('- SIIGO_API_ACCESS_KEY presente:', !!process.env.SIIGO_API_ACCESS_KEY);

async function testNuevasMetricas() {
  try {
    console.log('🧪 PROBANDO NUEVAS MÉTRICAS FINANCIERAS SIIGO');
    console.log('=' .repeat(60));
    
    // Hacer un simple test directo con el controlador
    console.log('\n1️⃣ Probando el controlador directamente...');
    
    const siigoConsultaController = require('./controllers/siigoConsultaController');
    
    // Mock objects para req y res
    const req = {
      params: { nit: TEST_NIT },
      user: { full_name: 'Sistema de Prueba' }
    };
    
    const res = {
      json: (data) => {
        console.log('✅ Respuesta del controlador recibida');
        
        if (data.success) {
          const responseData = data.data;
          
          console.log('\n🎯 RESULTADOS DE LAS NUEVAS MÉTRICAS:');
          console.log('=' .repeat(50));
          
          // Mostrar resumen financiero mejorado
          if (responseData.resumen_financiero) {
            const rf = responseData.resumen_financiero;
            console.log('📊 RESUMEN FINANCIERO MEJORADO:');
            console.log(`   💰 Total Vendido: $${rf.total_vendido?.toLocaleString() || '0'}`);
            console.log(`   💳 Total Pagado: $${rf.total_pagado?.toLocaleString() || '0'}`);
            console.log(`   ⚠️  Faltante por Pagar: $${rf.faltante_por_pagar?.toLocaleString() || '0'}`);
            console.log(`   🎯 Total Descuentos: $${rf.total_descuentos?.toLocaleString() || '0'}`);
            console.log(`   📈 % Pagado: ${rf.porcentaje_pagado?.toFixed(2) || '0.00'}%`);
            console.log(`   📉 % Descuentos: ${rf.porcentaje_descuentos?.toFixed(2) || '0.00'}%`);
            console.log(`   📋 Facturas Pendientes: ${rf.facturas_pendientes || 0}`);
            console.log(`   💸 Saldo Total: $${rf.saldo_total?.toLocaleString() || '0'}`);
          }
          
          // Mostrar cuentas por cobrar detalladas
          if (responseData.cuentas_por_cobrar) {
            const cxc = responseData.cuentas_por_cobrar;
            console.log('\n💼 CUENTAS POR COBRAR DETALLADAS:');
            console.log(`   💰 Total Sold: $${cxc.total_sold?.toLocaleString() || '0'}`);
            console.log(`   💳 Total Paid: $${cxc.total_paid?.toLocaleString() || '0'}`);
            console.log(`   ⚠️  Remaining to Pay: $${cxc.remaining_to_pay?.toLocaleString() || '0'}`);
            console.log(`   🎯 Total Discounts: $${cxc.total_discounts?.toLocaleString() || '0'}`);
            console.log(`   📈 Payment %: ${cxc.payment_percentage?.toFixed(2) || '0.00'}%`);
            console.log(`   📉 Discount %: ${cxc.discount_percentage?.toFixed(2) || '0.00'}%`);
            console.log(`   📄 Pending Invoices: ${cxc.pending_invoices?.length || 0}`);
            console.log(`   💸 Total Balance: $${cxc.total_balance?.toLocaleString() || '0'}`);
            
            // Mostrar facturas pendientes si existen
            if (cxc.pending_invoices && cxc.pending_invoices.length > 0) {
              console.log('\n📋 PRIMERAS 3 FACTURAS PENDIENTES:');
              cxc.pending_invoices.slice(0, 3).forEach((factura, index) => {
                console.log(`   ${index + 1}. ${factura.invoice_number}: Total $${factura.total?.toLocaleString()} - Pagado $${factura.paid?.toLocaleString()} - Saldo $${factura.balance?.toLocaleString()}`);
              });
            }
          }
          
          // Verificar que no hay valores en cero problemáticos
          console.log('\n🔍 VERIFICACIÓN DE INTEGRIDAD:');
          const issues = [];
          
          if (responseData.resumen_financiero) {
            const rf = responseData.resumen_financiero;
            if (rf.total_vendido === 0 && rf.facturas_pendientes > 0) {
              issues.push('⚠️  Total vendido es 0 pero hay facturas pendientes');
            }
            if (rf.total_pagado === 0 && rf.faltante_por_pagar > 0) {
              issues.push('⚠️  Total pagado es 0 pero hay faltante por pagar');
            }
          }
          
          if (issues.length > 0) {
            console.log('❌ PROBLEMAS DETECTADOS:');
            issues.forEach(issue => console.log(`   ${issue}`));
          } else {
            console.log('✅ Todos los valores parecen consistentes');
          }
          
          console.log('\n🎉 PRUEBA COMPLETADA EXITOSAMENTE');
          
        } else {
          console.log('❌ Error en consulta:', data.message);
        }
      },
      status: (code) => ({ 
        json: (data) => {
          console.log(`❌ Error ${code}:`, data);
        }
      })
    };
    
    // Llamar al controlador directamente
    await siigoConsultaController.consultarClientePorNit(req, res);
    
  } catch (error) {
    console.error('❌ Error en prueba:', error.response?.data || error.message);
  }
}

// Ejecutar prueba
testNuevasMetricas();
