const { query, poolEnd } = require('../config/database');

async function check() {
    try {
        console.log("🔍 Buscando Cliente: EL 3 DE LA PLACITA DE FLOREZ S.A.S");
        const customers = await query("SELECT id, name, identification, segment FROM customers WHERE identification LIKE '%901722422%'");

        if (customers.length === 0) {
            console.log("❌ Cliente no encontrado");
            return;
        }

        const customer = customers[0];
        console.log(`\n👤 Cliente: ${customer.name}`);
        console.log(`   ID: ${customer.identification}`);
        console.log(`   Segmento Actual: ${customer.segment || 'Sin segmento'}`);

        console.log("\n🔍 Buscando Pedido 15691...");
        const orders = await query("SELECT id, order_number, total_amount, created_at FROM orders WHERE order_number LIKE '%15691%'");

        if (orders.length === 0) {
            console.log("❌ Pedido no encontrado");
            return;
        }

        const order = orders[0];
        console.log(`\n📦 Pedido: ${order.order_number}`);
        console.log(`   Total: $${Number(order.total_amount).toLocaleString('es-CO')}`);
        console.log(`   Fecha: ${order.created_at}`);

        const items = await query("SELECT name, product_code, quantity, price FROM order_items WHERE order_id = ?", [order.id]);
        console.log(`\n📋 Items en el Pedido: ${items.length}`);

        for (const item of items) {
            console.log(`\n🔍 Producto: ${item.name}`);
            console.log(`   Cantidad: ${item.quantity}`);
            console.log(`   Precio Neto (sin IVA): $${Number(item.price).toLocaleString('es-CO')}`);

            // Buscar precio de lista
            const products = await query("SELECT product_name, standard_price FROM products WHERE product_name = ?", [item.name]);

            if (products.length > 0) {
                const listPrice = Number(products[0].standard_price);
                const soldPriceNet = Number(item.price);
                const soldPriceGross = soldPriceNet * 1.19; // Agregar IVA 19%

                console.log(`   Precio Lista (con IVA): $${listPrice.toLocaleString('es-CO')}`);
                console.log(`   Precio Venta (con IVA aprox): $${soldPriceGross.toFixed(2).toLocaleString('es-CO')}`);

                if (listPrice > 0) {
                    const discount = ((listPrice - soldPriceGross) / listPrice) * 100;
                    console.log(`   💰 DESCUENTO CALCULADO: ${discount.toFixed(2)}%`);

                    if (discount >= 20.1) {
                        console.log(`   ⭐ Categoría: Distribuidor Oro (>20%)`);
                    } else if (discount >= 15) {
                        console.log(`   🥈 Categoría: Distribuidor Plata (15-20%)`);
                    } else if (discount >= 4) {
                        console.log(`   📊 Categoría: Mayorista (4-14.9%)`);
                    } else {
                        console.log(`   🏪 Categoría: Minorista (0-3.9%)`);
                    }
                }
            } else {
                console.log(`   ⚠️ Producto no encontrado en base de datos`);
            }
        }

    } catch (error) {
        console.error("❌ Error:", error);
    } finally {
        poolEnd();
    }
}

check();
