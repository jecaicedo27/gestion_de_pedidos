
const { query, poolEnd } = require('../config/database');

async function analyze() {
    try {
        console.log("🔍 Analyzing Liquimon vs Geniality Strategy...");

        // 1. Identify Products
        const products = await query(`
      SELECT id, product_name, standard_price, purchasing_price 
      FROM products 
      WHERE (product_name LIKE '%Liquimon%' OR product_name LIKE '%Geniality%' OR product_name LIKE '%Sirope%')
      AND product_name LIKE '%1000%'
    `);

        const liquimon = products.find(p => p.product_name.toLowerCase().includes('liquimon'));
        const genialiytOrSiropes = products.filter(p => !p.product_name.toLowerCase().includes('liquimon'));

        if (!liquimon) {
            console.error("❌ Could not find Liquimon 1000ml product");
            return;
        }

        console.log(`\n📌 Target Product (Liquimon): ${liquimon.product_name}`);
        console.log(`   Price: $${Number(liquimon.standard_price).toLocaleString()}`);
        console.log(`   Cost: $${Number(liquimon.purchasing_price).toLocaleString()}`);

        console.log(`\n📌 Base Products (Siropes/Geniality 1000ml):`);
        genialiytOrSiropes.forEach(p => {
            console.log(`   - ${p.product_name} | Price: $${Number(p.standard_price).toLocaleString()} | Cost: $${Number(p.purchasing_price).toLocaleString()}`);
        });

        if (genialiytOrSiropes.length === 0) {
            console.error("❌ No Siropes found");
            return;
        }

        // 2. Get Last 30 Days Stats
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const dateStr = thirtyDaysAgo.toISOString().slice(0, 19).replace('T', ' ');

        // Current Sales - Liquimon
        // Match by Name in order_items
        const liqStats = await query(`
        SELECT SUM(oi.quantity) as qty, SUM(oi.price * oi.quantity) as revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE (oi.product_name = ? OR oi.name = ?) AND o.created_at >= ? AND o.status != 'cancelado'
    `, [liquimon.product_name, liquimon.product_name, dateStr]);

        // Current Sales - Siropes (All combined)
        const siropeNames = genialiytOrSiropes.map(p => p.product_name);
        // Construct placeholders for IN clause: (?, ?, ?)
        const placeholders = siropeNames.map(() => '?').join(',');
        // Parameters: [...names, ...names, date] (for product_name check and name check)
        const params = [...siropeNames, ...siropeNames, dateStr];

        const sirStats = await query(`
        SELECT SUM(oi.quantity) as qty, SUM(oi.price * oi.quantity) as revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE (oi.product_name IN (${placeholders}) OR oi.name IN (${placeholders})) 
        AND o.created_at >= ? AND o.status != 'cancelado'
    `, params);

        const currentLiqQty = Number(liqStats[0].qty || 0);
        const currentSirQty = Number(sirStats[0].qty || 0);

        const avgLiqPrice = currentLiqQty > 0 ? (Number(liqStats[0].revenue) / currentLiqQty) : Number(liquimon.standard_price);
        const avgSirPrice = currentSirQty > 0 ? (Number(sirStats[0].revenue) / currentSirQty) : (genialiytOrSiropes.length > 0 ? Number(genialiytOrSiropes[0].standard_price) : 0);

        const liqProfitUnit = avgLiqPrice - Number(liquimon.purchasing_price || (avgLiqPrice * 0.65));
        const avgSirCost = genialiytOrSiropes.reduce((acc, p) => acc + Number(p.purchasing_price || (p.standard_price * 0.65)), 0) / genialiytOrSiropes.length;
        const sirProfitUnit = avgSirPrice - avgSirCost;

        const currentLiqProfit = currentLiqQty * liqProfitUnit;
        const currentSirProfit = currentSirQty * sirProfitUnit;
        const currentTotalProfit = currentLiqProfit + currentSirProfit;

        console.log(`\n📊 LAST 30 DAYS PERFORMANCE:`);
        console.log(`   Liquimon Sold: ${currentLiqQty} units`);
        console.log(`   Siropes Sold:  ${currentSirQty} units`);
        console.log(`   Current Ratio: 1 Liquimon for every ${(currentSirQty / (currentLiqQty || 1)).toFixed(1)} Siropes`);
        console.log(`   Total Profit (Combined): $${currentTotalProfit.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`);
        console.log(`   (Avg Profit/Unit: Liq $${liqProfitUnit.toFixed(0)}, Sir $${sirProfitUnit.toFixed(0)})`);

        // 3. Project Goal Scenario: 1 Liquimon per 2 Siropes
        const targetLiqQty = Math.ceil(currentSirQty / 2);
        const additionalLiqQty = Math.max(0, targetLiqQty - currentLiqQty);

        const additionalProfit = additionalLiqQty * liqProfitUnit;
        const projectedTotalProfit = currentTotalProfit + additionalProfit;

        console.log(`\n🎯 GOAL SCENARIO (1 Liquimon per 2 Siropes):`);
        console.log(`   Assumed Base Siropes: ${currentSirQty}`);
        console.log(`   Target Liquimon:      ${targetLiqQty} (Increase of +${additionalLiqQty})`);
        console.log(`   Projected Profit:     $${projectedTotalProfit.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`);
        console.log(`   Profit Increase:      +$${additionalProfit.toLocaleString('es-CO', { maximumFractionDigits: 0 })} (${currentTotalProfit > 0 ? ((additionalProfit / currentTotalProfit) * 100).toFixed(1) : '0'}%)`);

        // Monthly Projection
        console.log(`\n📅 MONTHLY PROJECTION:`);
        console.log(`   If you hit this target next month, you'll earn an extra $${additionalProfit.toLocaleString('es-CO', { maximumFractionDigits: 0 })} profit.`);

    } catch (error) {
        console.error("Error:", error);
    } finally {
        poolEnd();
    }
}

analyze();
