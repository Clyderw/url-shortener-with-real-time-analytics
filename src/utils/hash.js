const crypto = require('crypto');

const alphabet =
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

function randomCode(length = 7) {
  const bytes = crypto.randomBytes(length);
  let code = '';

  for (const byte of bytes) {
    code += alphabet[byte % alphabet.length];
  }

  return code;
}

module.exports = { randomCode };
