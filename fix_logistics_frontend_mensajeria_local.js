const fs = require('fs');
const path = require('path');

// Función para actualizar el componente DeliveryRegistrationModal
function updateDeliveryRegistrationModal() {
  const filePath = path.join(__dirname, 'frontend', 'src', 'components', 'DeliveryRegistrationModal.js');
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Buscar la sección de categorías y verificar si falta mensajeria_local
    if (!content.includes('mensajeria_local:')) {
      console.log('✅ Actualizando DeliveryRegistrationModal para incluir mensajeria_local...');
      
      // Buscar el lugar donde están definidas las categorías
      const searchPattern = /otros:\s*{\s*title:\s*['"]Sin Asignar['"],[\s\S]*?color:\s*['"]bg-gray-500['"]\s*}/;
      
      if (searchPattern.test(content)) {
        // Agregar mensajeria_local antes de "otros"
        const replacement = `mensajeria_local: {
        title: 'Mensajería Local',
        icon: MessageSquare,
        description: 'Entregas locales sin mensajero asignado',
        color: 'bg-purple-500'
      },
      otros: {
        title: 'Sin Asignar',
        icon: HelpCircle,
        description: 'Pedidos que requieren clasificación',
        color: 'bg-gray-500'
      }`;
        
        content = content.replace(searchPattern, replacement);
        
        fs.writeFileSync(filePath, content);
        console.log('✅ DeliveryRegistrationModal actualizado correctamente');
      } else {
        console.log('⚠️ No se encontró el patrón esperado en DeliveryRegistrationModal');
      }
    } else {
      console.log('✅ DeliveryRegistrationModal ya incluye mensajeria_local');
    }
  } catch (error) {
    console.error('❌ Error actualizando DeliveryRegistrationModal:', error.message);
  }
}

// Función para verificar si hay algún componente de página de logística
function checkLogisticsPageComponent() {
  const possiblePaths = [
    path.join(__dirname, 'frontend', 'src', 'pages', 'LogisticsPage.js'),
    path.join(__dirname, 'frontend', 'src', 'pages', 'DeliveryPage.js'),
    path.join(__dirname, 'frontend', 'src', 'pages', 'ShippingPage.js')
  ];
  
  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      console.log(`📄 Encontrado componente de página: ${path.basename(filePath)}`);
      
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Verificar si usa DeliveryRegistrationModal
      if (content.includes('DeliveryRegistrationModal')) {
        console.log('✅ El componente usa DeliveryRegistrationModal');
        
        // Verificar si ya maneja mensajeria_local
        if (!content.includes('mensajeria_local')) {
          console.log('⚠️ El componente NO maneja mensajeria_local explícitamente');
          console.log('   Pero debería funcionar si DeliveryRegistrationModal está actualizado');
        }
      }
    }
  }
}

// Función principal
function main() {
  console.log('🔧 ACTUALIZANDO FRONTEND PARA MENSAJERÍA LOCAL\n');
  
  // 1. Actualizar DeliveryRegistrationModal
  updateDeliveryRegistrationModal();
  
  // 2. Verificar componentes de página
  console.log('\n📋 Verificando componentes de página...');
  checkLogisticsPageComponent();
  
  console.log('\n✅ ACTUALIZACIÓN COMPLETADA');
  console.log('   - El frontend ahora debería mostrar la categoría "Mensajería Local"');
  console.log('   - Los pedidos con delivery_method = "mensajeria_local" aparecerán en su propia sección');
  console.log('\n🔄 Recuerda reiniciar la aplicación para ver los cambios');
}

// Ejecutar
main();
