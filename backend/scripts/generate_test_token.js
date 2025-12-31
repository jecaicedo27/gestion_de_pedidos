
const jwt = require('jsonwebtoken');
require('dotenv').config();

const secret = process.env.JWT_SECRET;
const payload = {
    id: 11, // Asumiendo ID 1 es admin
    username: 'admin',
    role: 'admin'
};

const token = jwt.sign(payload, secret, { expiresIn: '1h' });
console.log(token);
