const fs = require('fs');
const path = '/etc/nginx/sites-available/gestion-pedidos.conf';

try {
    let content = fs.readFileSync(path, 'utf8');

    // The current incorrect block found via sed
    const incorrectBlock = `  location / {
    try_files $uri /index.html;
  }`;

    // The correct block with root and index
    const correctBlock = `  location / {
    root /var/www/gestion_de_pedidos/frontend/build;
    index index.html index.htm;
    try_files $uri $uri/ /index.html;
  }`;

    if (content.includes(incorrectBlock)) {
        content = content.replace(incorrectBlock, correctBlock);
        fs.writeFileSync(path, content);
        console.log('Replaced incorrect location / block with correct one including root.');
    } else {
        // Fallback: try to find it with different whitespace or if my previous script did something else
        // Let's try to match just the start and end if possible, but exact match is safer.
        // Maybe the previous script left some newlines?
        console.log('Could not find exact match for incorrect block. Attempting regex replacement.');

        const regex = /location \/ \{\s*try_files \$uri \/index\.html;\s*\}/;
        if (regex.test(content)) {
            content = content.replace(regex, correctBlock);
            fs.writeFileSync(path, content);
            console.log('Replaced block using regex.');
        } else {
            console.error('Could not find the block to replace.');
            // Debug: print what we see around location /
            const idx = content.indexOf('location / {');
            if (idx !== -1) {
                console.log('Found location / { at index ' + idx);
                console.log('Next 100 chars: ' + content.substring(idx, idx + 100));
            }
        }
    }

} catch (error) {
    console.error('Error updating Nginx config:', error);
}
