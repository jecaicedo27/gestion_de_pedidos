async function debugCategoryDuplicates() {
    try {
        console.log('🔍 Depurando categorías duplicadas...');
        
        // Test 1: Llamar al endpoint de categorías sin auth
        console.log('\n📋 Test 1: Obteniendo respuesta del endpoint...');
        const response = await fetch('http://localhost:3001/api/products/categories', {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        
        if (data.success) {
            console.log(`✅ Respuesta exitosa: ${data.data.length} categorías`);
            
            // Mostrar todas las categorías
            console.log('\n📋 Categorías recibidas:');
            data.data.forEach((cat, index) => {
                console.log(`${index + 1}. ID: ${cat.id} | Nombre: "${cat.value}" | Count: ${cat.count}`);
            });
            
            // Test 2: Buscar duplicados
            console.log('\n🔍 Test 2: Analizando duplicados...');
            const categoryNames = {};
            const duplicates = [];
            
            data.data.forEach(cat => {
                if (categoryNames[cat.value]) {
                    categoryNames[cat.value]++;
                    if (categoryNames[cat.value] === 2) {
                        duplicates.push(cat.value);
                    }
                } else {
                    categoryNames[cat.value] = 1;
                }
            });
            
            if (duplicates.length > 0) {
                console.log(`❌ ${duplicates.length} categorías duplicadas encontradas:`);
                duplicates.forEach(name => {
                    console.log(`   - "${name}" aparece ${categoryNames[name]} veces`);
                });
                
                // Mostrar detalles de duplicados
                console.log('\n📋 Detalles de duplicados:');
                duplicates.forEach(dupName => {
                    console.log(`\n   Categoría: "${dupName}"`);
                    data.data
                        .filter(cat => cat.value === dupName)
                        .forEach((cat, idx) => {
                            console.log(`     ${idx + 1}. ID: ${cat.id}, Count: ${cat.count}, Label: "${cat.label}"`);
                        });
                });
            } else {
                console.log('✅ No se encontraron duplicados');
            }
            
        } else {
            console.error('❌ Error en la respuesta:', data.message || 'Sin mensaje');
            console.error('❌ Datos completos:', data);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Ejecutar debug
debugCategoryDuplicates();
