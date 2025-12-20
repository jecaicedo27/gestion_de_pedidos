const { query } = require('./backend/config/database');

async function run() {
    try {
        console.log('--- Debugging Cash Balance vs Deposit Candidates ---');

        // 1. Get Cash Balance components
        console.log('\n1. Calculating Cash Balance...');

        // Inflows: Bodega
        const [bodega] = await query(`
      SELECT COALESCE(SUM(COALESCE(cr.accepted_amount, cr.amount)),0) AS total
      FROM cash_register cr
      WHERE cr.status = 'collected'
    `);
        console.log('Inflows Bodega:', bodega.total);

        // Inflows: Mensajero
        const [mensajero] = await query(`
      SELECT COALESCE(SUM(d.collected_amount),0) AS total
      FROM cash_closing_details d
      WHERE d.collection_status = 'collected'
    `);
        console.log('Inflows Mensajero:', mensajero.total);

        // Inflows: Extra Income
        const [extraIncomes] = await query(`
      SELECT COALESCE(SUM(amount),0) AS total
      FROM cartera_movements
      WHERE type = 'extra_income' AND approval_status = 'approved'
    `);
        console.log('Inflows Extra Income:', extraIncomes.total);

        // Outflows: Deposits
        const [deposits] = await query(`
      SELECT COALESCE(SUM(amount),0) AS total
      FROM cartera_deposits
    `);
        console.log('Outflows Deposits:', deposits.total);

        // Outflows: Withdrawals
        const [withdrawals] = await query(`
      SELECT COALESCE(SUM(amount),0) AS total
      FROM cartera_movements
      WHERE type = 'withdrawal' AND approval_status = 'approved'
    `);
        console.log('Outflows Withdrawals:', withdrawals.total);

        const totalInflows = Number(bodega.total) + Number(mensajero.total) + Number(extraIncomes.total);
        const totalOutflows = Number(deposits.total) + Number(withdrawals.total);
        const balance = totalInflows - totalOutflows;
        console.log('Calculated Balance (excluding base):', balance);


        // 2. Get Deposit Candidates
        console.log('\n2. Fetching Deposit Candidates...');
        const candidates = await query(`
      SELECT 
        o.id AS order_id,
        o.order_number,
        COALESCE(m.accepted_messenger,0) + COALESCE(b.accepted_bodega,0) AS accepted_total,
        COALESCE(a.assigned_total,0) AS assigned_total,
        (COALESCE(m.accepted_messenger,0) + COALESCE(b.accepted_bodega,0) - COALESCE(a.assigned_total,0)) AS expected_amount
      FROM orders o
      LEFT JOIN (
        SELECT d.order_id, SUM(COALESCE(d.collected_amount,0)) AS accepted_messenger
        FROM cash_closing_details d
        WHERE d.collection_status = 'collected'
        GROUP BY d.order_id
      ) m ON m.order_id = o.id
      LEFT JOIN (
        SELECT cr.order_id, SUM(COALESCE(cr.accepted_amount, cr.amount)) AS accepted_bodega
        FROM cash_register cr
        WHERE cr.status = 'collected'
        GROUP BY cr.order_id
      ) b ON b.order_id = o.id
      LEFT JOIN (
        SELECT cdd.order_id, SUM(cdd.assigned_amount) AS assigned_total
        FROM cartera_deposit_details cdd
        GROUP BY cdd.order_id
      ) a ON a.order_id = o.id
      WHERE (COALESCE(m.accepted_messenger,0) + COALESCE(b.accepted_bodega,0)) > COALESCE(a.assigned_total,0)
    `);

        let candidatesTotal = 0;
        candidates.forEach(c => {
            candidatesTotal += Number(c.expected_amount);
        });
        console.log(`Found ${candidates.length} candidates.`);
        console.log('Total Candidates Amount:', candidatesTotal);

        console.log('\n3. Discrepancy Analysis');
        console.log('Balance - Candidates Total:', balance - candidatesTotal);

        if (Math.abs(balance - candidatesTotal) > 100) {
            console.log('SIGNIFICANT DISCREPANCY FOUND!');
            console.log('Possible causes:');
            console.log('- Extra income not linked to orders?');
            console.log('- Withdrawals not linked to orders?');
            console.log('- Deposits not fully assigned to orders?');

            // Check unassigned deposits
            const [unassignedDeposits] = await query(`
            SELECT 
                d.id, 
                d.amount, 
                COALESCE(SUM(dd.assigned_amount), 0) as assigned_amount,
                (d.amount - COALESCE(SUM(dd.assigned_amount), 0)) as unassigned_amount
            FROM cartera_deposits d
            LEFT JOIN cartera_deposit_details dd ON d.id = dd.deposit_id
            GROUP BY d.id
            HAVING unassigned_amount > 0
        `);

            if (unassignedDeposits) { // query returns array of rows, or single row if destructured? wait, query returns [rows, fields] usually but here wrapper returns rows.
                // Actually my wrapper returns rows directly.
                // Let's re-run query to be safe with array handling
            }

            const unassignedDeps = await query(`
            SELECT 
                d.id, 
                d.amount, 
                COALESCE(SUM(dd.assigned_amount), 0) as assigned_amount,
                (d.amount - COALESCE(SUM(dd.assigned_amount), 0)) as unassigned_amount
            FROM cartera_deposits d
            LEFT JOIN cartera_deposit_details dd ON d.id = dd.deposit_id
            GROUP BY d.id
            HAVING unassigned_amount > 1
        `);

            const totalUnassignedDeposits = unassignedDeps.reduce((sum, d) => sum + Number(d.unassigned_amount), 0);
            console.log('Total Unassigned Deposits Amount:', totalUnassignedDeposits);

        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

run();
