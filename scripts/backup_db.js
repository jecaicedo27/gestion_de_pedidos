"use strict";

/**
 * Backup de la base de datos gestion_pedidos_dev usando el paquete npm 'mysqldump'
 * - Lee credenciales desde backend/.env
 * - Genera carpeta con timestamp backup_database_YYYY-MM-DDTHH-mm-ss
 * - Crea archivo SQL y adicionalmente un .sql.gz comprimido
 */

const fs = require("fs");
const path = require("path");
const mysqldump = require("mysqldump");
const dotenv = require("dotenv");
const zlib = require("zlib");
const { pipeline } = require("stream");
const { promisify } = require("util");
const pipe = promisify(pipeline);

function loadEnvFrom(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`No se encontró el archivo .env en: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, "utf8");
  return dotenv.parse(raw);
}

(async () => {
  try {
    // Cargar variables desde backend/.env
    const envPath = path.resolve(__dirname, "..", "backend", ".env");
    const env = loadEnvFrom(envPath);

    const dbHost = env.DB_HOST || "127.0.0.1";
    const dbPort = Number(env.DB_PORT || 3306);
    const dbUser = env.DB_USER || "root";
    const dbPass = env.DB_PASSWORD || "";
    const dbName = env.DB_NAME;

    if (!dbName || !dbName.trim()) {
      throw new Error("DB_NAME no definido en el .env");
    }

    // Preparar carpeta de backup con timestamp
    const ts = new Date().toISOString().replace(/:/g, "-").replace(/\..+/, "");
    const backupDirName = `backup_database_${ts}`;
    const backupDir = path.join(process.cwd(), backupDirName);
    fs.mkdirSync(backupDir, { recursive: true });

    const dumpPath = path.join(backupDir, `${dbName}.sql`);
    const gzPath = path.join(backupDir, `${dbName}.sql.gz`);

    console.log(`Iniciando backup de '${dbName}' a: ${dumpPath}`);

    // Ejecutar mysqldump (npm)
    await mysqldump({
      connection: {
        host: dbHost,
        port: dbPort,
        user: dbUser,
        password: dbPass,
        database: dbName,
      },
      dumpToFile: dumpPath,
    });

    // Verificación mínima de tamaño
    const stat = fs.statSync(dumpPath);
    if (!stat || stat.size < 1024) {
      throw new Error(`El dump parece vacío o muy pequeño: ${dumpPath} (size=${stat ? stat.size : 0})`);
    }

    // Comprimir a .gz (opcional pero útil)
    await pipe(fs.createReadStream(dumpPath), zlib.createGzip(), fs.createWriteStream(gzPath));

    console.log(`Backup SQL creado: ${dumpPath}`);
    console.log(`Backup comprimido (gz) creado: ${gzPath}`);
    console.log(`Carpeta de backup: ${backupDir}`);

    // Salida final
    console.log(JSON.stringify({ ok: true, backupDir, dumpPath, gzPath }, null, 2));
  } catch (err) {
    console.error("ERROR realizando backup:", err && err.message ? err.message : err);
    process.exit(1);
  }
})();
