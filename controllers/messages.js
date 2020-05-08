const jwtUtils = require('./jwt')
const crypto = require('crypto')
const Joi = require('@hapi/joi')
const lib = require('../lib/lib')
const path = require('path')
const jwt = require('jsonwebtoken')
const keyPair = jwtUtils.getKeyPair('pub.key', 'priv.key')
const users = require('../index').users;

exports.routes = (app, db) => {

    /**
     * Send message to contact
     * POST /api/sendmessage
     * 
     * {
     * userId: Joi.number().required(),
        message: Joi.string().max(1000).required()
     * }
     */
    app.post('/api/sendmessage', jwtUtils.getToken, (req, res) => {
        const schema = Joi.object({
            userId: Joi.number().required(),
            message: Joi.string().max(1000).required()
        })

        const validSchema = schema.validate(req.body)

        //Verify if the request body content is valid
        if (validSchema.error) return res.status(400).json(validSchema.error)

        //Verify token
        jwt.verify(req.token, keyPair.pub, (err, user) => {
            if (err) return res.sendStatus(403)
            //If sending message to himself
            if (req.body.userId === user.id) return res.sendStatus(400)

            //Verify if there is a contact
            let sqlContact = 'select id from contacts where accepted = 1 and (from_id = ? and to_id = ? or from_id = ? and to_id = ?)'

            db.query(sqlContact, [user.id, req.body.userId, req.body.userId, user.id], (err, result) => {
                if (err) return res.sendStatus(400)
                //If contact does not exist
                if (result.length === 0) return res.sendStatus(400)

                //Send message
                let insert = 'insert into messages set ?'

                let message = {
                    id: null,
                    message: req.body.message,
                    state: 'sent',
                    from_id: user.id,
                    to_id: req.body.userId,
                    date: lib.getUnixTime()
                }

                db.query(insert, message, (err, result) => {
                    if (err) return res.sendStatus(400)
                    message.id = result.insertId
                    //Frontend uses time attribute and not date
                    message.time = message.date;   
                    res.json(message)
                    //Update user last action
                    lib.updateUserLastActionTime(db, user.id)

                    //Check if destination is online
                    if (typeof users[`${req.body.userId}`] !== 'undefined') {
                        //Send message for every socket from destination
                        for (let i = 0; i < users[`${req.body.userId}`].length; i++) {
                            users[`${req.body.userId}`][i].emit('message', message);                            
                        }
                    }
                })
            })
        })
    })

    /**
     * Get messages from contact. 'Start' value on body request tells how to retrieve the messages. If start equals to -1, retrieves 'number' messages from the last message. If start !equals to -1, retrives 'number' messages from 'start' id and 'start' id is not included.
     * POST /api/messages
     */
    app.post('/api/messages', jwtUtils.getToken, (req, res) => {
        const schema = Joi.object({
            userId: Joi.number().required(),
            start: Joi.number().required(),
            number: Joi.number().required()
        })

        const validSchema = schema.validate(req.body)

        //Verify if the request body content is valid
        if (validSchema.error) return res.status(400).json(validSchema.error)

        //Verify token
        jwt.verify(req.token, keyPair.pub, (err, user) => {
            if (err) return res.sendStatus(403)
            //If sending message to himself
            if (req.body.userId === user.id) return res.sendStatus(400)

            if (req.body.start === -1) {
                sql = 'select * from messages where from_id = ? and to_id = ? or from_id = ? and to_id = ? order by id limit ?'

                db.query(sql, [user.id, req.body.userId, req.body.userId, user.id, req.body.number], (err, result) => {
                    if (err) return res.sendStatus(400)
                    res.json(result)
                    //Update user last action
                    lib.updateUserLastActionTime(db, user.id)
                })
            } else {
                sql = 'select * from messages where (from_id = ? and to_id = ? or from_id = ? and to_id = ?) and id < ? order by id limit ?'

                db.query(sql, [user.id, req.body.userId, req.body.userId, user.id, req.body.start, req.body.number], (err, result) => {
                    if (err) return res.sendStatus(400)
                    res.json(result)
                    //Update user last action
                    lib.updateUserLastActionTime(db, user.id)
                })
            }
        })
    })

    /**
     * Retrieves all chats that we are in
     * GET /api/contactmessageinfo
     */
    app.get('/api/contactmessageinfo', jwtUtils.getToken, (req, res) => {
        //Verify token
        jwt.verify(req.token, keyPair.pub, (err, user) => {
            if (err) return res.sendStatus(403)

            //Verify if user exists
            let sqlUser = 'select id from users where id = ?'

            db.query(sqlUser, user.id, (err, result) => {
                if (err) return res.sendStatus(400)
                //If user does not exist
                if (result.length === 0) return res.sendStatus(400)

                //Get last chats
                let sql = 'select u.id, if(c.from_id = a.user, c.from_alias, c.to_alias) as name, concat(u.firstname, " ", u.surname) as realname, m.message, m.from_id, m.state, m.date as time from contacts c, users u, messages m, (select user, max(id) as id from (select id, if(from_id = ?, to_id, from_id) as user, message, state from messages where from_id = ? or to_id = ?) a group by user) a where u.id = a.user and m.id = a.id and (c.from_id = ? and c.to_id = a.user or c.from_id = a.user and c.to_id = ?)'

                db.query(sql, [user.id, user.id, user.id, user.id, user.id], (err, result) => {
                    if (err) return res.sendStatus(400)
                    res.json(result)
                    //Update user last action
                    lib.updateUserLastActionTime(db, user.id)
                })
            })
        })
    })

    /**
     * Retrieves one chat that we are in and the user id sent
     * 
     * GET /api/contactmessageinfo/:id
     */
    app.get('/api/contactmessageinfo/:id', jwtUtils.getToken, (req, res) => {
        //Verify token
        jwt.verify(req.token, keyPair.pub, (err, user) => {
            if (err) return res.sendStatus(403)
            if (user.id === parseInt(req.params.id)) return res.sendStatus(400)

            //Verify if user exists
            let sqlUser = 'select id from users where id = ?'

            db.query(sqlUser, user.id, (err, result) => {
                if (err) return res.sendStatus(400)
                //If user does not exist
                if (result.length === 0) return res.sendStatus(400)

                //Get last chats
                let sql = 'select u.id, if(c.from_id = a.user, c.from_alias, c.to_alias) as name, concat(u.firstname, " ", u.surname) as realname, m.message, m.from_id, m.state, m.date as time from contacts c, users u, messages m, (select user, max(id) as id from (select id, if(from_id = ?, to_id, from_id) as user, message, state from messages where from_id = ? and to_id = ? or to_id = ? and from_id = ?) a group by user) a where u.id = a.user and m.id = a.id and (c.from_id = ? and c.to_id = a.user or c.from_id = a.user and c.to_id = ?)'

                db.query(sql, [user.id, user.id, parseInt(req.params.id), user.id, parseInt(req.params.id), user.id, user.id], (err, result) => {
                    if (err) return res.sendStatus(400)
                    res.json(result)
                    //Update user last action
                    lib.updateUserLastActionTime(db, user.id)
                })
            })
        })
    })

    app.post('/api/receivemessages', jwtUtils.getToken, (req, res) => {
        const schema = Joi.object({
            userId: Joi.number().required()
        })

        const validSchema = schema.validate(req.body)

        //Verify if the request body content is valid
        if (validSchema.error) return res.status(400).json(validSchema.error)

        //Verify token
        jwt.verify(req.token, keyPair.pub, (err, user) => {
            if (err) return res.sendStatus(403)
            if(user.id === req.body.userId) return res.sendStatus(400)

            //Verify if contact exists
            let sqlContact = 'select id from contacts where accepted = 1 and (from_id = ? and to_id = ? or from_id = ? and to_id = ?)'

            db.query(sqlContact, [user.id, req.body.userId, req.body.userId, user.id], (err, result) => {
                if (err) return res.sendStatus(400)
                //If contact does not exist
                if (result.length === 0) return res.sendStatus(400)

                //Update messages to receive state
                let update = 'update messages set state = "received" where from_id = ? and to_id = ? and state = "sent"'

                db.query(update, [req.body.userId, user.id], (err, result) => {
                    if (err) return res.sendStatus(400)
                    res.sendStatus(200)
                    //Update user last action
                    lib.updateUserLastActionTime(db, user.id)

                    //Check if destination is online
                    if (typeof users[`${req.body.userId}`] !== 'undefined') {
                        //Send received message notification for every socket from destination
                        for (let i = 0; i < users[`${req.body.userId}`].length; i++) {
                            users[`${req.body.userId}`][i].emit('received', user.id);                            
                        }
                    }
                })
            })
        })
    })

    app.post('/api/readmessages', jwtUtils.getToken, (req, res) => {
        const schema = Joi.object({
            userId: Joi.number().required()
        })

        const validSchema = schema.validate(req.body)

        //Verify if the request body content is valid
        if (validSchema.error) return res.status(400).json(validSchema.error)

        //Verify token
        jwt.verify(req.token, keyPair.pub, (err, user) => {
            if (err) return res.sendStatus(403)
            if(user.id === req.body.userId) return res.sendStatus(400)

            //Verify if contact exists
            let sqlContact = 'select id from contacts where accepted = 1 and (from_id = ? and to_id = ? or from_id = ? and to_id = ?)'

            db.query(sqlContact, [user.id, req.body.userId, req.body.userId, user.id], (err, result) => {
                if (err) return res.sendStatus(400)
                //If contact does not exist
                if (result.length === 0) return res.sendStatus(400)

                //Update messages to receive state
                let update = 'update messages set state = "read" where from_id = ? and to_id = ? and (state = "sent" or state = "received")'

                db.query(update, [req.body.userId, user.id], (err, result) => {
                    if (err) return res.sendStatus(400)
                    res.sendStatus(200)
                    //Update user last action
                    lib.updateUserLastActionTime(db, user.id)

                    //Check if destination is online
                    if (typeof users[`${req.body.userId}`] !== 'undefined') {
                        //Send read message notification for every socket from destination
                        for (let i = 0; i < users[`${req.body.userId}`].length; i++) {
                            users[`${req.body.userId}`][i].emit('read', user.id);                            
                        }
                    }
                })
            })
        })
    })
}