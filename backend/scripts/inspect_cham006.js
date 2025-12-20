
const { query } = require('../config/database');

const inspectItem = async () => {
    try {
        console.log('🔍 Inspecting CHAM006 in FV-2-15726...');

        const sql = `
            SELECT 
                o.order_number,
                oi.name,
                oi.quantity,
                oi.price as unit_price,
                oi.purchase_cost,
                oi.discount_percent,
                oi.profit_amount,
                (oi.quantity * oi.price) as gross_sales,
                (oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100))) as net_sales
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE o.order_number = 'FV-2-15726'
            AND (oi.name LIKE '%CHAM006%' OR oi.name LIKE '%SIROPE SKARCHAMOY DE 1000 ML%');
        `;

        const [item] = await query(sql);

        if (!item) {
            console.log('Item not found.');
            return;
        }

        console.log('\n--- Raw Data ---');
        console.log(`Product: ${item.name}`);
        console.log(`Qty: ${item.quantity}`);
        console.log(`Unit Price: $${Number(item.unit_price).toLocaleString()}`);
        console.log(`Cost: $${Number(item.purchase_cost).toLocaleString()}`);
        console.log(`Discount: ${item.discount_percent}%`);
        console.log(`Stored Profit: $${Number(item.profit_amount).toLocaleString()}`);

        console.log('\n--- Calculation Check ---');
        const price = Number(item.unit_price);
        const cost = Number(item.purchase_cost);
        const qty = Number(item.quantity);
        const discount = Number(item.discount_percent || 0);

        const theoreticalProfitNoDiscount = (price - cost) * qty;
        const theoreticalProfitWithDiscount = (price * (1 - discount / 100) - cost) * qty;

        console.log(`(Price - Cost) * Qty = ($${price} - $${cost}) * ${qty} = $${theoreticalProfitNoDiscount.toLocaleString()}`);
        console.log(`(NetPrice - Cost) * Qty = ($${price * (1 - discount / 100)} - $${cost}) * ${qty} = $${theoreticalProfitWithDiscount.toLocaleString()}`);

        if (Math.abs(theoreticalProfitNoDiscount - Number(item.profit_amount)) < 100) {
            console.log('👉 CONCLUSION: System IGNORES discount in profit calculation.');
        } else if (Math.abs(theoreticalProfitWithDiscount - Number(item.profit_amount)) < 100) {
            console.log('👉 CONCLUSION: System INCLUDES discount in profit calculation.');
        } else {
            console.log('👉 CONCLUSION: Calculation is something else.');
        }

    } catch (error) {
        console.error(error);
    } finally {
        process.exit();
    }
};

inspectItem();
