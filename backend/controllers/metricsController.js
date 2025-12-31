const { query } = require('../config/database');

const metricsController = {
    // Get metrics for a specific month/year
    getDailyMetrics: async (req, res) => {
        try {
            const { month, year } = req.query;

            if (!month || !year) {
                return res.status(400).json({ success: false, message: 'Month and Year are required' });
            }

            // 1. Get Manual Metrics (Chats & Manual Orders)
            const metrics = await query(
                `SELECT date, chats_count, chats_start, chats_end, orders_manual_count 
                 FROM daily_metrics 
                 WHERE MONTH(date) = ? AND YEAR(date) = ?`,
                [month, year]
            );

            // 2. Get Automated Order Counts (System)
            const orderCounts = await query(
                `SELECT DATE(created_at) as date, COUNT(*) as count 
                 FROM orders 
                 WHERE MONTH(created_at) = ? AND YEAR(created_at) = ?
                 GROUP BY DATE(created_at)`,
                [month, year]
            );

            // 3. Merge Data
            const daysInMonth = new Date(year, month, 0).getDate();
            const result = [];

            // Helper to format YYYY-MM-DD
            const formatDate = (date) => date.toISOString().split('T')[0];

            // Mapping for quick lookup
            const metricsMap = {};
            metrics.forEach(m => {
                const d = typeof m.date === 'string' ? m.date : formatDate(m.date);
                metricsMap[d] = m;
            });

            const ordersMap = {};
            orderCounts.forEach(o => {
                const d = typeof o.date === 'string' ? o.date : formatDate(o.date);
                ordersMap[d] = o.count;
            });

            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

                const metric = metricsMap[dateStr] || {};

                result.push({
                    date: dateStr,
                    chats_count: metric.chats_count || 0,
                    chats_start: metric.chats_start || 0,
                    chats_end: metric.chats_end || 0,
                    orders_manual_count: metric.orders_manual_count || 0,
                    orders_system_count: ordersMap[dateStr] || 0
                });
            }

            res.json({ success: true, data: result });

        } catch (error) {
            console.error('Error fetching metrics:', error);
            res.status(500).json({ success: false, message: 'Error retrieving metrics' });
        }
    },

    // Upsert metrics for a date
    updateDailyMetric: async (req, res) => {
        try {
            const { date, chats_start, chats_end, orders_manual_count } = req.body;

            if (!date) {
                return res.status(400).json({ success: false, message: 'Date is required' });
            }

            // Calculate chats_count
            const start = parseInt(chats_start) || 0;
            const end = parseInt(chats_end) || 0;
            const total = end - start;
            // Ensure non-negative total if that logic is desired, or allow negative? Assuming non-negative for processed chats.
            // If End < Start, it might be an error or reset. But let's just do simple subtraction. 
            // Actually, "chats processed" is usually (Start + Received - End). 
            // User said: "ingresa la cantidad de chats con los que inicio... y al final del dia ingresa el total de chats"
            // Wait, usually "Start Chat Count" means unread chats at start. "End Chat Count" means unread chats at end.
            // "Chats Processed" = (Start + New Incoming - End). We simply don't have "New Incoming".
            // Let's re-read user request: "ingresa la cantidad de chats con los que inicio en whatsAPp , y al final del dia ingresa el total de chats qeu proceso."
            // Ah, user says "enter chats started with" and "enter total chats processed". NOT "chats at end".
            // Re-read carefully: "ingresa, selecciona la fecha con un calendario, ingresa la cantidad de chats con los que inicio en whatsAPp , y al final del dia ingresa el total de chats qeu proceso."
            // Wait, previous prompt said: "al final del dia ingresa el total de chats qeu proceso." (at the end of the day enter the total chats that I processed).
            // BUT earlier they said: "start inputs... end inputs... calculate total".
            // Let's stick to the MOST RECENT prompt where I confirmed: "Inicio y Fin -> Calcula Total".
            // User did not correct me when I said "El sistema restará Final - Inicio para obtener el Total Procesados".
            // Wait, if I start with 100 chats (ID??) and end at 150 (ID??), total processed is 50. This implies these are Cumulative Counters or similar.
            // I will implement TOTAL = END - START.

            // Support partial updates? No, the form will likely send all.
            // But let's handle undefineds to be safe if only updating one field (though UI should handle both).

            // To be robust, we need to fetch existing values if not provided?
            // Actually, simpler to just require all or upsert what's given.
            // Let's assumes frontend sends all relevant data for the calculation.

            const chats_count = total;

            await query(
                `INSERT INTO daily_metrics (date, chats_start, chats_end, chats_count, orders_manual_count, created_at)
                 VALUES (?, ?, ?, ?, ?, NOW())
                 ON DUPLICATE KEY UPDATE 
                    chats_start = VALUES(chats_start),
                    chats_end = VALUES(chats_end),
                    chats_count = VALUES(chats_count),
                    orders_manual_count = VALUES(orders_manual_count),
                    updated_at = NOW()`,
                [date, start, end, chats_count, orders_manual_count || 0]
            );

            res.json({ success: true, message: 'Metric updated successfully' });

        } catch (error) {
            console.error('Error updating metric:', error);
            res.status(500).json({ success: false, message: 'Error updating metric' });
        }
    }
};

module.exports = metricsController;
