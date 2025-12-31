
const { query } = require('../config/database');

async function checkCategories() {
    try {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();

        console.log(`Checking stats for Month: ${currentMonth}, Year: ${currentYear}`);

        // Debug Query
        const sql = `
            SELECT category, payment_status, COUNT(*) as count, SUM(amount) as total
            FROM expenses
            WHERE MONTH(payment_date) = ? AND YEAR(payment_date) = ?
            GROUP BY category, payment_status
        `;

        const rows = await query(sql, [currentMonth, currentYear]);
        console.table(rows);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkCategories();
