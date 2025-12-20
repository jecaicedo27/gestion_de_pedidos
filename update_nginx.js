const fs = require('fs');
const path = '/etc/nginx/sites-available/gestion-pedidos.conf';

try {
    let content = fs.readFileSync(path, 'utf8');
    const oldDirective = 'try_files $uri $uri/ =404;';
    const newDirective = 'try_files $uri $uri/ /index.html;';

    if (content.includes(oldDirective)) {
        content = content.replace(oldDirective, newDirective);
        fs.writeFileSync(path, content);
        console.log('Successfully updated Nginx configuration.');
    } else {
        console.log('Target directive not found or already updated.');
    }
} catch (error) {
    console.error('Error updating Nginx config:', error);
}
