const { query } = require('./backend/config/database');

async function migrateReceptionsTable() {
    try {
        console.log('Migrating merchandise_receptions table...');

        // 1. Primero agregar nuevos valores al ENUM (manteniendo los antiguos)
        await query(
            "ALTER TABLE merchandise_receptions MODIFY COLUMN status ENUM('pending', 'completed', 'pendiente_recepcion', 'recepcionado', 'completado') DEFAULT 'pending'"
        );
        console.log('✅ ENUM values expanded');

        // 2. Actualizar datos existentes
        await query("UPDATE merchandise_receptions SET status = 'pendiente_recepcion' WHERE status = 'pending'");
        await query("UPDATE merchandise_receptions SET status = 'completado' WHERE status = 'completed'");
        console.log('✅ Existing data updated');

        // 3. Ahora eliminar valores antiguos del ENUM
        await query(
            "ALTER TABLE merchandise_receptions MODIFY COLUMN status ENUM('pendiente_recepcion', 'recepcionado', 'completado') DEFAULT 'pendiente_recepcion'"
        );
        console.log('✅ Status column finalized');

        // 4. Agregar columnas nuevas (una por una para evitar errores)
        try {
            await query("ALTER TABLE merchandise_receptions ADD COLUMN reception_notes TEXT AFTER invoice_file_path");
            console.log('✅ reception_notes added');
        } catch (e) { console.log('reception_notes already exists'); }

        try {
            await query("ALTER TABLE merchandise_receptions ADD COLUMN reception_status ENUM('ok', 'faltante', 'sobrante') AFTER reception_notes");
            console.log('✅ reception_status added');
        } catch (e) { console.log('reception_status already exists'); }

        try {
            await query("ALTER TABLE merchandise_receptions ADD COLUMN received_by INT AFTER created_by");
            console.log('✅ received_by added');
        } catch (e) { console.log('received_by already exists'); }

        try {
            await query("ALTER TABLE merchandise_receptions ADD COLUMN received_at TIMESTAMP NULL AFTER received_by");
            console.log('✅ received_at added');
        } catch (e) { console.log('received_at already exists'); }

        try {
            await query("ALTER TABLE merchandise_receptions ADD COLUMN approved_by INT AFTER received_at");
            console.log('✅ approved_by added');
        } catch (e) { console.log('approved_by already exists'); }

        try {
            await query("ALTER TABLE merchandise_receptions ADD COLUMN approved_at TIMESTAMP NULL AFTER approved_by");
            console.log('✅ approved_at added');
        } catch (e) { console.log('approved_at already exists'); }

        console.log('✅ Migration completed successfully');
        process.exit(0);

    } catch (error) {
        console.error('Error migrating table:', error);
        process.exit(1);
    }
}

migrateReceptionsTable();
