# Database Migration Guide

I have generated a complete database dump that includes the latest schema and data. This file is ready to be used to set up the database on a new server.

## Database Dump File
- **Path**: `database/schema_dump_latest.sql`
- **Size**: ~18 MB
- **Content**: Full schema (tables, views, triggers, routines) and data.

## Instructions for New Server

### 1. Prerequisities
Ensure MySQL/MariaDB is installed on the new server.

### 2. Create Database
Log in to MySQL and create the database:
```sql
CREATE DATABASE gestion_pedidos_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3. Import Dump
Run the following command from the terminal (not inside MySQL shell) to import the dump:
```bash
mysql -u [username] -p gestion_pedidos_dev < database/schema_dump_latest.sql
```
*Replace `[username]` with your MySQL username.*

### 4. Verify Import
Log in to MySQL and check that tables exist:
```sql
USE gestion_pedidos_dev;
SHOW TABLES;
```

## Configuration
Remember to update the `.env` file on the new server with the new database credentials if they differ from the current ones.
