const { query } = require('../config/database');
const path = require('path');
const fs = require('fs');

/**
 * POST /api/receptions
 * Crear nueva recepción (subir PDF)
 */
const createReception = async (req, res) => {
    try {
        const { supplier, invoice_number, expected_items } = req.body;
        const file = req.file;
        const userId = req.user ? req.user.id : null;

        if (!supplier || !file) {
            return res.status(400).json({ success: false, message: 'Proveedor y archivo PDF son requeridos' });
        }

        // Validar duplicado
        const [existing] = await query(
            'SELECT id FROM merchandise_receptions WHERE LOWER(supplier) = LOWER(?) AND LOWER(invoice_number) = LOWER(?)',
            [supplier, invoice_number || '']
        );

        if (existing) {
            return res.status(409).json({
                success: false,
                message: `Ya existe una recepción para el proveedor "${supplier}" con la factura "${invoice_number}"`
            });
        }

        // Guardar ruta relativa
        const filePath = `/uploads/receptions/${file.filename}`;

        const result = await query(
            'INSERT INTO merchandise_receptions (supplier, supplier_nit, invoice_number, invoice_file_path, created_by) VALUES (?, ?, ?, ?, ?)',
            [supplier, req.body.supplier_nit || '', invoice_number, filePath, userId]
        );

        const receptionId = result.insertId;

        // Guardar items esperados si existen
        if (expected_items) {
            let itemsData = [];
            try {
                itemsData = typeof expected_items === 'string' ? JSON.parse(expected_items) : expected_items;
            } catch (e) {
                console.error('Error parsing expected_items:', e);
            }

            if (Array.isArray(itemsData) && itemsData.length > 0) {
                for (const item of itemsData) {
                    await query(
                        'INSERT INTO merchandise_reception_expected_items (reception_id, item_code, item_description, expected_quantity) VALUES (?, ?, ?, ?)',
                        [receptionId, item.code, item.description, item.quantity]
                    );
                }
                console.log(`Saved ${itemsData.length} expected items for reception ${receptionId}`);
            }
        }

        return res.json({
            success: true,
            message: 'Recepción creada exitosamente',
            receptionId
        });

    } catch (error) {
        console.error('Error creando recepción:', error);
        return res.status(500).json({ success: false, message: 'Error interno creando recepción' });
    }
};

/**
 * GET /api/receptions
 * Listar recepciones
 */
const getReceptions = async (req, res) => {
    try {
        const { status } = req.query;
        let sql = 'SELECT * FROM merchandise_receptions';
        const params = [];

        if (status) {
            sql += ' WHERE status = ?';
            params.push(status);
        }

        sql += ' ORDER BY created_at DESC LIMIT 50';

        const receptions = await query(sql, params);
        return res.json({ success: true, data: receptions });
    } catch (error) {
        console.error('Error listando recepciones:', error);
        return res.status(500).json({ success: false, message: 'Error interno obteniendo recepciones' });
    }
};

/**
 * GET /api/receptions/:id
 * Obtener detalle de recepción e items
 */
const getReception = async (req, res) => {
    try {
        const { id } = req.params;
        console.log('getReception called with id:', id);

        const [reception] = await query('SELECT * FROM merchandise_receptions WHERE id = ?', [id]);
        console.log('Reception found:', reception);

        if (!reception) {
            return res.status(404).json({ success: false, message: 'Recepción no encontrada' });
        }

        const items = await query(`
            SELECT 
                ri.*, 
                p.product_name, 
                p.internal_code, 
                p.barcode
            FROM merchandise_reception_items ri
            JOIN products p ON ri.product_id = p.id
            WHERE ri.reception_id = ?
            ORDER BY ri.created_at DESC
        `, [id]);

        console.log('Items found:', items.length);

        // Obtener items esperados
        const expectedItems = await query(`
            SELECT * FROM merchandise_reception_expected_items
            WHERE reception_id = ?
            ORDER BY id ASC
        `, [id]);

        console.log('Expected items found:', expectedItems.length);
        console.log('Sample expected item (GENI14):', expectedItems.find(i => i.item_code === 'GENI14'));

        return res.json({ success: true, data: { ...reception, items, expectedItems } });
    } catch (error) {
        console.error('Error obteniendo recepción:', error);
        console.error('Error stack:', error.stack);
        return res.status(500).json({ success: false, message: 'Error interno obteniendo detalle' });
    }
};

/**
 * POST /api/receptions/:id/items
 * Agregar item escaneado
 */
const addItem = async (req, res) => {
    try {
        const { id } = req.params;
        let { barcode, quantity = 1 } = req.body;

        // Detectar si el código escaneado es un JSON (QR de caja)
        let qrData = null;
        if (typeof barcode === 'string' && barcode.trim().startsWith('{')) {
            try {
                qrData = JSON.parse(barcode);
                barcode = qrData.id; // Extraer el código de barras del JSON
                quantity = qrData.qty || quantity; // Usar la cantidad del QR si existe
                console.log('QR JSON detectado:', { barcode, quantity, lote: qrData.lot, vencimiento: qrData.exp });
            } catch (e) {
                console.warn('Error parseando JSON del QR, usando como código simple:', e.message);
            }
        }

        // 1. Buscar producto por código de barras (products o product_barcodes)
        let product = null;

        // Buscar en tabla principal
        const [prodMain] = await query('SELECT id, product_name, internal_code, barcode FROM products WHERE barcode = ? OR internal_code = ?', [barcode, barcode]);
        if (prodMain) {
            product = prodMain;
        } else {
            // Buscar en tabla de códigos alternos
            const [prodAlt] = await query(`
                SELECT p.id, p.product_name, p.internal_code, p.barcode 
                FROM product_barcodes pb
                JOIN products p ON pb.product_name = p.product_name 
                WHERE pb.barcode = ?
            `, [barcode]);
            if (prodAlt) {
                product = prodAlt;
            } else {
                // Buscar en tabla de códigos de proveedor
                const [supplierMap] = await query('SELECT barcode FROM supplier_product_codes WHERE supplier_code = ? LIMIT 1', [barcode]);
                if (supplierMap) {
                    const [prodMapped] = await query('SELECT id, product_name, internal_code, barcode FROM products WHERE barcode = ? OR internal_code = ?', [supplierMap.barcode, supplierMap.barcode]);
                    if (prodMapped) {
                        product = prodMapped;
                        console.log(`Mapped supplier code ${barcode} to internal product ${product.product_name} (${supplierMap.barcode})`);
                    }
                }
            }
        }

        if (!product) {
            return res.status(404).json({ success: false, message: 'Producto no encontrado' });
        }

        // 2. Verificar si el producto está en la lista de esperados (Prioridad 1)
        // Primero, buscar si existe un código de proveedor mapeado para este producto
        const [supplierMapping] = await query(
            'SELECT supplier_code FROM supplier_product_codes WHERE barcode = ?',
            [product.barcode]
        );

        // Intentar coincidir por código de proveedor (si existe), código interno, código de barras, o nombre del producto
        const [expectedItem] = await query(
            `SELECT id FROM merchandise_reception_expected_items 
             WHERE reception_id = ? 
             AND (item_code = ? OR item_code = ? OR item_code = ? OR item_description = ?)`,
            [id, supplierMapping?.supplier_code, product.internal_code, product.barcode, product.product_name]
        );

        if (expectedItem) {
            // Es un item esperado: actualizar cantidad escaneada
            await query(
                'UPDATE merchandise_reception_expected_items SET scanned_quantity = scanned_quantity + ? WHERE id = ?',
                [quantity, expectedItem.id]
            );
        } else {
            // 3. No es esperado: Verificar si ya existe como item extra (Prioridad 2)
            const [existingItem] = await query(
                'SELECT id, quantity FROM merchandise_reception_items WHERE reception_id = ? AND product_id = ?',
                [id, product.id]
            );

            if (existingItem) {
                // Ya existe como extra: sumar cantidad
                await query(
                    'UPDATE merchandise_reception_items SET quantity = quantity + ? WHERE id = ?',
                    [quantity, existingItem.id]
                );
            } else {
                // Es un nuevo item extra: insertar
                await query(
                    'INSERT INTO merchandise_reception_items (reception_id, product_id, quantity) VALUES (?, ?, ?)',
                    [id, product.id, quantity]
                );
            }
        }

        return res.json({
            success: true,
            message: 'Producto agregado',
            product: {
                id: product.id,
                name: product.product_name
            }
        });

    } catch (error) {
        console.error('Error agregando item:', error);
        return res.status(500).json({ success: false, message: 'Error interno agregando item' });
    }
};

/**
 * POST /api/receptions/:id/finalize
 * Finalizar recepción y actualizar inventario
 */
const finalizeReception = async (req, res) => {
    try {
        const { id } = req.params;

        const [reception] = await query('SELECT status FROM merchandise_receptions WHERE id = ?', [id]);
        if (!reception) return res.status(404).json({ success: false, message: 'Recepción no encontrada' });
        if (reception.status === 'completed') return res.status(400).json({ success: false, message: 'La recepción ya fue completada' });

        // Obtener items
        const items = await query('SELECT product_id, quantity FROM merchandise_reception_items WHERE reception_id = ?', [id]);

        if (items.length === 0) {
            return res.status(400).json({ success: false, message: 'No hay items en la recepción' });
        }

        // Actualizar inventario (Transacción sería ideal, pero usaremos loop simple por compatibilidad actual)
        for (const item of items) {
            await query(
                'UPDATE products SET available_quantity = available_quantity + ? WHERE id = ?',
                [item.quantity, item.product_id]
            );
        }

        // Marcar como completada
        await query(
            'UPDATE merchandise_receptions SET status = "completed", completed_at = NOW() WHERE id = ?',
            [id]
        );

        return res.json({ success: true, message: 'Recepción finalizada e inventario actualizado' });

    } catch (error) {
        console.error('Error finalizando recepción:', error);
        return res.status(500).json({ success: false, message: 'Error interno finalizando recepción' });
    }
};

/**
 * POST /api/receptions/analyze
 * Analizar PDF y extraer datos + items
 */
const analyzeInvoice = async (req, res) => {
    try {
        const file = req.file;
        if (!file) return res.status(400).json({ success: false, message: 'Archivo PDF requerido' });

        const pdf = require('pdf-parse');
        const dataBuffer = fs.readFileSync(file.path);
        const data = await pdf(dataBuffer);
        const fullText = data.text;

        const lines = fullText.split(/\n+/).map(l => l.trim()).filter(l => l.length > 0);

        // 1. Extraer Proveedor (puede estar en múltiples líneas consecutivas)
        let supplier = '';
        let supplierLines = [];
        let foundStart = false;

        for (let i = 0; i < Math.min(lines.length, 20); i++) {
            const line = lines[i];

            // Saltar líneas que claramente no son el nombre del proveedor
            if (line.match(/factura/i) || line.match(/^nit/i) || line.match(/señores/i) ||
                line.match(/fecha/i) || line.match(/^tel/i) || line.match(/^cel/i) ||
                line.match(/dirección/i) || line.match(/ciudad/i) || line.match(/^email/i) ||
                line.match(/^www\./i) || line.match(/^carrera/i) || line.match(/^calle/i)) {
                if (foundStart) break; // Si ya encontramos el inicio y vemos estas palabras, terminamos
                continue;
            }

            // Buscar líneas que parezcan nombres de empresa
            if (line.length > 3 && line.match(/[A-Z]/)) {
                // Si contiene palabras clave de empresa, definitivamente es parte del nombre
                if (line.match(/\b(SAS|LTDA|S\.A\.S|S\.A|CIA|COMPANY|INTERNATIONAL|CORPORATION|LTDA\.)\b/i)) {
                    supplierLines.push(line);
                    foundStart = true;
                }
                // Si ya empezamos a capturar y la línea es mayúsculas, continuar
                else if (foundStart && line.match(/^[A-Z\s&]+$/)) {
                    supplierLines.push(line);
                }
                // Si no hemos empezado y la línea es mayúsculas, empezar
                else if (!foundStart && line.match(/^[A-Z\s&]+$/) && line.length > 5) {
                    supplierLines.push(line);
                    foundStart = true;
                }
            } else if (foundStart) {
                // Si ya empezamos y encontramos algo que no es mayúsculas, terminamos
                break;
            }
        }

        supplier = supplierLines.join(' ').trim();

        // 2. Extraer NIT del proveedor
        let supplier_nit = '';
        for (let i = 0; i < Math.min(lines.length, 20); i++) {
            const line = lines[i];
            // Buscar patrones de NIT (ahora permitiendo puntos)
            const nitMatch = line.match(/NIT[:\s]*([0-9\.]+(?:-[0-9])?)/i) ||
                line.match(/([0-9]{3}\.[0-9]{3}\.[0-9]{3}-?[0-9]?)/);
            if (nitMatch) {
                supplier_nit = nitMatch[1].replace(/\s+/g, ''); // Mantener puntos y guiones es útil, o eliminarlos si se prefiere
                break;
            }
        }

        // 3. Extraer Número de Factura
        let invoice_number = '';
        const invoicePatterns = [
            /No\.\s*([A-Z]{2,5}\s*\d+)/i,
            /Factura.*?No\.\s*([A-Z0-9\s-]+)/i,
            /No\.\s*([A-Z0-9-]+)/i,
            /POP\s*\d+/i // Patrón específico visto en el ejemplo
        ];

        for (const line of lines) {
            for (const pattern of invoicePatterns) {
                const match = line.match(pattern);
                if (match) {
                    invoice_number = match[0].replace(/No\.\s*/i, '').trim(); // Usar match[0] para capturar todo "POP 798" si es necesario, o ajustar grupos
                    if (match[1]) invoice_number = match[1]; // Si hay grupo de captura, usarlo
                    // Ajuste específico para "POP 798" si el regex lo captura todo
                    if (line.includes('POP') && !invoice_number.includes('POP')) {
                        // Si capturamos solo el número pero el prefijo es importante
                    }
                    break;
                }
            }
            if (invoice_number) break;
        }

        // 4. Extraer Items (Lógica adaptada para pdf-parse)
        const items = [];
        let currentItem = null;

        // Patrón para inicio de item: Número + Código (ej: "1GENI02" o "1 GENI02")
        // El código suele ser mayúsculas y números, min 4 caracteres para evitar confundir con "1000 ML" o "350 GR"
        const itemStartPattern = /^(\d{1,3})\s*([A-Z0-9]{4,})$/;

        // Patrón para línea de cantidad (ej: "84.0021,851.32") - Empieza con número decimal (cantidad)
        const quantityPattern = /^(\d+\.\d{2})/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Detectar inicio de item
            const startMatch = line.match(itemStartPattern);
            if (startMatch) {
                // Si ya teníamos un item en proceso, guardarlo (aunque debería haberse cerrado con la cantidad)
                // Pero si la descripción era muy larga, tal vez no llegamos a la cantidad? 
                // En este formato, la cantidad viene DESPUÉS de la descripción.

                currentItem = {
                    code: startMatch[2], // El código capturado
                    description: '',
                    quantity: 0
                };
                continue;
            }

            if (currentItem) {
                // Buscar línea de cantidad
                const qtyMatch = line.match(quantityPattern);
                if (qtyMatch) {
                    // Encontramos la cantidad, cerramos el item
                    currentItem.quantity = parseFloat(qtyMatch[1]);
                    items.push(currentItem);
                    currentItem = null; // Reset para el siguiente
                } else {
                    // Es parte de la descripción
                    // Evitar agregar líneas basura si las hay
                    if (!line.match(/^\d+$/) && !line.match(/%/)) {
                        currentItem.description += (currentItem.description ? ' ' : '') + line;
                    }
                }
            }
        }
        console.log('=== PDF ANALYSIS RESULTS ===');
        console.log('Supplier extracted:', supplier);
        console.log('Supplier NIT extracted:', supplier_nit);
        console.log('Invoice number extracted:', invoice_number);
        console.log(`Extracted ${items.length} items from PDF`);
        console.log('Items:', JSON.stringify(items, null, 2));
        console.log('Full text (first 500 chars):', fullText.substring(0, 500));

        return res.json({
            success: true,
            data: {
                supplier: supplier || 'NO EXTRAÍDO',
                supplier_nit: supplier_nit || '',
                invoice_number: invoice_number || 'NO EXTRAÍDO',
                items,
                temp_filename: file.filename
            }
        });

    } catch (error) {
        console.error('Error analizando PDF:', error);
        console.error('Error stack:', error.stack);
        return res.status(500).json({ success: false, message: 'Error analizando PDF: ' + error.message });
    }
};

/**
 * GET /api/receptions/suppliers
 * Obtener lista de proveedores únicos
 */
const getSuppliers = async (req, res) => {
    try {
        const suppliers = await query(`
            SELECT DISTINCT supplier 
            FROM product_inventory_config 
            WHERE supplier IS NOT NULL AND supplier != ''
            ORDER BY supplier ASC
        `);

        return res.json({
            success: true,
            data: suppliers.map(s => s.supplier)
        });
    } catch (error) {
        console.error('Error obteniendo proveedores:', error);
        return res.status(500).json({ success: false, message: 'Error obteniendo proveedores' });
    }
};

/**
 * GET /api/receptions/pending
 * Obtener recepciones pendientes (para Logística/Empaque)
 */
const getPendingReceptions = async (req, res) => {
    try {
        const receptions = await query(`
            SELECT * FROM merchandise_receptions 
            WHERE status = 'pendiente_recepcion'
            ORDER BY created_at DESC
        `);

        return res.json({ success: true, data: receptions });
    } catch (error) {
        console.error('Error obteniendo recepciones pendientes:', error);
        return res.status(500).json({ success: false, message: 'Error obteniendo recepciones pendientes' });
    }
};

/**
 * POST /api/receptions/:id/complete-reception
 * Completar recepción (Logística termina escaneo)
 */
const completeReception = async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;
        const userId = req.user ? req.user.id : null;

        // Obtener items esperados y escaneados
        const expectedItems = await query(
            'SELECT * FROM merchandise_reception_expected_items WHERE reception_id = ?',
            [id]
        );

        const scannedItems = await query(
            'SELECT product_id, SUM(quantity) as total FROM merchandise_reception_items WHERE reception_id = ? GROUP BY product_id',
            [id]
        );

        // Determinar status (ok, faltante, sobrante)
        let receptionStatus = 'ok';
        const expectedTotal = expectedItems.reduce((sum, item) => sum + item.expected_quantity, 0);
        const scannedTotal = scannedItems.reduce((sum, item) => sum + item.total, 0);

        if (scannedTotal < expectedTotal) {
            receptionStatus = 'faltante';
        } else if (scannedTotal > expectedTotal) {
            receptionStatus = 'sobrante';
        }

        // Validar que haya notas si hay diferencias
        if (receptionStatus !== 'ok' && (!notes || notes.trim() === '')) {
            return res.status(400).json({
                success: false,
                message: 'Debe agregar notas explicando la diferencia entre lo esperado y lo recibido'
            });
        }

        // Actualizar recepción
        await query(
            `UPDATE merchandise_receptions 
             SET status = 'recepcionado', 
                 reception_status = ?, 
                 reception_notes = ?, 
                 received_by = ?, 
                 received_at = NOW() 
             WHERE id = ?`,
            [receptionStatus, notes, userId, id]
        );

        return res.json({
            success: true,
            message: 'Recepción completada exitosamente',
            status: receptionStatus
        });

    } catch (error) {
        console.error('Error completando recepción:', error);
        return res.status(500).json({ success: false, message: 'Error completando recepción' });
    }
};

/**
 * GET /api/receptions/for-approval
 * Obtener recepciones para aprobar (para Cartera)
 */
const getForApproval = async (req, res) => {
    try {
        const receptions = await query(`
            SELECT * FROM merchandise_receptions 
            WHERE status = 'recepcionado'
            ORDER BY received_at DESC
        `);

        return res.json({ success: true, data: receptions });
    } catch (error) {
        console.error('Error obteniendo recepciones para aprobar:', error);
        return res.status(500).json({ success: false, message: 'Error obteniendo recepciones' });
    }
};

/**
 * POST /api/receptions/:id/approve
 * Aprobar recepción y actualizar inventario (Cartera)
 */
const approveReception = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user ? req.user.id : null;

        // Verificar que esté en estado recepcionado
        const [reception] = await query('SELECT * FROM merchandise_receptions WHERE id = ?', [id]);

        if (!reception) {
            return res.status(404).json({ success: false, message: 'Recepción no encontrada' });
        }

        if (reception.status !== 'recepcionado') {
            return res.status(400).json({
                success: false,
                message: 'Solo se pueden aprobar recepciones en estado "recepcionado"'
            });
        }

        // Obtener items recepcionados
        const items = await query(
            'SELECT product_id, SUM(quantity) as total_quantity FROM merchandise_reception_items WHERE reception_id = ? GROUP BY product_id',
            [id]
        );

        // Actualizar inventario
        for (const item of items) {
            await query(
                'UPDATE products SET available_quantity = available_quantity + ? WHERE id = ?',
                [item.total_quantity, item.product_id]
            );
        }

        // Marcar como completado
        await query(
            `UPDATE merchandise_receptions 
             SET status = 'completado', 
                 approved_by = ?, 
                 approved_at = NOW() 
             WHERE id = ?`,
            [userId, id]
        );

        return res.json({
            success: true,
            message: 'Recepción aprobada e inventario actualizado'
        });

    } catch (error) {
        console.error('Error aprobando recepción:', error);
        return res.status(500).json({ success: false, message: 'Error aprobando recepción' });
    }
};

/**
 * PUT /api/receptions/:id/update-items
 * Actualizar items esperados (Facturación)
 */
const updateExpectedItems = async (req, res) => {
    try {
        const { id } = req.params;
        const { expected_items } = req.body;

        // Verificar que esté en estado pendiente_recepcion
        const [reception] = await query('SELECT * FROM merchandise_receptions WHERE id = ?', [id]);

        if (!reception) {
            return res.status(404).json({ success: false, message: 'Recepción no encontrada' });
        }

        if (reception.status !== 'pendiente_recepcion') {
            return res.status(400).json({
                success: false,
                message: 'Solo se pueden actualizar recepciones en estado "pendiente_recepcion"'
            });
        }

        // Eliminar items esperados anteriores
        await query('DELETE FROM merchandise_reception_expected_items WHERE reception_id = ?', [id]);

        // Insertar nuevos items esperados
        if (expected_items && Array.isArray(expected_items) && expected_items.length > 0) {
            const itemsData = JSON.parse(expected_items);
            for (const item of itemsData) {
                await query(
                    'INSERT INTO merchandise_reception_expected_items (reception_id, item_code, item_description, expected_quantity) VALUES (?, ?, ?, ?)',
                    [id, item.code, item.description, item.quantity]
                );
            }
        }

        return res.json({
            success: true,
            message: 'Items esperados actualizados exitosamente'
        });

    } catch (error) {
        console.error('Error actualizando items esperados:', error);
        return res.status(500).json({ success: false, message: 'Error actualizando items' });
    }
};

module.exports = {
    createReception,
    getReceptions,
    getReception,
    addItem,
    finalizeReception,
    analyzeInvoice,
    getSuppliers,
    getPendingReceptions,
    completeReception,
    getForApproval,
    approveReception,
    updateExpectedItems
};
