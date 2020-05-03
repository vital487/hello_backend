const fs = require('fs');

/**
 * Generates a RSA keypair, saves them and return them. If the files already exists, read the files and return them.
 */
exports.getKeyPair = (pubFile, privFile) => {
    let keyPair = {};
    if (fs.existsSync(pubFile) && fs.existsSync(privFile)) {
        keyPair.pub = fs.readFileSync(pubFile, 'utf8');
        keyPair.priv = fs.readFileSync(privFile, 'utf8');
    } else {
        let keys = crypto.generateKeyPairSync('rsa', {
            modulusLength: 4096,
            publicKeyEncoding: {
                type: 'spki',
                format: 'pem'
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem',
                cipher: 'aes-256-cbc',
                passphrase: '5440123718'
            }
        });
        fs.writeFileSync(pubFile, keys.publicKey);
        fs.writeFileSync(privFile, keys.privateKey);
        keyPair.pub = keys.publicKey;
        keyPair.priv = keys.privateKey;
    }

    return keyPair;
}

exports.getToken = (req, res, next) => {
    const bearerHeader = req.headers['authorization'];
    if (typeof bearerHeader !== 'undefined') {
        const bearer = bearerHeader.split(' ');
        const bearerToken = bearer[1];
        req.token = bearerToken;
        next();
    } else {
        res.sendStatus(403);
    }
}