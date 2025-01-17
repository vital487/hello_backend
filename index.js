const db = require('./database/db').initDbConnection()
const https = require('https')
const bodyParser = require('body-parser')
const fs = require('fs');
const express = require('express')
const app = express()
const cors = require('cors')
const jwt = require('jsonwebtoken');
const keyPair = require('./lib/utils').getKeyPair('pub.key', 'priv.key')
const compression = require('compression');
const path = require('path');
const os = require('os');

//Get online users socket
let users = {};

exports.users = users;

//Add middleware that parses body that is 'application/json' to JSON and catch it's errors
app.use((req, res, next) => {
    bodyParser.json()(req, res, err => {
        if (err) return res.status(400).send('JSON is not well formed');
        next();
    });
});

//Add cors middleware
app.use(cors())

//Add compression to all routes
app.use(compression());

//app.use(express.static('public'))

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/html/index.html');
})

//Add user controller endpoints
require('./controllers/users').routes(app, db)
//Add contact controller endpoints
require('./controllers/contacts').routes(app, db)
//Add group controller endpoints
require('./controllers/groups').routes(app, db)
//Add message controller endpoints
require('./controllers/messages').routes(app, db)

//No route found
app.use(function (req, res) {
    res.sendFile(__dirname + '/html/error.html');
});

//Start HTTPS Server
const server = https.createServer({
    cert: fs.readFileSync('/etc/letsencrypt/live/hellochat.ddns.net/fullchain.pem'),
    key: fs.readFileSync('/etc/letsencrypt/live/hellochat.ddns.net/privkey.pem')
}, app)

/* const server = https.createServer({
    cert: fs.readFileSync('./fullchain1.pem'),
    key: fs.readFileSync('./privkey1.pem')
}, app) */

server.listen('444', () => {
    console.log('Server started');
});

//WEB SOCKETS

const io = require('socket.io')(server);

io.on('connection', (socket) => {
    socket.on('token', (token) => {
        jwt.verify(token, keyPair.pub, (err, user) => {
            if (err) return;

            if (typeof users[`${user.id}`] === 'undefined') {
                users[`${user.id}`] = [];
            }

            users[`${user.id}`].push(socket);

            socket.on('disconnect', () => {
                for (let i = 0; i < users[`${user.id}`].length; i++) {
                    if (users[`${user.id}`][i] === socket) {
                        users[`${user.id}`].splice(i, 1);
                        break;
                    }
                }
            });
        });
    });

    socket.on('writing', (obj) => {
        //Check if destination is online
        if (typeof users[`${obj.destination}`] !== 'undefined') {
            //Send message for every socket from destination
            for (let i = 0; i < users[`${obj.destination}`].length; i++) {
                users[`${obj.destination}`][i].emit('writing', obj.myself);
            }
        }
    });

    socket.on('stop_writing', (obj) => {
        //Check if destination is online
        if (typeof users[`${obj.destination}`] !== 'undefined') {
            //Send message for every socket from destination
            for (let i = 0; i < users[`${obj.destination}`].length; i++) {
                users[`${obj.destination}`][i].emit('stop_writing', obj.myself);
            }
        }
    });
});