const { pool } = require('../config/database');
const siigoService = require('./siigoService');

// Normalizar códigos de barras para evitar decimales/espacios/comas
function normalizeBarcode(input) {
  if (input === null || input === undefined) return null;
  let s = String(input).trim();
  // Unificar separador decimal y eliminar espacios
  s = s.replace(/,/g, '.').replace(/\s+/g, '');
  // Si es numérico con posible parte decimal, remover la parte decimal
  if (/^\d+(?:\.\d+)?$/.test(s)) {
    return s.split('.')[0];
  }
  return s;
}

class CompleteProductImportService {
  constructor() {
    this.importedCount = 0;
    this.tempBarcodeCount = 0;
    this.realBarcodeCount = 0;
    this.categoriesCreated = new Set();
  }

  // Función para generar códigos de barras temporales únicos
  generateTemporaryBarcode(productCode, index, companyPrefix = 'COMPANY') {
    const timestamp = Date.now().toString().slice(-8); // Últimos 8 dígitos del timestamp
    const paddedIndex = index.toString().padStart(4, '0');

    // Truncar productCode si es muy largo
    const truncatedCode = (productCode || '').slice(0, 8).toUpperCase();

    return `${companyPrefix}-${truncatedCode}-${timestamp}-${paddedIndex}`;
  }

  // Función para extraer código de barras mejorada
  extractBarcodeFromSiigo(siigoProduct) {
    // Prioridad 1: Campo principal barcode
    if (siigoProduct.barcode && String(siigoProduct.barcode).trim()) {
      return String(siigoProduct.barcode).trim();
    }

    // Prioridad 2: Campo additional_fields.barcode
    if (siigoProduct.additional_fields?.barcode && String(siigoProduct.additional_fields.barcode).trim()) {
      return String(siigoProduct.additional_fields.barcode).trim();
    }

    // Prioridad 3: Buscar en metadata
    if (siigoProduct.metadata && Array.isArray(siigoProduct.metadata)) {
      const barcodeField = siigoProduct.metadata.find(meta =>
        meta?.name && (
          meta.name.toLowerCase().includes('barcode') ||
          meta.name.toLowerCase().includes('codigo') ||
          meta.name.toLowerCase().includes('barra')
        )
      );

      if (barcodeField && barcodeField.value && String(barcodeField.value).trim()) {
        return String(barcodeField.value).trim();
      }
    }

    return null;
  }

  // Función para extraer precio de SIIGO
  extractPriceFromSiigo(product) {
    try {
      if (
        product.prices &&
        Array.isArray(product.prices) &&
        product.prices.length > 0 &&
        product.prices[0].price_list &&
        Array.isArray(product.prices[0].price_list) &&
        product.prices[0].price_list.length > 0
      ) {
        return parseFloat(product.prices[0].price_list[0].value) || 0;
      }
      return 0;
    } catch (error) {
      return 0;
    }
  }

  // Función para limpiar productos existentes
  async clearExistingProducts() {
    console.log('🗑️ Limpiando productos existentes...');
    await pool.execute('DELETE FROM products');
    console.log('✅ Productos eliminados');
  }

  // Función para insertar categorías dinámicamente
  async insertCategories(categoriesSet) {
    console.log(`📂 Procesando ${categoriesSet.size} categorías...`);

    for (const category of categoriesSet) {
      try {
        // Verificar si la categoría ya existe
        const [existing] = await pool.execute('SELECT id FROM categories WHERE name = ?', [category]);

        if (existing.length === 0) {
          // Insertar nueva categoría
          await pool.execute(
            'INSERT INTO categories (name, description, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
            [category, `Categoría ${category} importada desde SIIGO`]
          );
        }
      } catch (error) {
        console.warn(`⚠️ Error insertando categoría ${category}:`, error.message);
      }
    }

    console.log(`✅ ${categoriesSet.size} categorías procesadas`);
  }

  // Función principal de importación completa
  async importAllProducts() {
    const startTime = Date.now();

    try {
      console.log('🔗 Conectado a la base de datos');
      console.log('🔐 Autenticando con SIIGO...');

      // Obtener TODOS los productos paginados de SIIGO
      console.log('📦 Obteniendo TODOS los productos de SIIGO...');
      const allProducts = [];
      let currentPage = 1;
      let hasMorePages = true;

      while (hasMorePages) {
        console.log(`📄 Consultando página ${currentPage}...`);

        try {
          const products = await siigoService.getAllProducts(currentPage);

          if (!products || products.length === 0) {
            hasMorePages = false;
            break;
          }

          console.log(`   ➤ Productos en página ${currentPage}: ${products.length}`);
          allProducts.push(...products);

          // Control de paginación - SIIGO normalmente devuelve 100 por página
          if (products.length < 100) {
            hasMorePages = false;
          } else {
            currentPage++;
            // Rate limiting - pausa entre páginas
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (pageError) {
          console.error(`❌ Error en página ${currentPage}:`, pageError.message);
          hasMorePages = false;
        }
      }

      console.log(`🎯 Total productos obtenidos: ${allProducts.length}`);

      if (allProducts.length === 0) {
        return {
          success: false,
          message: 'No se encontraron productos en SIIGO'
        };
      }

      // Limpiar productos existentes - DESHABILITADO para evitar pérdida de configuración
      // await this.clearExistingProducts();

      console.log('💾 Insertando TODOS los productos en la base de datos...');

      // Crear conjunto de categorías
      const categoriesSet = new Set();
      let tempBarcodeIndex = 0;

      for (let i = 0; i < allProducts.length; i++) {
        const siigoProduct = allProducts[i];

        try {
          // 🔍 FILTRO: Ignorar productos sin lista de precios (ocultos en ventas/activos fijos)
          if (!siigoProduct.prices || !Array.isArray(siigoProduct.prices) || siigoProduct.prices.length === 0) {
            // Opcional: Loguear solo si no es un activo fijo obvio para no llenar el log
            // console.log(`🚫 Saltando producto sin precio (oculto): ${siigoProduct.code}`);
            continue;
          }

          // Extraer datos básicos
          const productName = siigoProduct.name || `Producto ${siigoProduct.code || i}`;
          const internalCode = siigoProduct.code || null;
          const category = siigoProduct.account_group?.name || 'Sin categoría';
          const description = siigoProduct.description || '';
          const standardPrice = this.extractPriceFromSiigo(siigoProduct);
          const siigoId = siigoProduct.id || null;
          const availableQuantity = siigoProduct.available_quantity || 0;

          // Agregar categoría al conjunto
          if (category && category !== 'Sin categoría') {
            categoriesSet.add(category);
          }

          // Extraer código de barras real de SIIGO y normalizar
          let rawBarcode = this.extractBarcodeFromSiigo(siigoProduct);
          let barcode = normalizeBarcode(rawBarcode);
          let barcodeType = 'temp';

          if (barcode && barcode.length > 0 && barcode !== 'PENDIENTE') {
            // Barcode real encontrado
            if (rawBarcode && rawBarcode !== barcode) {
              console.log(`✅ Real barcode: ${internalCode} -> ${rawBarcode} (normalizado a ${barcode})`);
            } else {
              console.log(`✅ Real barcode: ${internalCode} -> ${barcode}`);
            }
            // Validar duplicados en BD local (política: NO duplicados)
            try {
              const [conflict] = await pool.execute(
                'SELECT id, internal_code FROM products WHERE barcode = ? LIMIT 1',
                [barcode]
              );
              if (Array.isArray(conflict) && conflict.length > 0 && conflict[0].internal_code !== internalCode) {
                const suffix = String(Date.now()).slice(-6);
                const original = barcode;
                barcode = `TEMP-DUP-${original}-${(internalCode || 'UNK')}-${suffix}`;
                console.warn(`⚠️ Barcode duplicado detectado (${original}) ya usado por ${conflict[0].internal_code}. Importando ${internalCode} con temporal: ${barcode}`);
                // Contabilizar como temporal para métricas
                this.tempBarcodeCount++;
                barcodeType = 'temp';
              } else {
                this.realBarcodeCount++;
                barcodeType = 'real';
              }
            } catch (dupErr) {
              console.warn('⚠️ Error verificando duplicado de barcode:', dupErr.message);
              this.realBarcodeCount++;
              barcodeType = 'real';
            }
          } else {
            // Generar barcode temporal por ausencia en SIIGO
            const suffix = String(Date.now()).slice(-6);
            barcode = `TEMP-NOBC-${(internalCode || `PROD${i}`)}-${suffix}`;
            console.log(`🔧 Temp barcode (sin código): ${internalCode} -> ${barcode}`);
            this.tempBarcodeCount++;
            tempBarcodeIndex++;
          }

          // Estado activo: SIIGO active === true
          const isActive = siigoProduct.active === true ? 1 : 0;

          // Insertar producto en la base de datos (con manejo de duplicado de barcode)
          // Verificar si el producto ya existe por siigo_id
          const [existingProduct] = await pool.execute(
            'SELECT id, barcode FROM products WHERE siigo_id = ?',
            [siigoId]
          );

          if (existingProduct.length > 0) {
            // ACTUALIZAR producto existente
            const existingId = existingProduct[0].id;

            // Solo actualizar barcode si el nuevo es válido y diferente (evitar sobrescribir con temporales si ya tiene uno real)
            let barcodeToUpdate = existingProduct[0].barcode;
            if (barcodeType === 'real') {
              barcodeToUpdate = barcode;
            }

            await pool.execute(
              `UPDATE products SET 
                product_name = ?, 
                barcode = ?, 
                internal_code = ?, 
                category = ?, 
                description = ?,
                standard_price = ?, 
                siigo_product_id = ?, 
                available_quantity = ?,
                is_active = ?, 
                updated_at = NOW(), 
                last_sync_at = NOW(), 
                stock = ?
               WHERE id = ?`,
              [
                productName,
                barcodeToUpdate,
                internalCode,
                category,
                description,
                standardPrice,
                internalCode,
                availableQuantity,
                isActive,
                availableQuantity,
                existingId
              ]
            );
            // console.log(`🔄 Producto actualizado: ${internalCode}`);
          } else {
            // INSERTAR nuevo producto
            try {
              await pool.execute(
                `INSERT INTO products (
                  product_name, barcode, internal_code, category, description,
                  standard_price, siigo_product_id, siigo_id, available_quantity,
                  is_active, created_at, updated_at, last_sync_at, stock
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW(), ?)`,
                [
                  productName,
                  barcode,
                  internalCode,
                  category,
                  description,
                  standardPrice,
                  internalCode,
                  siigoId,
                  availableQuantity,
                  isActive,
                  availableQuantity
                ]
              );
            } catch (insertErr) {
              if (insertErr && insertErr.code === 'ER_DUP_ENTRY' && barcodeType !== 'temp') {
                const suffix = String(Date.now()).slice(-6);
                const fallback = `TEMP-DUP-${(rawBarcode || barcode || 'DUP')}-${(internalCode || 'UNK')}-${suffix}`;
                console.warn(`⚠️ ER_DUP_ENTRY al insertar ${internalCode} con barcode ${barcode}. Reintentando con ${fallback}`);
                barcode = fallback;
                await pool.execute(
                  `INSERT INTO products (
                    product_name, barcode, internal_code, category, description,
                    standard_price, siigo_product_id, siigo_id, available_quantity,
                    is_active, created_at, updated_at, last_sync_at, stock
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW(), ?)`,
                  [
                    productName,
                    barcode,
                    internalCode,
                    category,
                    description,
                    standardPrice,
                    internalCode,
                    siigoId,
                    availableQuantity,
                    isActive,
                    availableQuantity
                  ]
                );
                this.tempBarcodeCount++;
                barcodeType = 'temp';
              } else {
                throw insertErr;
              }
            }
          }

          this.importedCount++;

          // Rate limiting cada 50 productos
          if (i % 50 === 0 && i > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (productError) {
          console.error(`❌ Error procesando producto ${siigoProduct.code}:`, productError.message);
        }
      }

      // Insertar todas las categorías encontradas
      this.categoriesCreated = categoriesSet;
      await this.insertCategories(categoriesSet);

      const endTime = Date.now();
      const duration = Math.round((endTime - startTime) / 1000);

      const result = {
        success: true,
        total_products: allProducts.length,
        imported_products: this.importedCount,
        real_barcodes: this.realBarcodeCount,
        temp_barcodes: this.tempBarcodeCount,
        categories_created: categoriesSet.size,
        duration_seconds: duration,
        categories: Array.from(categoriesSet)
      };

      console.log('📊 RESUMEN DE IMPORTACIÓN:');
      console.log(`✅ Productos insertados: ${this.importedCount} de ${allProducts.length}`);
      console.log(`🏷️ Barcodes reales: ${this.realBarcodeCount}`);
      console.log(`🔧 Barcodes temporales: ${this.tempBarcodeCount}`);
      console.log(`📂 Categorías creadas: ${categoriesSet.size}`);
      console.log('🎉 IMPORTACIÓN COMPLETA EXITOSA');

      return result;
    } catch (error) {
      console.error('❌ Error en importación completa:', error);
      return {
        success: false,
        message: 'Error en la importación completa de productos',
        error: error.message
      };
    }
  }
}

module.exports = new CompleteProductImportService();
