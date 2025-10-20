module.exports = {
  apps: [
    {
      name: 'gestion-backend',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'development',
        PORT: process.env.PORT || 3001
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3001
      },
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      time: true
    }
  ]
};
