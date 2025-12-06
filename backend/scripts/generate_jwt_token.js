const jwt = require('jsonwebtoken');

function main() {
  const [,, uidArg, usernameArg, roleArg, secretArg, expiresArg] = process.argv;

  const uid = uidArg ? Number(uidArg) : null;
  const username = usernameArg || 'user';
  const role = roleArg || 'user';
  const secret = secretArg || process.env.JWT_SECRET || '';
  const expiresIn = expiresArg || process.env.JWT_EXPIRES_IN || '24h';

  if (!uid || !secret) {
    console.error('Usage: node generate_jwt_token.js <userId> <username> <role> [secret] [expires]');
    console.error('Missing required args. uid=' + uid + ' secret_length=' + (secret ? String(secret).length : 0));
    process.exit(1);
  }

  const payload = { userId: uid, username, role };
  const token = jwt.sign(payload, secret, { expiresIn });
  process.stdout.write(token);
}

main();
