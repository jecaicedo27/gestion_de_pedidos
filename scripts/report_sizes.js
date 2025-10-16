#!/usr/bin/env node
"use strict";

/**
 * Reporte de tamaños del repositorio:
 * - Top 40 archivos más grandes
 * - Top 30 directorios de primer nivel por tamaño agregado
 *
 * Nota: evita seguir enlaces simbólicos para no salir del repo.
 */

const fs = require("fs");
const path = require("path");

const root = process.cwd();

function formatBytes(bytes) {
  if (bytes === 0 || bytes === undefined || bytes === null) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const v = bytes / Math.pow(k, i);
  return `${v.toFixed(i === 0 ? 0 : 2)} ${sizes[i]}`;
}

function formatMB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(2);
}

async function walkDir(dir, fileCb) {
  let entries;
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch (e) {
    return;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    let lst;
    try {
      lst = await fs.promises.lstat(full);
    } catch (e) {
      continue;
    }

    if (lst.isSymbolicLink()) {
      // Evitar seguir enlaces simbólicos
      continue;
    }
    if (lst.isDirectory()) {
      await walkDir(full, fileCb);
    } else if (lst.isFile()) {
      await fileCb(full, lst.size);
    }
  }
}

function topLevelSegment(p) {
  const rel = path.relative(root, p);
  if (!rel || rel.startsWith("..")) return "ROOT";
  const seg = rel.split(path.sep)[0];
  return seg || "ROOT";
}

async function main() {
  const files = [];
  const started = Date.now();

  // Recolectar todos los archivos con su tamaño
  await walkDir(root, async (filePath, size) => {
    files.push({ path: filePath, size });
  });

  // Top 40 archivos más grandes
  const topFiles = files
    .slice()
    .sort((a, b) => b.size - a.size)
    .slice(0, 40);

  // Agregados por directorio de primer nivel
  const sizeByTop = new Map();
  const countByTop = new Map();

  for (const f of files) {
    const seg = topLevelSegment(f.path);
    sizeByTop.set(seg, (sizeByTop.get(seg) || 0) + f.size);
    countByTop.set(seg, (countByTop.get(seg) || 0) + 1);
  }

  const topDirs = Array.from(sizeByTop.entries())
    .map(([dir, bytes]) => ({
      dir,
      bytes,
      files: countByTop.get(dir) || 0,
    }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 30);

  // Imprimir reporte
  console.log("Top 40 largest files");
  console.log("---------------------");
  for (const f of topFiles) {
    const rel = path.relative(root, f.path) || f.path;
    console.log(`${formatMB(f.size)} MB\t${rel}`);
  }
  console.log("");

  console.log("Top 30 largest top-level directories");
  console.log("-------------------------------------");
  for (const d of topDirs) {
    console.log(
      `${formatMB(d.bytes)} MB\t${d.dir}\t(${d.files} files)`
    );
  }

  console.log("");
  console.log(
    `Analizado ${files.length} archivos en ${(Date.now() - started) / 1000}s`
  );
}

main().catch((err) => {
  console.error("Error generating size report:", err);
  process.exit(1);
});
