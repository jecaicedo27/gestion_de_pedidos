
const { query, poolEnd } = require('../config/database');

// Standard VAT 19% assumption for backfilling
const VAT_RATE = 1.19;

async function backfill() {
    try {
        console.log("🚀 Starting Customer Segmentation Backfill...");

        // 1. Get all customers with at least one order
        // We link customers table with orders via siigo_id
        const customers = await query(`
      SELECT c.id, c.siigo_id, c.name, c.commercial_name 
      FROM customers c
      WHERE EXISTS (SELECT 1 FROM orders o WHERE o.siigo_customer_id = c.siigo_id)
    `);

        console.log(`📋 Found ${customers.length} customers with orders.`);

        // Cache products prices
        // Fetch all products standard_price
        const products = await query('SELECT product_name, standard_price FROM products WHERE standard_price > 0');
        const priceMap = {};
        products.forEach(p => {
            // Normalize name key
            priceMap[p.product_name.trim().toLowerCase()] = Number(p.standard_price);
        });
        console.log(`💰 Loaded ${products.length} product list prices.`);

        let updatedCount = 0;
        let errorsCount = 0;

        for (const customer of customers) {
            try {
                // Get LAST VALID order for this customer (ignoring small replacements < 2000)
                const lastOrder = await query(`
                SELECT id, order_number, created_at, total_amount 
                FROM orders 
                WHERE siigo_customer_id = ? 
                AND total_amount >= 2000
                ORDER BY created_at DESC 
                LIMIT 1
            `, [customer.siigo_id]);

                if (lastOrder.length === 0) continue;

                const order = lastOrder[0];

                // Get items for this order
                const items = await query(`
                SELECT name, product_code, discount_percent 
                FROM order_items 
                WHERE order_id = ?
            `, [order.id]);

                if (items.length === 0) continue;

                let maxDiscountFound = 0;
                let validItems = 0;

                for (const item of items) {
                    const name = (item.name || '').trim().toLowerCase();

                    // Skip Freight
                    if (name.includes('flete') || name.includes('transporte') || name.includes('envio')) continue;
                    if (item.product_code === 'FL01') continue;

                    // Use stored discount from SIIGO
                    const discountPct = Number(item.discount_percent || 0);

                    if (discountPct > 0) {
                        if (discountPct > maxDiscountFound) {
                            maxDiscountFound = discountPct;
                        }
                        validItems++;
                    }
                }

                if (validItems > 0) {
                    let newSegment = 'Minorista';
                    if (maxDiscountFound >= 20.1) {
                        newSegment = 'Distribuidor Oro';
                    } else if (maxDiscountFound >= 15) {
                        newSegment = 'Distribuidor Plata';
                    } else if (maxDiscountFound >= 4) {
                        newSegment = 'Mayorista';
                    }

                    // Update Customer
                    await query('UPDATE customers SET segment = ? WHERE id = ?', [newSegment, customer.id]);
                    updatedCount++;

                    // Log only if segment is not minorista to reduce noise, or every 50
                    if (newSegment !== 'Minorista' || updatedCount % 50 === 0) {
                        console.log(`👤 [${updatedCount}] Customer ${customer.name} (${customer.siigo_id}) -> ${newSegment} (Max Desc: ${maxDiscountFound.toFixed(1)}% on Order ${order.order_number})`);
                    }
                }

            } catch (err) {
                console.error(`❌ Error processing customer ${customer.id}:`, err.message);
                errorsCount++;
            }
        }

        console.log(`\n✅ Backfill Completed.`);
        console.log(`   Updated: ${updatedCount}`);
        console.log(`   Errors:  ${errorsCount}`);

    } catch (error) {
        console.error("Critical Error in Backfill:", error);
    } finally {
        poolEnd();
    }
}

backfill();
