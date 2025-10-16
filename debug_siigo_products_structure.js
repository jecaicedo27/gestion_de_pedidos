const siigoService = require('./backend/services/siigoService');

async function debugSiigoProducts() {
  try {
    console.log('🔍 Debugging estructura de productos SIIGO...');
    
    // Obtener algunos productos de SIIGO para análisis
    const products = await siigoService.getAllProducts(1, 5); // Solo primeros 5
    
    console.log(`📦 Se obtuvieron ${products.length} productos para análisis`);
    
    products.forEach((product, index) => {
      console.log(`\n==================== PRODUCTO ${index + 1} ====================`);
      console.log('📋 ESTRUCTURA COMPLETA:', JSON.stringify(product, null, 2));
      
      console.log(`\n🔍 ANÁLISIS DE CATEGORÍA:`);
      console.log(`- product.category_name: ${product.category_name}`);
      console.log(`- product.category: ${JSON.stringify(product.category)}`);
      console.log(`- product.type: ${JSON.stringify(product.type)}`);
      console.log(`- product.product_type: ${JSON.stringify(product.product_type)}`);
      console.log(`- Otras propiedades de categoría:`, Object.keys(product).filter(key => 
        key.toLowerCase().includes('categ') || 
        key.toLowerCase().includes('type') ||
        key.toLowerCase().includes('class')
      ));
      
      console.log(`\n📊 OTROS CAMPOS IMPORTANTES:`);
      console.log(`- Nombre: ${product.name}`);
      console.log(`- Código: ${product.code}`);
      console.log(`- Precio: ${product.price}`);
      console.log(`- Activo: ${product.active}`);
      console.log(`- Estado disponible: ${product.available_for_sale}`);
      
    });
    
  } catch (error) {
    console.error('❌ Error debuggeando productos SIIGO:', error);
  }
}

debugSiigoProducts();
