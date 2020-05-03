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
     * Add contact
     * POST /api/addcontact
     * 
     * {
     * id: Joi.number().required()
     * }
     */
    app.post('/api/addcontact', jwtUtils.getToken, (req, res) => {
        const schema = Joi.object({
            id: Joi.number().required(),
        })

        const validSchema = schema.validate(req.body)

        //Verify if the request body content is valid
        if (validSchema.error) return res.status(400).json(validSchema.error)

        //Verify token
        jwt.verify(req.token, keyPair.pub, (err, user) => {
            if (err) return res.sendStatus(403)
            if (user.id === req.body.id) return res.sendStatus(400)

            //Verify if both users exist
            const sqlId = 'select id, concat(firstname, " ", surname) as name from users where id = ? or id = ? limit 2'

            db.query(sqlId, [user.id, req.body.id], (err, result) => {
                if (err) return res.sendStatus(400)
                if (result.length !== 2) return res.sendStatus(400)

                const users = result
                //Verify if a contact already exists
                const sqlContact = 'select id from contacts where from_id = ? and to_id = ? or from_id = ? and to_id = ?'

                db.query(sqlContact, [user.id, req.body.id, req.body.id, user.id], (err, result) => {
                    if (err) return res.sendStatus(400)
                    if (result.length > 0) return res.sendStatus(400)

                    let contact = {
                        id: null,
                        from_id: user.id,
                        accepted: 0,
                        to_id: req.body.id,
                        from_alias: users[0].id === user.id ? users[0].name : users[1].name,
                        from_color: '#987654',
                        to_alias: users[0].id === req.body.id ? users[0].name : users[1].name,
                        to_color: '#123456'
                    }

                    //Insert the new contact
                    const insert = 'insert into contacts set ?'

                    db.query(insert, contact, (err, result) => {
                        if (err) return res.sendStatus(400)
                        contact.id = result.insertId
                        res.status(201).json(contact)
                        //Update user last action
                        lib.updateUserLastActionTime(db, user.id)

                        //Check if destination is online
                        if (typeof users[`${req.body.id}`] !== 'undefined') {
                            //Send new contact request notification for every socket from destination
                            for (let i = 0; i < users[`${req.body.id}`].length; i++) {
                                users[`${req.body.id}`][i].emit('request', user.id);
                            }
                        }
                    })
                })
            })
        })
    })

    /**
     * Remove contact
     * DELETE /api/removecontact
     * 
     * {
     * id: Joi.number().required()
     * }
     */
    app.delete('/api/removecontact', jwtUtils.getToken, (req, res) => {
        const schema = Joi.object({
            id: Joi.number().required(),
        })

        const validSchema = schema.validate(req.body)

        //Verify if the request body content is valid
        if (validSchema.error) return res.status(400).json(validSchema.error)

        //Verify token
        jwt.verify(req.token, keyPair.pub, (err, user) => {
            if (err) return res.sendStatus(403)
            if (user.id === req.body.id) return res.sendStatus(400)

            //Verify if both users exist
            const sqlId = 'select id from users where id = ? or id = ? limit 2'

            db.query(sqlId, [user.id, req.body.id], (err, result) => {
                if (err) return res.sendStatus(400)
                if (result.length !== 2) return res.sendStatus(400)

                const users = result
                //Verify if the contact exists
                const sqlContact = 'select * from contacts where from_id = ? and to_id = ? or from_id = ? and to_id'

                db.query(sqlContact, [user.id, req.body.id, req.body.id, user.id], (err, result) => {
                    if (err) return res.sendStatus(400)
                    //If there is no contact
                    if (result.length === 0) return res.sendStatus(400)
                    //If contact is not accepted
                    if (result[0].accepted[0] === 0) return res.sendStatus(400)

                    const contact = result
                    //Remove contact
                    let sqlRemove = 'delete from contacts where id = ?'

                    db.query(sqlRemove, result[0].id, (err, result) => {
                        if (err) return res.sendStatus(400)
                        res.json(contact[0])
                        //Update user last action
                        lib.updateUserLastActionTime(db, user.id)
                    })
                })
            })
        })
    })

    app.post('/api/acceptrequest', jwtUtils.getToken, (req, res) => {
        const schema = Joi.object({
            id: Joi.number().required(),
        })

        const validSchema = schema.validate(req.body)

        //Verify if the request body content is valid
        if (validSchema.error) return res.status(400).json(validSchema.error)

        //Verify token
        jwt.verify(req.token, keyPair.pub, (err, user) => {
            if (err) return res.sendStatus(403)
            if (user.id === req.body.id) return res.sendStatus(400)

            //Verify if both users exist
            const sqlId = 'select id from users where id = ? or id = ? limit 2'

            db.query(sqlId, [user.id, req.body.id], (err, result) => {
                if (err) return res.sendStatus(400)
                if (result.length !== 2) return res.sendStatus(400)

                //Verify if the request exists
                const sqlContact = 'select * from contacts where from_id = ? and to_id = ? and accepted = 0'

                db.query(sqlContact, [req.body.id, user.id], (err, result) => {
                    if (err) return res.sendStatus(400)
                    if (result.length === 0) return res.sendStatus(400)

                    const contact = result
                    //Accept contact request
                    const update = 'update contacts set accepted = 1 where id = ?'

                    db.query(update, result[0].id, (err, result) => {
                        if (err) return res.sendStatus(400)
                        contact[0].accepted[0] = 1
                        res.json(contact[0])
                        //Update user last action
                        lib.updateUserLastActionTime(db, user.id)

                        //Check if destination is online
                        if (typeof users[`${req.body.id}`] !== 'undefined') {
                            //Send new contact added notification for every socket from destination
                            for (let i = 0; i < users[`${req.body.id}`].length; i++) {
                                users[`${req.body.id}`][i].emit('contact', user.id);
                            }
                        }
                    })
                })
            })
        })
    })

    app.post('/api/declinerequest', jwtUtils.getToken, (req, res) => {
        const schema = Joi.object({
            id: Joi.number().required(),
        })

        const validSchema = schema.validate(req.body)

        //Verify if the request body content is valid
        if (validSchema.error) return res.status(400).json(validSchema.error)

        //Verify token
        jwt.verify(req.token, keyPair.pub, (err, user) => {
            if (err) return res.sendStatus(403)
            if (user.id === req.body.id) return res.sendStatus(400)

            //Verify if both users exist
            const sqlId = 'select id from users where id = ? or id = ? limit 2'

            db.query(sqlId, [user.id, req.body.id], (err, result) => {
                if (err) return res.sendStatus(400)
                if (result.length !== 2) return res.sendStatus(400)

                //Verify if the contact exists
                const sqlContact = 'select * from contacts where (from_id = ? and to_id = ? or from_id = ? and to_id = ?) and accepted = 0'

                db.query(sqlContact, [user.id, req.body.id, req.body.id, user.id], (err, result) => {
                    if (err) return res.sendStatus(400)
                    if (result.length === 0) return res.sendStatus(400)

                    const contact = result
                    //Delete contact request
                    const sqlDelete = 'delete from contacts where id = ?'

                    db.query(sqlDelete, result[0].id, (err, result) => {
                        if (err) return res.sendStatus(400)
                        res.json(contact[0])
                        //Update user last action
                        lib.updateUserLastActionTime(db, user.id)
                    })
                })
            })
        })
    })

    app.post('/api/setalias', jwtUtils.getToken, (req, res) => {
        const schema = Joi.object({
            userId: Joi.number().required(),
            idToChange: Joi.number().required(),
            alias: Joi.string().max(60).required()
        })

        const validSchema = schema.validate(req.body)

        //Verify if the request body content is valid
        if (validSchema.error) return res.status(400).json(validSchema.error)

        //Verify token
        jwt.verify(req.token, keyPair.pub, (err, user) => {
            if (err) return res.sendStatus(403)
            if (user.id === req.body.id) return res.sendStatus(400)

            //Verify if both users exist
            const sqlId = 'select id from users where id = ? or id = ? limit 2'

            db.query(sqlId, [user.id, req.body.userId], (err, result) => {
                if (err) return res.sendStatus(400)
                if (result.length !== 2) return res.sendStatus(400)

                //Verify if the contact exists and accepted
                const sqlContact = 'select * from contacts where (from_id = ? and to_id = ? or from_id = ? and to_id = ?) and accepted = 1'

                db.query(sqlContact, [user.id, req.body.userId, req.body.userId, user.id], (err, result) => {
                    if (err) return res.sendStatus(400)
                    if (result.length === 0) return res.sendStatus(400)

                    const contact = result
                    //Update alias
                    let sqlUpdate
                    if (result[0].from_id === req.body.idToChange) sqlUpdate = 'update contacts set from_alias = ? where id = ?'
                    else sqlUpdate = 'update contacts set to_alias = ? where id = ?'

                    db.query(sqlUpdate, [req.body.alias, result[0].id], (err, result) => {
                        if (err) return res.sendStatus(400)
                        if (contact[0].from_id === req.body.idToChange) contact[0].from_alias = req.body.alias
                        else contact[0].to_alias = req.body.alias
                        res.json(contact[0])
                        //Update user last action
                        lib.updateUserLastActionTime(db, user.id)
                    })
                })
            })
        })
    })

    app.post('/api/setcolor', jwtUtils.getToken, (req, res) => {
        const schema = Joi.object({
            userId: Joi.number().required(),
            idToChange: Joi.number().required(),
            color: Joi.string().max(10).required()
        })

        const validSchema = schema.validate(req.body)

        //Verify if the request body content is valid
        if (validSchema.error) return res.status(400).json(validSchema.error)

        //Verify token
        jwt.verify(req.token, keyPair.pub, (err, user) => {
            if (err) return res.sendStatus(403)
            if (user.id === req.body.id) return res.sendStatus(400)

            //Verify if both users exist
            const sqlId = 'select id from users where id = ? or id = ? limit 2'

            db.query(sqlId, [user.id, req.body.userId], (err, result) => {
                if (err) return res.sendStatus(400)
                if (result.length !== 2) return res.sendStatus(400)

                //Verify if the contact exists and accepted
                const sqlContact = 'select * from contacts where (from_id = ? and to_id = ? or from_id = ? and to_id = ?) and accepted = 1'

                db.query(sqlContact, [user.id, req.body.userId, req.body.userId, user.id], (err, result) => {
                    if (err) return res.sendStatus(400)
                    if (result.length === 0) return res.sendStatus(400)

                    const contact = result
                    //Update color
                    let sqlUpdate
                    if (result[0].from_id === req.body.idToChange) sqlUpdate = 'update contacts set from_color = ? where id = ?'
                    else sqlUpdate = 'update contacts set to_color = ? where id = ?'

                    db.query(sqlUpdate, [req.body.color, result[0].id], (err, result) => {
                        if (err) return res.sendStatus(400)
                        if (contact[0].from_id === req.body.idToChange) contact[0].from_color = req.body.color
                        else contact[0].to_color = req.body.color
                        res.json(contact[0])
                        //Update user last action
                        lib.updateUserLastActionTime(db, user.id)
                    })
                })
            })
        })
    })

    app.post('/api/setcolor', jwtUtils.getToken, (req, res) => {
        const schema = Joi.object({
            userId: Joi.number().required(),
            idToChange: Joi.number().required(),
            color: Joi.string().max(10).required()
        })

        const validSchema = schema.validate(req.body)

        //Verify if the request body content is valid
        if (validSchema.error) return res.status(400).json(validSchema.error)

        //Verify token
        jwt.verify(req.token, keyPair.pub, (err, user) => {
            if (err) return res.sendStatus(403)
            if (user.id === req.body.id) return res.sendStatus(400)

            //Verify if both users exist
            const sqlId = 'select id from users where id = ? or id = ? limit 2'

            db.query(sqlId, [user.id, req.body.userId], (err, result) => {
                if (err) return res.sendStatus(400)
                if (result.length !== 2) return res.sendStatus(400)

                //Verify if the contact exists and accepted
                const sqlContact = 'select * from contacts where (from_id = ? and to_id = ? or from_id = ? and to_id = ?) and accepted = 1'

                db.query(sqlContact, [user.id, req.body.userId, req.body.userId, user.id], (err, result) => {
                    if (err) return res.sendStatus(400)
                    if (result.length === 0) return res.sendStatus(400)

                    const contact = result
                    //Update color
                    let sqlUpdate
                    if (result[0].from_id === req.body.idToChange) sqlUpdate = 'update contacts set from_color = ? where id = ?'
                    else sqlUpdate = 'update contacts set to_color = ? where id = ?'

                    db.query(sqlUpdate, [req.body.color, result[0].id], (err, result) => {
                        if (err) return res.sendStatus(400)
                        if (contact[0].from_id === req.body.idToChange) contact[0].from_color = req.body.color
                        else contact[0].to_color = req.body.color
                        res.json(contact[0])
                        //Update user last action
                        lib.updateUserLastActionTime(db, user.id)
                    })
                })
            })
        })
    })

    app.get('/api/relationship/:id', jwtUtils.getToken, (req, res) => {
        //Verify token
        jwt.verify(req.token, keyPair.pub, (err, user) => {
            if (err) return res.sendStatus(403)
            if (user.id === parseInt(req.params.id)) return res.sendStatus(400)

            //Verify if both users exist
            const sqlId = 'select id from users where id = ? or id = ? limit 2'

            db.query(sqlId, [user.id, parseInt(req.params.id)], (err, result) => {
                if (err) return res.sendStatus(400)
                if (result.length !== 2) return res.sendStatus(400)

                //Verify if contact or request exists
                const sqlContact = 'select from_id, accepted from contacts where from_id = ? and to_id = ? or from_id = ? and to_id = ?'

                db.query(sqlContact, [user.id, parseInt(req.params.id), parseInt(req.params.id), user.id], (err, result) => {
                    if (err) return res.sendStatus(400)

                    if (result.length === 0) res.json({
                        contact: false,
                        request: false,
                        type: false
                    })

                    else if (result[0].accepted[0] === 1) res.json({
                        contact: true,
                        request: false,
                        type: false
                    })
                    else res.json({
                        contact: false,
                        request: true,
                        type: result[0].from_id === user.id
                    })

                    //Update user last action
                    lib.updateUserLastActionTime(db, user.id)
                })
            })
        })
    })

    app.get('/api/requests', jwtUtils.getToken, (req, res) => {
        //Verify token
        jwt.verify(req.token, keyPair.pub, (err, user) => {
            if (err) return res.sendStatus(403)

            //Verify if user exists
            const sqlId = 'select id from users where id = ? limit 1'

            db.query(sqlId, [user.id], (err, result) => {
                if (err) return res.sendStatus(400)
                if (result.length === 0) return res.sendStatus(400)

                //Get requests
                const sqlRequests = 'select users.id, firstname, surname, gender, city, country from contacts, users where users.id = from_id and to_id = ? and accepted = 0'

                db.query(sqlRequests, user.id, (err, result) => {
                    if (err) return res.sendStatus(400)
                    res.json(result)
                    //Update user last action
                    lib.updateUserLastActionTime(db, user.id)
                })
            })
        })
    })

    app.get('/api/contacts', jwtUtils.getToken, (req, res) => {
        //Verify token
        jwt.verify(req.token, keyPair.pub, (err, user) => {
            if (err) return res.sendStatus(403)

            //Verify if user exists
            const sqlId = 'select id from users where id = ? limit 1'

            db.query(sqlId, [user.id], (err, result) => {
                if (err) return res.sendStatus(400)
                if (result.length === 0) return res.sendStatus(400)

                //Get contacts
                const sqlRequests = 'select id, firstname, surname, gender, city, country from users where id in (select if (from_id = ?, to_id, from_id) as id from contacts where accepted = 1 and (from_id = ? or to_id = ?))'

                db.query(sqlRequests, [user.id, user.id, user.id], (err, result) => {
                    if (err) return res.sendStatus(400)
                    res.json(result)
                    //Update user last action
                    lib.updateUserLastActionTime(db, user.id)
                })
            })
        })
    })

    app.get('/api/contact/:id', jwtUtils.getToken, (req, res) => {
        //Verify token
        jwt.verify(req.token, keyPair.pub, (err, user) => {
            if (err) return res.sendStatus(403)
            if (user.id === parseInt(req.params.id)) return res.sendStatus(400)

            //Verify if both users exist
            const sqlId = 'select id from users where id = ? or id = ? limit 2'

            db.query(sqlId, [user.id, parseInt(req.params.id)], (err, result) => {
                if (err) return res.sendStatus(400)
                if (result.length === 0) return res.sendStatus(400)

                //Get contact
                const sqlRequests = 'select * from contacts where accepted = 1 and (from_id = ? and to_id = ? or from_id = ? and to_id = ?)'

                db.query(sqlRequests, [user.id, req.params.id, req.params.id, user.id], (err, result) => {
                    if (err) return res.sendStatus(400)
                    if (result.length === 0) return res.sendStatus(400)
                    res.json(result[0])
                    //Update user last action
                    lib.updateUserLastActionTime(db, user.id)
                })
            })
        })
    })

    app.get('/api/contact/:id/colors', jwtUtils.getToken, (req, res) => {
        //Verify token
        jwt.verify(req.token, keyPair.pub, (err, user) => {
            if (err) return res.sendStatus(403)
            if (user.id === parseInt(req.params.id)) return res.sendStatus(400)

            //Verify if both users exist
            const sqlId = 'select id from users where id = ? or id = ? limit 2'

            db.query(sqlId, [user.id, parseInt(req.params.id)], (err, result) => {
                if (err) return res.sendStatus(400)
                if (result.length === 0) return res.sendStatus(400)

                //Get contact
                const sqlRequests = 'select * from contacts where accepted = 1 and (from_id = ? and to_id = ? or from_id = ? and to_id = ?)'

                db.query(sqlRequests, [user.id, req.params.id, req.params.id, user.id], (err, result) => {
                    if (err) return res.sendStatus(400)
                    if (result.length === 0) return res.sendStatus(400)

                    let response = {}

                    if (result[0].from_id === user.id) {
                        response.me = result[0].from_color
                        response.other = result[0].to_color
                    } else {
                        response.me = result[0].to_color
                        response.other = result[0].from_color
                    }

                    res.json(response)
                    //Update user last action
                    lib.updateUserLastActionTime(db, user.id)
                })
            })
        })
    })

    app.get('/api/online/:id', jwtUtils.getToken, (req, res) => {
        //Verify token
        jwt.verify(req.token, keyPair.pub, (err, user) => {
            if (err) return res.sendStatus(403)
            if (user.id === parseInt(req.params.id)) return res.sendStatus(400)

            //Verify if both users exist
            const sqlId = 'select id from users where id = ? or id = ? limit 2'

            db.query(sqlId, [user.id, parseInt(req.params.id)], (err, result) => {
                if (err) return res.sendStatus(400)
                if (result.length === 0) return res.sendStatus(400)

                //Get contact
                const sqlRequests = 'select last_update from users where id in (select if (from_id = ?, to_id, from_id) as id from contacts where accepted = 1 and (from_id = ? and to_id = ? or from_id = ? and to_id = ?))'

                db.query(sqlRequests, [user.id, user.id, req.params.id, req.params.id, user.id], (err, result) => {
                    if (err) return res.sendStatus(400)
                    if (result.length === 0) return res.sendStatus(400)
                    if (result[0].last_update + 120 > lib.getUnixTime()) res.json({ online: true })
                    else res.json({ online: false })

                    //Update user last action
                    lib.updateUserLastActionTime(db, user.id)
                })
            })
        })
    })
}