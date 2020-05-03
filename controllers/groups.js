const jwtUtils = require('./jwt')
const crypto = require('crypto')
const Joi = require('@hapi/joi')
const lib = require('../lib/lib')
const path = require('path')
const jwt = require('jsonwebtoken')
const keyPair = jwtUtils.getKeyPair('pub.key', 'priv.key')

exports.routes = (app, db) => {


    /**
     * Create group
     * POST /api/creategroup
     * 
     * Authorization: Bearer <token>
     */
    app.post('/api/creategroup', jwtUtils.getToken, (req, res) => {
        const schema = Joi.object({
            name: Joi.string().max(60).required(),
        })

        const validSchema = schema.validate(req.body)

        //Verify if the request body content is valid
        if (validSchema.error) return res.status(400).json(validSchema.error)

        //Verify token
        jwt.verify(req.token, keyPair.pub, (err, user) => {
            if (err) return res.sendStatus(403)

            let group = {
                id: null,
                name: req.body.name,
                photo: 'default.png',
                admin_id: user.id
            }

            //Create group
            let sql = 'insert into groups set ?'

            db.query(sql, group, (err, result) => {
                if (err) return res.sendStatus(400)
                group.id = result.insertedId
                res.status(201).json(group)
                //Update user last action
                lib.updateUserLastActionTime(db, user.id)
            })
        })
    })

    /**
     * Add member to group
     * POST /api/addmember
     * 
     * {
     *  groupId: Joi.number().required(),
        userId: Joi.number().required()
     * }
    
        Authorization: Bearer <token>
     */
    app.post('/api/addmember', jwtUtils.getToken, (req, res) => {
        const schema = Joi.object({
            groupId: Joi.number().required(),
            userId: Joi.number().required()
        })

        const validSchema = schema.validate(req.body)

        //Verify if the request body content is valid
        if (validSchema.error) return res.status(400).json(validSchema.error)

        //Verify token
        jwt.verify(req.token, keyPair.pub, (err, user) => {
            if (err) return res.sendStatus(403)
            if (user.id === req.body.userId) return res.sendStatus(400)

            //Check if the user is groups' admin
            let sqlAdmin = 'select admin_id from groups where id = ?'

            db.query(sqlAdmin, req.body.groupId, (err, result) => {
                if (err) return res.sendStatus(400)
                //If group does not exists
                if (result.length === 0) return res.sendStatus(400)
                //If user is not the admin
                if (result[0].admin_id !== user.id) return res.sendStatus(400)

                //Check if user to add exists
                let sqlUser = 'select id from users where id = ?'

                db.query(sqlUser, req.body.userId, (err, result) => {
                    if (err) return res.sendStatus(400)
                    if (result.length === 0) return res.sendStatus(400)

                    //Verify if user and the 'new member' are contacts
                    let sqlContact = 'select id from contacts where (from_id = ? and to_id = ? or from_id = ? and to_id = ?) and accepted = 1'

                    db.query(sqlContact, [user.id, req.body.userId, req.body.userId, user.id], (err, result) => {
                        if (err) return res.sendStatus(400)
                        if (result.length === 0) return res.sendStatus(400)

                        //Insert new member
                        let insert = 'insert into group_members set ?'

                        let member = {
                            id: null,
                            group_id: req.body.groupId,
                            user_id: req.body.userId
                        }

                        db.query(insert, member, (err, result) => {
                            if (err) return res.sendStatus(400)
                            member.id = result.insertedId
                            res.json(member)
                            //Update user last action
                            lib.updateUserLastActionTime(db, user.id)
                        })
                    })
                })
            })
        })
    })

    app.delete('/api/removemember', jwtUtils.getToken, (req, res) => {
        const schema = Joi.object({
            groupId: Joi.number().required(),
            userId: Joi.number().required()
        })

        const validSchema = schema.validate(req.body)

        //Verify if the request body content is valid
        if (validSchema.error) return res.status(400).json(validSchema.error)

        //Verify token
        jwt.verify(req.token, keyPair.pub, (err, user) => {
            if (err) return res.sendStatus(403)
            if (user.id === req.body.userId) return res.sendStatus(400)

            //Check if the user is groups' admin
            let sqlAdmin = 'select admin_id from groups where id = ?'

            db.query(sqlAdmin, req.body.groupId, (err, result) => {
                if (err) return res.sendStatus(400)
                //If group does not exists
                if (result.length === 0) return res.sendStatus(400)
                //If user is not the admin
                if (result[0].admin_id !== user.id) return res.sendStatus(400)

                //Check if user to remove from group is member
                let sqlMember = 'select * from group_members where group_id = ? and user_id = ?'

                db.query(sqlMember, [req.body.groupId, req.body.userId], (err, result) => {
                    if (err) return res.sendStatus(400)
                    //If user is not a member
                    if (result.length === 0) return res.sendStatus(400)

                    const member = result
                    //Delete member
                    let sqlDelete = 'delete from group_members where id = ?'

                    db.query(sqlDelete, result[0].id, (err, result) => {
                        if (err) return res.sendStatus(400)
                        res.json(member[0])
                        //Update user last action
                        lib.updateUserLastActionTime(db, user.id)
                    })
                })
            })
        })
    })

    app.delete('/api/leavegroup', jwtUtils.getToken, (req, res) => {
        const schema = Joi.object({
            groupId: Joi.number().required()
        })

        const validSchema = schema.validate(req.body)

        //Verify if the request body content is valid
        if (validSchema.error) return res.status(400).json(validSchema.error)

        //Verify token
        jwt.verify(req.token, keyPair.pub, (err, user) => {
            if (err) return res.sendStatus(403)
            if (user.id === req.body.userId) return res.sendStatus(400)

            //Check if the user is member
            let sqlAdmin = 'select * from group_members where group_id = ? and user_id = ?'

            db.query(sqlAdmin, [req.body.groupId, user.id], (err, result) => {
                if (err) return res.sendStatus(400)
                //If user is not a member
                if (result.length === 0) return res.sendStatus(400)

                const member = result
                //Remove member
                let sqlRemove = 'delete from group_members where id = ?'

                db.query(sqlRemove, result[0].id, (err, result) => {
                    if (err) return res.sendStatus(400)
                    res.json(member[0])
                    //Update user last action
                    lib.updateUserLastActionTime(db, user.id)
                })
            })
        })
    })

    app.put('/api/changeadmin', jwtUtils.getToken, (req, res) => {
        const schema = Joi.object({
            groupId: Joi.number().required(),
            userId: Joi.number().required()
        })

        const validSchema = schema.validate(req.body)

        //Verify if the request body content is valid
        if (validSchema.error) return res.status(400).json(validSchema.error)

        //Verify token
        jwt.verify(req.token, keyPair.pub, (err, user) => {
            if (err) return res.sendStatus(403)
            if (user.id === req.body.userId) return res.sendStatus(400)

            //Check if the user is admin
            let sqlAdmin = 'select admin_id from groups where id = ?'

            db.query(sqlAdmin, req.body.groupId, (err, result) => {
                if (err) return res.sendStatus(400)
                //If group does not exists
                if (result.length === 0) return res.sendStatus(400)
                //If user is not the admin
                if (result[0].admin_id !== user.id) return res.sendStatus(400)

                //Check if user is member
                let sqlMember = 'select id from group_members where group_id = ? and user_id = ? '

                db.query(sqlMember, [req.body.groupId, req.body.userId], (err, result) => {
                    if (err) return res.sendStatus(400)
                    //If user is not a member
                    if (result.length === 0) return res.sendStatus(400)

                    //Delete new admin from being a normal user
                    let sqlDeleteMember = 'delete from group_members where id = ?'

                    db.query(sqlDeleteMember, result[0].id, (err, result) => {
                        if (err) return res.sendStatus(400)

                        //Insert admin as normal member
                        let sqlInsertMember = 'insert into group_members set ?'

                        const member = {
                            id: null,
                            group_id: req.body.groupId,
                            user_id: user.id
                        }

                        db.query(sqlInsertMember, member, (err, result) => {
                            if (err) return res.sendStatus(400)

                            //Change admin
                            let sqlUpdateAdmin = 'update groups set admin_id = ? where id = ?'

                            db.query(sqlUpdateAdmin, [req.body.userId, req.body.groupId], (err, result) => {
                                if (err) return res.sendStatus(400)
                                res.sendStatus(200)
                                //Update user last action
                                lib.updateUserLastActionTime(db, user.id)
                            })
                        })
                    })
                })
            })
        })
    })

    app.post('/api/sendmessagegroup', jwtUtils.getToken, (req, res) => {
        const schema = Joi.object({
            message: Joi.string().max(1000).required(),
            groupId: Joi.number().required()
        })

        const validSchema = schema.validate(req.body)

        //Verify if the request body content is valid
        if (validSchema.error) return res.status(400).json(validSchema.error)

        //Verify token
        jwt.verify(req.token, keyPair.pub, (err, user) => {
            if (err) return res.sendStatus(403)

            //Check if the user is a member
            let sqlMember = 'select id from group_members where group_id = ? and user_id = ?'

            db.query(sqlMember, [req.body.groupId, user.id], (err, result) => {
                if (err) return res.sendStatus(400)

                if (result.length === 0) {
                    //Verify if user is admin
                    let sqlAdmin = 'select admin_id from groups where id = ?'

                    db.query(sqlAdmin, req.body.groupId, (err, result) => {
                        if (err) return res.sendStatus(400)
                        //If group does not exist
                        if (result.length === 0) return res.sendStatus(400)
                        //If user is not admin
                        if (result[0].admin_id !== user.id) return res.sendStatus(400)

                        //Send message
                        let insert = 'insert into group_messages set ?'

                        let message = {
                            id: null,
                            message: req.body.message.trim(),
                            from_id: user.id,
                            to_id: req.body.groupId
                        }

                        db.query(insert, message, (err, result) => {
                            if (err) return res.sendStatus(400)
                            message.id = result.insertedId
                            res.json(message)
                            //Update user last action
                            lib.updateUserLastActionTime(db, user.id)
                        })
                    })
                } else {
                    //Send message
                    let insert = 'insert into group_messages set ?'

                    let message = {
                        id: null,
                        message: req.body.message.trim(),
                        from_id: user.id,
                        to_id: req.body.groupId,
                        date: lib.getUnixTime()
                    }

                    db.query(insert, message, (err, result) => {
                        if (err) return res.sendStatus(400)
                        message.id = result.insertedId
                        res.json(message)
                        //Update user last action
                        lib.updateUserLastActionTime(db, user.id)
                    })
                }
            })
        })
    })

    /**
     * Get group photo
     * GET /api/group/:id/img
     * 
     * Authorization: Bearer <token>
     */
    app.get('/api/group/:id/img', jwtUtils.getToken, (req, res) => {
        let id = parseInt(req.params.id)

        //Verify token
        jwt.verify(req.token, keyPair.pub, (err, user) => {
            if (err) return res.sendStatus(403)

            //Verify if user is a group member
            let sqlMember = 'select * from group_members where group_id = ? and user_id = ?'

            db.query(sqlMember, [id, user.id], (err, result) => {
                if (err) return res.sendStatus(400)

                if (result.length === 0) {
                    //Check if the user is groups' admin
                    let sqlAdmin = 'select admin_id from groups where id = ?'

                    db.query(sqlAdmin, id, (err, result) => {
                        if (err) return res.sendStatus(400)
                        if (result.length === 0) return res.sendStatus(400)
                        if (result[0].admin_id !== user.id) return res.sendStatus(400)

                        //Get photo path
                        let sql = 'select photo from groups where id = ?'

                        db.query(sql, id, (err, result) => {
                            if (err) return res.sendStatus(400)
                            res.sendFile(path.join(__dirname + `/../imgg/${result[0].photo}`))
                            //Update user last action
                            lib.updateUserLastActionTime(db, user.id)
                        })
                    })
                } else {
                    //Get photo path
                    let sql = 'select photo from groups where id = ?'

                    db.query(sql, id, (err, result) => {
                        if (err) return res.sendStatus(400)
                        res.sendFile(path.join(__dirname + `/../imgg/${result[0].photo}`))
                        //Update user last action
                        lib.updateUserLastActionTime(db, user.id)
                    })
                }
            })
        })
    })
}