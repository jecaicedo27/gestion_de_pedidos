/**
 * PM2 process file for backend (Node.js)
 * Usage on server:
 *  - mkdir -p /var/www/gestion_de_pedidos && cd /var/www/gestion_de_pedidos
 *  - git clone or rsync project here, then:
 *  - npm --prefix backend ci
 *  - cp backend/.env.example backend/.env  (luego editar valores reales de producción)
 *  - mkdir -p logs
 *  - pm2 start ecosystem.config.js --env production
 *  - pm2 save
 *  - pm2 startup  (sigue las instrucciones que muestra para habilitar arranque automático)
 */
module.exports = {
  apps: [
    {
      name: 'gestion-backend',
      cwd: './backend',
      script: 'server.js',
      instances: 1,              // Cambia a 'max' o un número >1 si deseas cluster
      exec_mode: 'fork',         // Cambia a 'cluster' si usas múltiples instancias
      watch: false,
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        TZ: 'America/Bogota'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
        TZ: 'America/Bogota'
      },
      // Archivos de log (asegúrate de crear el directorio 'logs' en el root del proyecto)
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
