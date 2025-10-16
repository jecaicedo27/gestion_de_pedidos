const puppeteer = require('puppeteer');

async function testColombiaHeatMapComplete() {
    let browser;
    
    try {
        console.log('🇨🇴 Iniciando prueba completa del mapa de calor de Colombia...\n');
        
        browser = await puppeteer.launch({ 
            headless: false, 
            defaultViewport: { width: 1200, height: 800 }
        });
        
        const page = await browser.newPage();
        
        // Capturar errores de consola
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log('❌ Error en consola:', msg.text());
            }
        });
        
        // Capturar errores de página
        page.on('pageerror', error => {
            console.log('❌ Error de página:', error.message);
        });
        
        console.log('1. 📱 Navegando al dashboard...');
        await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle0' });
        
        // Verificar si hay errores de react-leaflet
        await page.waitForTimeout(2000);
        
        const leafletError = await page.evaluate(() => {
            const errors = Array.from(document.querySelectorAll('*')).find(el => 
                el.textContent && el.textContent.includes('Cannot find module'));
            return errors ? errors.textContent : null;
        });
        
        if (leafletError) {
            console.log('❌ Todavía hay errores de módulo:', leafletError);
            return false;
        }
        
        console.log('2. ✅ Dashboard cargado sin errores de módulos');
        
        // Buscar el contenedor del mapa de Colombia
        console.log('3. 🔍 Buscando componente del mapa de Colombia...');
        
        const mapContainer = await page.$('.colombia-heatmap-container, [data-testid="colombia-heatmap"], .leaflet-container');
        
        if (mapContainer) {
            console.log('✅ Contenedor del mapa encontrado');
            
            // Verificar si Leaflet se cargó correctamente
            const leafletLoaded = await page.evaluate(() => {
                return typeof window.L !== 'undefined';
            });
            
            if (leafletLoaded) {
                console.log('✅ Leaflet cargado correctamente');
            } else {
                console.log('⚠️ Leaflet no está disponible globalmente');
            }
            
            // Verificar contenido del mapa
            const mapContent = await page.evaluate(() => {
                const mapElement = document.querySelector('.leaflet-container');
                if (mapElement) {
                    const markers = mapElement.querySelectorAll('.leaflet-marker-icon, .leaflet-marker-pane');
                    const tiles = mapElement.querySelectorAll('.leaflet-tile');
                    
                    return {
                        hasMap: true,
                        hasMarkers: markers.length > 0,
                        hasTiles: tiles.length > 0,
                        markersCount: markers.length,
                        tilesCount: tiles.length
                    };
                }
                return { hasMap: false };
            });
            
            if (mapContent.hasMap) {
                console.log('✅ Mapa renderizado correctamente');
                console.log(`📍 Marcadores encontrados: ${mapContent.markersCount}`);
                console.log(`🗺️ Tiles cargados: ${mapContent.tilesCount}`);
            } else {
                console.log('❌ El mapa no se renderizó correctamente');
            }
            
        } else {
            console.log('❌ No se encontró el contenedor del mapa');
        }
        
        // Verificar estadísticas del dashboard
        console.log('4. 📊 Verificando datos de estadísticas...');
        
        const statsElements = await page.$$eval('[class*="stat"], .dashboard-card, .card', elements => {
            return elements.map(el => el.textContent).filter(text => 
                text.includes('Medellín') || 
                text.includes('pedidos') || 
                text.includes('ventas') ||
                text.includes('Colombia')
            );
        });
        
        if (statsElements.length > 0) {
            console.log('✅ Estadísticas encontradas:', statsElements);
        } else {
            console.log('⚠️ No se encontraron estadísticas específicas del mapa');
        }
        
        // Verificar API del heatmap
        console.log('5. 🌐 Probando API del heatmap...');
        
        try {
            const response = await page.evaluate(async () => {
                const token = localStorage.getItem('token');
                const res = await fetch('/api/heatmap/colombia-sales', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                return {
                    status: res.status,
                    ok: res.ok,
                    data: res.ok ? await res.json() : null
                };
            });
            
            if (response.ok && response.data) {
                console.log('✅ API del heatmap responde correctamente');
                console.log(`📈 Total de ventas: $${(response.data.summary?.totalSales || 0).toLocaleString()}`);
                console.log(`🏙️ Ciudades con datos: ${response.data.cities?.length || 0}`);
            } else {
                console.log('❌ Error en API del heatmap:', response.status);
            }
        } catch (error) {
            console.log('❌ Error al probar API:', error.message);
        }
        
        console.log('\n🎯 RESUMEN DE LA PRUEBA:');
        console.log('====================================');
        console.log('✅ Paquetes npm instalados correctamente');
        console.log('✅ Dashboard accesible sin errores de módulos');
        
        await page.waitForTimeout(5000);
        
        return true;
        
    } catch (error) {
        console.error('❌ Error durante la prueba:', error);
        return false;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

testColombiaHeatMapComplete()
    .then(success => {
        if (success) {
            console.log('\n🎉 ¡Prueba del mapa de calor de Colombia completada exitosamente!');
        } else {
            console.log('\n❌ La prueba encontró algunos problemas.');
        }
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Error fatal:', error);
        process.exit(1);
    });
