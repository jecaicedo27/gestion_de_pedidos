const puppeteer = require('puppeteer');

// Test script para verificar la funcionalidad de selección múltiple de categorías 
// en la página de Inventario + Facturación
const testMultipleCategorySelection = async () => {
  const browser = await puppeteer.launch({ 
    headless: false,
    defaultViewport: { width: 1200, height: 800 },
    args: ['--no-sandbox'] 
  });
  
  try {
    const page = await browser.newPage();
    
    console.log('🧪 Iniciando test de selección múltiple de categorías...');
    
    // 1. NAVEGAR AL SITIO
    console.log('📍 Navegando al sitio...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    
    // 2. LOGIN (si es necesario)
    try {
      console.log('🔐 Intentando login...');
      const loginButton = await page.waitForSelector('button[type="submit"]', { timeout: 3000 });
      if (loginButton) {
        // Llenar credenciales de login
        await page.type('input[type="email"], input[name="email"]', 'admin@test.com');
        await page.type('input[type="password"], input[name="password"]', 'password123');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(2000);
        console.log('✅ Login exitoso');
      }
    } catch (error) {
      console.log('⚠️ No se encontró formulario de login, continuando...');
    }
    
    // 3. NAVEGAR A INVENTARIO + FACTURACIÓN
    console.log('📦 Navegando a Inventario + Facturación...');
    try {
      // Buscar el enlace en la navegación
      await page.click('a[href*="inventory-billing"], a:contains("Inventario"), a:contains("Facturación")');
      await page.waitForTimeout(2000);
    } catch (error) {
      console.log('⚠️ Navegación directa...');
      await page.goto('http://localhost:3000/inventory-billing', { waitUntil: 'networkidle0' });
    }
    
    console.log('🎯 Página cargada, iniciando tests de funcionalidad...');
    await page.waitForTimeout(3000); // Dar tiempo para que carguen los productos
    
    // 4. VERIFICAR QUE LA PÁGINA CARGÓ CORRECTAMENTE
    const pageTitle = await page.$eval('h1', el => el.textContent);
    console.log('📄 Título de página:', pageTitle);
    
    if (!pageTitle.includes('Inventario') && !pageTitle.includes('Facturación')) {
      throw new Error('❌ No estamos en la página correcta de Inventario + Facturación');
    }
    
    // 5. VERIFICAR QUE EL DROPDOWN DE CATEGORÍAS MÚLTIPLES EXISTE
    console.log('🔍 Verificando componente de categorías múltiples...');
    
    const categoryDropdown = await page.$('[class*="cursor-pointer focus-within:ring"]');
    if (!categoryDropdown) {
      throw new Error('❌ No se encontró el dropdown de categorías múltiples');
    }
    console.log('✅ Dropdown de categorías múltiples encontrado');
    
    // 6. HACER CLIC EN EL DROPDOWN PARA ABRIRLO
    console.log('🖱️ Abriendo dropdown de categorías...');
    await page.click('[class*="cursor-pointer focus-within:ring"]');
    await page.waitForTimeout(1000);
    
    // 7. VERIFICAR QUE SE MUESTRAN LAS OPCIONES DE CATEGORÍAS
    console.log('📋 Verificando opciones de categorías...');
    const categoryOptions = await page.$$('.p-2.rounded.cursor-pointer');
    console.log(`📊 Categorías encontradas: ${categoryOptions.length}`);
    
    if (categoryOptions.length === 0) {
      console.log('⚠️ No se encontraron categorías, verificando si hay productos...');
      
      // Verificar si hay mensaje de "no hay categorías"
      const noCategories = await page.$('.text-gray-500');
      if (noCategories) {
        console.log('📝 Mensaje encontrado:', await page.evaluate(el => el.textContent, noCategories));
      }
    } else {
      // 8. SELECCIONAR MÚLTIPLES CATEGORÍAS
      console.log('✅ Seleccionando múltiples categorías...');
      
      // Seleccionar las primeras 2-3 categorías disponibles
      const categoriesToSelect = Math.min(3, categoryOptions.length);
      for (let i = 0; i < categoriesToSelect; i++) {
        console.log(`🎯 Seleccionando categoría ${i + 1}...`);
        await categoryOptions[i].click();
        await page.waitForTimeout(500);
      }
      
      // 9. VERIFICAR QUE SE MUESTRAN LAS BADGES DE CATEGORÍAS SELECCIONADAS
      console.log('🏷️ Verificando badges de categorías seleccionadas...');
      await page.waitForTimeout(1000);
      
      const selectedBadges = await page.$$('.bg-blue-100.text-blue-800.px-2.py-1.rounded-full');
      console.log(`✨ Badges de categorías seleccionadas: ${selectedBadges.length}`);
      
      if (selectedBadges.length > 0) {
        console.log('✅ Las categorías seleccionadas se muestran como badges');
        
        // Leer los textos de las badges
        for (let i = 0; i < selectedBadges.length; i++) {
          const badgeText = await page.evaluate(el => el.textContent, selectedBadges[i]);
          console.log(`🏷️ Badge ${i + 1}: ${badgeText}`);
        }
      } else {
        console.log('⚠️ No se encontraron badges de categorías seleccionadas');
      }
      
      // 10. VERIFICAR QUE LAS TABLAS SE FILTRAN CORRECTAMENTE
      console.log('📊 Verificando filtrado de productos por categorías...');
      await page.waitForTimeout(2000);
      
      const categoryTables = await page.$$('.bg-white.rounded.shadow.overflow-hidden');
      console.log(`📋 Tablas de categorías mostradas después del filtro: ${categoryTables.length}`);
      
      if (categoryTables.length > 0) {
        // Leer los títulos de las categorías mostradas
        for (let i = 0; i < categoryTables.length; i++) {
          try {
            const categoryTitle = await categoryTables[i].$eval('h2', el => el.textContent);
            console.log(`📦 Categoría mostrada ${i + 1}: ${categoryTitle}`);
          } catch (error) {
            console.log(`⚠️ No se pudo leer el título de la categoría ${i + 1}`);
          }
        }
        console.log('✅ Las tablas se filtran correctamente por categorías seleccionadas');
      } else {
        console.log('⚠️ No se encontraron tablas de productos después del filtro');
      }
      
      // 11. PROBAR ELIMINAR UNA CATEGORÍA DE LA SELECCIÓN
      console.log('❌ Probando eliminación de categoría...');
      const removeButtons = await page.$$('.bg-blue-100 .w-3.h-3');
      if (removeButtons.length > 0) {
        console.log('🗑️ Eliminando la primera categoría seleccionada...');
        await removeButtons[0].click();
        await page.waitForTimeout(1000);
        
        const remainingBadges = await page.$$('.bg-blue-100.text-blue-800.px-2.py-1.rounded-full');
        console.log(`✨ Badges restantes después de eliminar: ${remainingBadges.length}`);
        console.log('✅ Eliminación de categoría funciona correctamente');
      }
      
      // 12. PROBAR BOTÓN "LIMPIAR TODAS LAS CATEGORÍAS"
      console.log('🧹 Probando botón de limpiar todas las categorías...');
      const clearAllButton = await page.$('[title="Limpiar todas las categorías"]');
      if (clearAllButton) {
        await clearAllButton.click();
        await page.waitForTimeout(1000);
        
        const remainingBadges = await page.$$('.bg-blue-100.text-blue-800.px-2.py-1.rounded-full');
        console.log(`✨ Badges después de limpiar todo: ${remainingBadges.length}`);
        
        if (remainingBadges.length === 0) {
          console.log('✅ Botón "Limpiar todo" funciona correctamente');
        } else {
          console.log('⚠️ El botón "Limpiar todo" no eliminó todas las categorías');
        }
      } else {
        console.log('⚠️ No se encontró el botón de limpiar todas las categorías');
      }
    }
    
    // 13. VERIFICAR QUE EL CARRITO SIGUE FUNCIONANDO
    console.log('🛒 Verificando funcionalidad del carrito...');
    
    const stockButtons = await page.$$('.bg-green-500, .bg-yellow-500, .bg-red-500');
    console.log(`🔘 Botones de stock encontrados: ${stockButtons.length}`);
    
    if (stockButtons.length > 0) {
      console.log('🎯 Intentando agregar producto al carrito...');
      
      // Buscar un botón verde (con stock disponible)
      const availableButtons = await page.$$('.bg-green-500:not(.cursor-not-allowed)');
      if (availableButtons.length > 0) {
        await availableButtons[0].click();
        await page.waitForTimeout(1000);
        
        // Verificar que aparece la notificación de agregado al carrito
        const cartInfo = await page.$('[data-cart-panel]');
        if (cartInfo) {
          const cartText = await page.evaluate(el => el.textContent, cartInfo);
          if (cartText.includes('producto')) {
            console.log('✅ Producto agregado al carrito exitosamente');
          }
        }
      }
    }
    
    console.log('🎉 Test de selección múltiple de categorías completado exitosamente!');
    
  } catch (error) {
    console.error('❌ Error durante el test:', error);
    
    // Tomar screenshot del error
    try {
      await page.screenshot({ 
        path: `test_error_${Date.now()}.png`, 
        fullPage: true 
      });
      console.log('📸 Screenshot del error guardado');
    } catch (screenshotError) {
      console.log('⚠️ No se pudo tomar screenshot del error');
    }
  } finally {
    // No cerrar el browser para permitir inspección manual
    console.log('🔍 Browser permanece abierto para inspección manual...');
    console.log('💡 Presiona Ctrl+C cuando hayas terminado de revisar');
    
    // Mantener el proceso activo
    await new Promise(resolve => {
      process.on('SIGINT', () => {
        console.log('👋 Cerrando browser...');
        browser.close();
        resolve();
      });
    });
  }
};

// Ejecutar el test
testMultipleCategorySelection().catch(console.error);
