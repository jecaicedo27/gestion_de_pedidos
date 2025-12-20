const db = require('../config/database');
const xlsx = require('xlsx');
const fs = require('fs');

exports.uploadMapping = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No se ha subido ningún archivo' });
    }

    const filePath = req.file.path;

    try {
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);

        if (!data || data.length === 0) {
            return res.status(400).json({ message: 'El archivo está vacío o no tiene formato válido' });
        }

        // Expected columns: CodigoProveedor, CodigoBarras, Descripcion
        let successCount = 0;
        let errorCount = 0;

        for (const row of data) {
            const supplierCode = row['CodigoProveedor'] || row['CódigoProveedor'] || row['supplier_code'];
            const barcode = row['CodigoBarras'] || row['CódigoBarras'] || row['barcode'];
            const description = row['Descripcion'] || row['Descripción'] || row['description'] || '';

            if (supplierCode && barcode) {
                try {
                    // Upsert logic: Update if exists, Insert if not
                    const query = `
                        INSERT INTO supplier_product_codes (supplier_code, barcode, description)
                        VALUES (?, ?, ?)
                        ON DUPLICATE KEY UPDATE barcode = VALUES(barcode), description = VALUES(description)
                    `;
                    await db.query(query, [String(supplierCode), String(barcode), description]);
                    successCount++;
                } catch (err) {
                    console.error('Error inserting row:', row, err);
                    errorCount++;
                }
            } else {
                errorCount++;
            }
        }

        // Clean up file
        fs.unlinkSync(filePath);

        res.json({
            message: 'Proceso completado',
            details: {
                processed: data.length,
                success: successCount,
                errors: errorCount
            }
        });

    } catch (error) {
        console.error('Error processing Excel:', error);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.status(500).json({ message: 'Error procesando el archivo', error: error.message });
    }
};

exports.getMapping = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';

        let query = `
            SELECT spc.*, p.product_name as internal_product_name, p.internal_code 
            FROM supplier_product_codes spc
            LEFT JOIN products p ON spc.barcode = p.barcode
        `;
        let countQuery = `SELECT COUNT(*) as total FROM supplier_product_codes spc`;
        let params = [];

        if (search) {
            const searchCondition = ` WHERE spc.supplier_code LIKE ? OR spc.barcode LIKE ? OR spc.description LIKE ?`;
            query += searchCondition;
            countQuery += searchCondition;
            const searchParam = `%${search}%`;
            params = [searchParam, searchParam, searchParam];
        }

        query += ` ORDER BY spc.id DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const rows = await db.query(query, params);

        // For count query, we need to handle params correctly (only search params)
        const countParams = search ? [params[0], params[1], params[2]] : [];
        const [countRow] = await db.query(countQuery, countParams);
        const total = countRow ? countRow.total : 0;

        res.json({
            data: rows,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Error fetching mapping:', error);
        res.status(500).json({ message: 'Error obteniendo mapeo', error: error.message });
    }
};

exports.resolveCode = async (req, res) => {
    try {
        const { code } = req.params;
        if (!code) {
            return res.status(400).json({ message: 'Código requerido' });
        }

        const query = `SELECT barcode FROM supplier_product_codes WHERE supplier_code = ? LIMIT 1`;
        const [rows] = await db.query(query, [code]);

        if (rows.length > 0) {
            res.json({ found: true, barcode: rows[0].barcode });
        } else {
            res.json({ found: false });
        }
    } catch (error) {
        console.error('Error resolving code:', error);
        res.status(500).json({ message: 'Error resolviendo código', error: error.message });
    }
};
