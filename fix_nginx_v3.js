const fs = require('fs');
const path = '/etc/nginx/sites-available/gestion-pedidos.conf';

try {
    let content = fs.readFileSync(path, 'utf8');

    // Check if generic location / exists (excluding location = / or location /api/)
    // We look for "location / {" specifically
    if (!content.includes('location / {')) {
        console.log('Generic location / block is missing. Inserting it.');

        const newBlock = `
  location / {
    root /var/www/gestion_de_pedidos/frontend/build;
    index index.html index.htm;
    try_files $uri $uri/ /index.html;
  }
`;
        // Insert before location /api/
        if (content.includes('location /api/')) {
            content = content.replace('location /api/', `${newBlock}\n  location /api/`);
            fs.writeFileSync(path, content);
            console.log('Inserted location / block before /api/.');
        } else {
            console.error('Could not find location /api/ to use as insertion point.');
        }
    } else {
        console.log('Generic location / block already exists. Checking content...');
        // If it exists, make sure it has the correct try_files
        const blockStart = content.indexOf('location / {');
        const blockEnd = content.indexOf('}', blockStart);
        const block = content.substring(blockStart, blockEnd + 1);

        if (!block.includes('try_files $uri $uri/ /index.html;')) {
            console.log('Updating existing location / block with correct try_files.');
            // Simple replace for the try_files line if it exists with =404
            if (block.includes('try_files $uri $uri/ =404;')) {
                const newBlockContent = block.replace('try_files $uri $uri/ =404;', 'try_files $uri $uri/ /index.html;');
                content = content.replace(block, newBlockContent);
                fs.writeFileSync(path, content);
                console.log('Updated try_files in existing location / block.');
            } else {
                // If it doesn't have the old try_files, we might need to insert it.
                // This is trickier without regex, but let's assume standard format.
                // For now, let's just log that it needs manual check if this case hits.
                console.log('Existing block does not match expected format for simple update.');
            }
        } else {
            console.log('Location / block already has correct try_files.');
        }
    }

} catch (error) {
    console.error('Error updating Nginx config:', error);
}
