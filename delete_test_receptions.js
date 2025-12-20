const { query } = require('./backend/config/database');

async function deleteReceptions() {
    try {
        // Ver recepciones actuales
        const receptions = await query('SELECT id, supplier, invoice_number, status FROM merchandise_receptions ORDER BY id DESC LIMIT 5');
        console.log('Recepciones actuales:');
        console.table(receptions);

        // Eliminar todas las recepciones (esto también eliminará items relacionados por CASCADE)
        const result = await query('DELETE FROM merchandise_receptions');
        console.log(`\n✅ Eliminadas ${result.affectedRows} recepciones`);

        // Verificar
        const remaining = await query('SELECT COUNT(*) as count FROM merchandise_receptions');
        console.log(`Recepciones restantes: ${remaining[0].count}`);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

deleteReceptions();
