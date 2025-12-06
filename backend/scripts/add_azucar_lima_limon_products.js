const { query, poolEnd } = require('../config/database');

async function addAzucarLimaLimon() {
  console.log('🔧 AGREGAR AZÚCAR LIMA LIMÓN (todas las presentaciones) 🔧');
  console.log('===========================================================\\n');

  try {
    // Generar barcode único de 13 dígitos (prefijo 299) evitando colisiones
    const generateUniqueBarcode = async () => {
      while (true) {
        const candidate = ('299' + Date.now().toString() + Math.floor(Math.random() * 1000).toString()).slice(0, 13);
        const rows = await query('SELECT id FROM products WHERE barcode = ? LIMIT 1', [candidate]);
        if (!rows || rows.length === 0) return candidate;
      }
    };

    // Verificar si ya existen productos de Azúcar Limón/Lima Limón
    const existing = await query(
      `SELECT COUNT(*) AS count
       FROM products
       WHERE (product_name LIKE '%AZUCAR%LIMON%' OR product_name LIKE '%AZUCAR%LIMA LIMON%')
         AND is_active = 1`
    );

    console.log(`Productos Azúcar Limón actuales: ${existing[0]?.count ?? 0}`);

    // Definir presentaciones que usa el tablero de Azúcares (en Gramos)
    const targetProducts = [
      // product_name, category, subcategory, stock, available_quantity, standard_price, siigo_id
      ['SKARCHA AZUCAR LIMON X 250 GR', 'SKARCHA NO FABRICADOS 19%', 'LIMON', 0, 0, 0, 'SKARAZLIM250'],
      ['SKARCHA AZUCAR LIMON X 450 GR', 'SKARCHA NO FABRICADOS 19%', 'LIMON', 0, 0, 0, 'SKARAZLIM450'],
      ['SKARCHA AZUCAR LIMON X 500 GR', 'SKARCHA NO FABRICADOS 19%', 'LIMON', 0, 0, 0, 'SKARAZLIM500']
    ];

    // Eliminar posibles duplicados (solo estos nombres/patrón) para dejar limpio
    console.log('\\n🧹 Limpiando duplicados previos (si existen)...');
    await query(
      `DELETE FROM products 
       WHERE product_name IN ('SKARCHA AZUCAR LIMON X 250 GR','SKARCHA AZUCAR LIMON X 450 GR','SKARCHA AZUCAR LIMON X 500 GR')
          OR (product_name LIKE '%AZUCAR%LIMA LIMON%')`
    );

    console.log('➕ Insertando presentaciones de Azúcar Lima Limón (250/450/500 GR)...');

    // La tabla products (según otros scripts) acepta estas columnas
    const insertQuery = `
      INSERT INTO products (
        product_name, category, subcategory, barcode, stock, available_quantity, standard_price, siigo_id, last_sync_at, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), 1)
    `;

    for (const prod of targetProducts) {
      const barcode = await generateUniqueBarcode();
      const [name, category, subcategory, stock, available, price, siigo] = prod;
      await query(insertQuery, [name, category, subcategory, barcode, stock, available, price, siigo]);
    }

    console.log('✅ Productos de Azúcar Lima Limón creados con éxito.');

    // Mostrar verificación final por presentación
    console.log('\\n=== VERIFICACIÓN FINAL (Azúcares LIMÓN) ===');
    const check = await query(
      `SELECT product_name, category, subcategory, available_quantity as stock
       FROM products
       WHERE product_name LIKE 'SKARCHA AZUCAR LIMON X % GR'
       ORDER BY product_name`
    );

    if (!check.length) {
      console.log('⚠️ No se encontraron los productos insertados. Revisa la conexión o la tabla.');
    } else {
      check.forEach(p => {
        const color = p.stock > 50 ? '🟢' : p.stock > 0 ? '🟡' : '🔴';
        console.log(`${color} ${p.product_name} | Cat: ${p.category} | Subcat: ${p.subcategory} | Stock: ${p.stock}`);
      });
    }

    console.log('\\nSiguientes pasos:');
    console.log('1) Refrescar el frontend (Inventario + Facturación).');
    console.log('2) Filtrar por categoría \"SKARCHA NO FABRICADOS 19%\".');
    console.log('3) Verás la columna LIMON en el grupo AZUCARES y filas 250/450/500 GR.');
    console.log('   Nota: Se crearon con stock 0 para no afectar inventario. Ajusta stock si es necesario.');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await poolEnd().catch(() => {});
  }
}

addAzucarLimaLimon();
