const { query, poolEnd } = require('./config/database');

async function runFullUnionQuery() {
    try {
        console.log('🚀 Running Full Cartera UNION Query...');

        // --- Block 1: Messenger ---
        const whereMessenger = [
            'dt.delivered_at IS NOT NULL',
            '(COALESCE(dt.payment_collected,0) > 0 OR COALESCE(dt.delivery_fee_collected,0) > 0)',
            '(ccd.id IS NULL OR ccd.collection_status <> "collected")',
            "LOWER(COALESCE(o.payment_method,'')) <> 'reposicion'"
        ];
        const sqlMessenger = `
      SELECT
        o.id AS order_id,
        o.order_number COLLATE utf8mb4_unicode_ci AS order_number,
        o.customer_name COLLATE utf8mb4_unicode_ci AS customer_name,
        o.customer_phone COLLATE utf8mb4_unicode_ci AS customer_phone,
        o.customer_address COLLATE utf8mb4_unicode_ci AS customer_address,
        o.total_amount,
        o.payment_method COLLATE utf8mb4_unicode_ci AS payment_method,
        o.shipping_payment_method COLLATE utf8mb4_unicode_ci AS shipping_payment_method,
        o.assigned_messenger_id AS messenger_id,
        u.full_name COLLATE utf8mb4_unicode_ci AS messenger_name,
        dt.delivered_at,
        o.siigo_invoice_created_at AS invoice_date,
        CASE WHEN LOWER(COALESCE(dt.payment_method,'')) = 'efectivo' THEN COALESCE(dt.payment_collected,0) ELSE 0 END AS product_collected,
        CASE WHEN LOWER(COALESCE(dt.delivery_fee_payment_method,'')) = 'efectivo' THEN COALESCE(dt.delivery_fee_collected,0) ELSE 0 END AS delivery_fee_collected,
        (
          CASE WHEN LOWER(COALESCE(dt.payment_method,'')) = 'efectivo' THEN COALESCE(dt.payment_collected,0) ELSE 0 END
          +
          CASE WHEN LOWER(COALESCE(dt.delivery_fee_payment_method,'')) = 'efectivo' THEN COALESCE(dt.delivery_fee_collected,0) ELSE 0 END
        ) AS expected_amount,
        ccd.id AS detail_id,
        ccd.collected_amount AS declared_amount,
        ccd.collection_status COLLATE utf8mb4_unicode_ci AS collection_status,
        mcc.id AS closing_id,
        mcc.closing_date,
        NULL AS cash_register_id,
        'messenger' COLLATE utf8mb4_unicode_ci AS source
      FROM orders o
      JOIN delivery_tracking dt ON dt.id = (
        SELECT MAX(id) FROM delivery_tracking WHERE order_id = o.id
      )
      LEFT JOIN cash_closing_details ccd ON ccd.order_id = o.id
      LEFT JOIN messenger_cash_closings mcc ON mcc.id = ccd.closing_id
      LEFT JOIN users u ON u.id = o.assigned_messenger_id
      WHERE ${whereMessenger.join(' AND ')}
        AND (
          (LOWER(COALESCE(dt.payment_method,'')) = 'efectivo' AND COALESCE(dt.payment_collected,0) > 0)
          OR
          (LOWER(COALESCE(dt.delivery_fee_payment_method,'')) = 'efectivo' AND COALESCE(dt.delivery_fee_collected,0) > 0)
        )
    `;

        // --- Block 2: Bodega ---
        const whereBodega = [
            `(cr.status IS NULL OR cr.status <> 'collected')`,
            "LOWER(COALESCE(o.payment_method,'')) <> 'reposicion'"
        ];
        const sqlBodega = `
      SELECT
        o.id AS order_id,
        o.order_number COLLATE utf8mb4_unicode_ci AS order_number,
        o.customer_name COLLATE utf8mb4_unicode_ci AS customer_name,
        o.customer_phone COLLATE utf8mb4_unicode_ci AS customer_phone,
        o.customer_address COLLATE utf8mb4_unicode_ci AS customer_address,
        o.total_amount,
        o.payment_method COLLATE utf8mb4_unicode_ci AS payment_method,
        o.shipping_payment_method COLLATE utf8mb4_unicode_ci AS shipping_payment_method,
        NULL AS messenger_id,
        'Bodega' COLLATE utf8mb4_unicode_ci AS messenger_name,
        cr.created_at AS delivered_at,
        o.siigo_invoice_created_at AS invoice_date,
        0 AS product_collected,
        0 AS delivery_fee_collected,
        COALESCE(cr.amount,0) AS expected_amount,
        NULL AS detail_id,
        COALESCE(cr.accepted_amount,0) AS declared_amount,
        COALESCE(cr.status,'pending') COLLATE utf8mb4_unicode_ci AS collection_status,
        NULL AS closing_id,
        NULL AS closing_date,
        cr.id AS cash_register_id,
        'bodega' COLLATE utf8mb4_unicode_ci AS source
      FROM cash_register cr
      LEFT JOIN orders o ON o.id = cr.order_id
      WHERE ${whereBodega.join(' AND ')}
    `;

        // --- Block 3: POS ---
        const wherePOS = [
            "o.status = 'entregado'",
            "o.payment_method = 'efectivo'",
            "o.delivery_method = 'recoge_bodega'",
            "(ccd.id IS NULL OR ccd.collection_status <> 'collected')"
        ];
        const sqlPOS = `
      SELECT
        o.id AS order_id,
        o.order_number COLLATE utf8mb4_unicode_ci AS order_number,
        o.customer_name COLLATE utf8mb4_unicode_ci AS customer_name,
        o.customer_phone COLLATE utf8mb4_unicode_ci AS customer_phone,
        o.customer_address COLLATE utf8mb4_unicode_ci AS customer_address,
        o.total_amount,
        o.payment_method COLLATE utf8mb4_unicode_ci AS payment_method,
        o.shipping_payment_method COLLATE utf8mb4_unicode_ci AS shipping_payment_method,
        NULL AS messenger_id,
        'Caja POS' COLLATE utf8mb4_unicode_ci AS messenger_name,
        o.delivered_at,
        o.siigo_invoice_created_at AS invoice_date,
        o.total_amount AS product_collected,
        0 AS delivery_fee_collected,
        o.total_amount AS expected_amount,
        ccd.id AS detail_id,
        ccd.collected_amount AS declared_amount,
        ccd.collection_status COLLATE utf8mb4_unicode_ci AS collection_status,
        NULL AS closing_id,
        NULL AS closing_date,
        NULL AS cash_register_id,
        'bodega_eligible' COLLATE utf8mb4_unicode_ci AS source
      FROM orders o
      LEFT JOIN cash_closing_details ccd ON ccd.order_id = o.id
      WHERE ${wherePOS.join(' AND ')}
    `;

        // --- Block 4: Adhoc ---
        const whereAdhoc = ["status = 'pending'"];
        const sqlAdhoc = `
      SELECT
        CONCAT('adhoc-', map.id) AS order_id,
        CONCAT('Recaudo #', map.id) COLLATE utf8mb4_unicode_ci AS order_number,
        map.description COLLATE utf8mb4_unicode_ci AS customer_name,
        NULL AS customer_phone,
        NULL AS customer_address,
        map.amount AS total_amount,
        'efectivo' COLLATE utf8mb4_unicode_ci AS payment_method,
        NULL AS shipping_payment_method,
        map.messenger_id,
        u.full_name COLLATE utf8mb4_unicode_ci AS messenger_name,
        map.created_at AS delivered_at,
        NULL AS invoice_date,
        map.amount AS product_collected,
        0 AS delivery_fee_collected,
        map.amount AS expected_amount,
        NULL AS detail_id,
        0 AS declared_amount,
        'pending' COLLATE utf8mb4_unicode_ci AS collection_status,
        NULL AS closing_id,
        NULL AS closing_date,
        NULL AS cash_register_id,
        'messenger_adhoc' COLLATE utf8mb4_unicode_ci AS source
      FROM messenger_adhoc_payments map
      JOIN users u ON u.id = map.messenger_id
      WHERE ${whereAdhoc.join(' AND ')}
    `;

        // --- UNION ---
        const finalSql = `(${sqlMessenger}) UNION ALL (${sqlBodega}) UNION ALL (${sqlPOS}) UNION ALL (${sqlAdhoc}) ORDER BY delivered_at DESC LIMIT 500`;

        console.log('Testing FULL UNION Query...');
        const rows = await query(finalSql);
        console.log(`✅ Rows found: ${rows.length}`);
        if (rows.length > 0) {
            console.log('First row:', rows[0]);
            const missingOrder = rows.find(r => r.order_number === 'FV-2-15593');
            if (missingOrder) {
                console.log('✅ Missing order FOUND in result set!');
            } else {
                console.log('❌ Missing order NOT found in result set.');
            }
        } else {
            console.log('❌ No rows found!');
        }

    } catch (error) {
        console.error('❌ Query Error:', error);
    } finally {
        await poolEnd();
    }
}

runFullUnionQuery();
