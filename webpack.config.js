const path = require('path');

module.exports = {
    entry: './index.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'api.js'
    },
    target: 'node',
    mode: 'production',
    externals: {
        uws: "uws"
    },
};