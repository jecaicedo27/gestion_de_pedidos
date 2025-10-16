#!/usr/bin/env node
"use strict";

/**
 * Limpieza del repositorio (Opción A segura):
 * - Elimina:
 *   1) frontend/node_modules/.cache
 *   2) backup_database_* (carpetas en raíz)
 *   3) frontend/build
 *   4) .git_disabled
 *   5) gestion_pedidos_dev.sql
 *
 * No toca node_modules.
 */

const fs = require("fs");
const path = require("path");

const root = process.cwd();

async function exists(p) {
  try {
    await fs.promises.lstat(p);
    return true;
  } catch {
    return false;
  }
}

async function isDir(p) {
  try {
    const st = await fs.promises.lstat(p);
    return st.isDirectory();
  } catch {
    return false;
  }
}

async function rmrf(p) {
  try {
    await fs.promises.rm(p, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  } catch (e) {
    // Algunos Node antiguos no soportan fs.rm, fallback a rmdir/unlink
    try {
      if (await isDir(p)) {
        await fs.promises.rmdir(p, { recursive: true });
      } else {
        await fs.promises.unlink(p);
      }
    } catch (e2) {
      throw e2;
    }
  }
}

async function findBackupDirs() {
  const entries = await fs.promises.readdir(root, { withFileTypes: true });
  return entries
    .filter((d) => d.isDirectory() && /^backup_database_/i.test(d.name))
    .map((d) => path.join(root, d.name));
}

async function main() {
  const targets = [
    path.join(root, "frontend", "node_modules", ".cache"),
    path.join(root, "frontend", "build"),
    path.join(root, ".git_disabled"),
    path.join(root, "gestion_pedidos_dev.sql"),
  ];

  const backupDirs = await findBackupDirs();
  targets.push(...backupDirs);

  const removed = [];
  const skipped = [];
  const errors = [];

  for (const t of targets) {
    const rel = path.relative(root, t) || t;
    if (!(await exists(t))) {
      skipped.push(`${rel} (no existe)`);
      continue;
    }
    try {
      await rmrf(t);
      removed.push(rel);
    } catch (e) {
      errors.push(`${rel} -> ${e.message || e}`);
    }
  }

  console.log("Limpieza completada (Opción A)");
  console.log("------------------------------");
  if (removed.length) {
    console.log("Eliminados:");
    removed.forEach((r) => console.log(" - " + r));
  } else {
    console.log("No se eliminaron elementos.");
  }
  if (skipped.length) {
    console.log("\nOmitidos:");
    skipped.forEach((s) => console.log(" - " + s));
  }
  if (errors.length) {
    console.log("\nErrores:");
    errors.forEach((er) => console.log(" - " + er));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Error en limpieza:", err);
  process.exit(1);
});
