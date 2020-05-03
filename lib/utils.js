const fs = require('fs');
const crypto = require('crypto')
const jwt = require('jsonwebtoken')

/**
 * Retorna objeto com day, month e year.
 */
exports.unixToDate = function unixToDate(unix) {
    let obj = {};
    let date = new Date(unix);
    obj.day = date.getDate();
    obj.month = date.getMonth() + 1;
    obj.year = date.getFullYear();
    obj.hour = date.getHours();
    obj.minutes = date.getMinutes();
    return obj;
}

exports.getUnixTime = () => {
    return Math.ceil(Date.now() / 1000)
}

exports.toUnix = (year, month, day) => {
    return new Date(`${year}.${month}.${day}`).getTime() / 1000
}

/**
 * Generates a RSA keypair, saves them and return them. If the files already exists, read the files and return them.
 */
exports.getKeyPair = (pubFile, privFile) => {
    let keyPair = {}
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

/**
 * Gets and verifies a JWT Token
 */
exports.getVerifyToken = (req, res, next) => {
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

/**
 * Generates new JWT based in a object
 */
exports.generateToken = (res, data, next) => {
    const keyPair = require('../index').keyPair
    jwt.sign(data, { key: keyPair.priv, passphrase: '5440123718' }, { expiresIn: '1y', algorithm: 'RS256' }, (err, token) => {
        if (err) return res.status(403)
        next(token)
    });
}

/**
 * Validate a schema
 */
exports.validateSchema = (req, res, schema, next) => {
    const validSchema = schema.validate(req.body)
    if (validSchema.error) return res.status(400).json(validSchema.error)
    next()
}

exports.isNumber = (n) => {
    return !isNaN(parseFloat(n)) && !isNaN(n - 0)
}