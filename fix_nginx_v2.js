const fs = require('fs');
const path = '/etc/nginx/sites-available/gestion-pedidos.conf';

try {
    let content = fs.readFileSync(path, 'utf8');

    // 1. Remove the incorrect try_files from phpmyadmin block
    const wrongPhpMyAdmin = `  location /phpmyadmin {
    root /usr/share/;
    index index.php index.html index.htm;
    try_files $uri $uri/ /index.html;`;

    const correctPhpMyAdmin = `  location /phpmyadmin {
    root /usr/share/;
    index index.php index.html index.htm;
    try_files $uri $uri/ =404;`;

    if (content.includes(wrongPhpMyAdmin)) {
        content = content.replace(wrongPhpMyAdmin, correctPhpMyAdmin);
        console.log('Fixed phpmyadmin block.');
    }

    // 2. Add try_files to root location block if missing
    // We look for the root location block start
    const rootLocationStart = `  location / {
    root /var/www/gestion_de_pedidos/frontend/build;
    index index.html index.htm;`;

    const rootLocationWithTryFiles = `  location / {
    root /var/www/gestion_de_pedidos/frontend/build;
    index index.html index.htm;
    try_files $uri $uri/ /index.html;`;

    if (content.includes(rootLocationStart) && !content.includes('try_files $uri $uri/ /index.html;')) {
        // Check if it already has try_files ... =404;
        const rootLocationOld = `  location / {
    root /var/www/gestion_de_pedidos/frontend/build;
    index index.html index.htm;
    try_files $uri $uri/ =404;`;

        if (content.includes(rootLocationOld)) {
            content = content.replace(rootLocationOld, rootLocationWithTryFiles);
            console.log('Updated root location block with correct try_files.');
        } else {
            // If it doesn't have the old try_files line exactly as expected, we might need to be more careful.
            // But based on previous reads, it likely has the old one or none if I messed up.
            // Let's try to replace the block start if the old full block isn't found but the start is.
            content = content.replace(rootLocationStart, rootLocationWithTryFiles);
            console.log('Inserted try_files into root location block.');
        }
    }

    fs.writeFileSync(path, content);
    console.log('Nginx configuration updated.');

} catch (error) {
    console.error('Error updating Nginx config:', error);
}
