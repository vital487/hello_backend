const jwtUtils = require('./jwt')
const crypto = require('crypto')
const Joi = require('@hapi/joi')
const lib = require('../lib/lib')
const path = require('path')
const jwt = require('jsonwebtoken')
const keyPair = jwtUtils.getKeyPair('pub.key', 'priv.key')

exports.routes = (app, db) => {

    /**
     * Register user in the database
     * 
     * POST /api/register
     * 
     * {
     *  firstname: Joi.string().max(30).required(),
        surname: Joi.string().max(30).required(),
        email: Joi.string().email().required(),
        password: Joi.string().max(255).required(),
        gender: Joi.boolean().required(),
        year: Joi.number().required(),
        month: Joi.number().required(),
        day: Joi.number().required()
     * }
     */
    app.post('/api/register', (req, res) => {
        const schema = Joi.object({
            firstname: Joi.string().max(30).trim().required(),
            surname: Joi.string().max(30).trim().required(),
            email: Joi.string().email().trim().required(),
            password: Joi.string().max(255).required(),
            gender: Joi.boolean().required(),
            year: Joi.number().min(1900).required(),
            month: Joi.number().min(1).max(12).required(),
            day: Joi.number().min(1).max(31).required(),
        })

        const validSchema = schema.validate(req.body)

        //Verify if the request body content is valid
        if (validSchema.error) return res.status(400).json(validSchema.error)

        //Verify if the date sent by the user is valid
        if (!lib.isValidDate(req.body.year, req.body.month, req.body.day)) return res.status(400).send('Bad birth date')

        req.body.firstname = req.body.firstname.trim()
        req.body.surname = req.body.surname.trim()
        req.body.email = req.body.email.trim()

        //Verify if the email already exists
        let sqlEmail = 'select id from users where email = ?'

        db.query(sqlEmail, req.body.email, (err, result) => {
            if (err) return res.sendStatus(400)
            if (result.length !== 0) return res.status(400).send('Email already exists')

            //Insert user on database
            let salt = Math.ceil(Math.random() * 30);

            let passwordHash = crypto
                .createHash('sha256')
                .update(req.body.password)
                .update(salt + '')
                .digest('base64');

            let user = {
                id: null,
                firstname: req.body.firstname,
                surname: req.body.surname,
                email: req.body.email,
                password: passwordHash,
                gender: req.body.gender ? 1 : 0,
                birth: lib.toUnix(req.body.year, req.body.month, req.body.day),
                photo: 'default.png',
                salt: salt
            }

            let sql = 'insert into users set ?'

            db.query(sql, user, (err, result) => {
                if (err) return res.sendStatus(400)
                return res.status(201).json(user)
            })
        })
    })

    /**
     * Authenticate user and returns a token that he uses for authentication in other endpoints
     * POST /api/login
     * 
     * {
     *  email: Joi.string().email().required(),
        password: Joi.string().max(255).required()
     * }
     */
    app.post('/api/login', (req, res) => {
        const schema = Joi.object({
            email: Joi.string().email().trim().required(),
            password: Joi.string().max(255).required()
        })

        const validSchema = schema.validate(req.body)

        //Verify if the request body content is valid
        if (validSchema.error) return res.status(400).json(validSchema.error)

        req.body.email = req.body.email.trim()

        //Verify if the email exists
        let sqlEmail = 'select id, password, salt from users where email = ?'

        db.query(sqlEmail, req.body.email, (err, result) => {
            if (err) return res.sendStatus(403)
            if (result.length === 0) return res.sendStatus(403)

            let passwordHash = crypto
                .createHash('sha256')
                .update(req.body.password)
                .update(result[0].salt + '')
                .digest('base64');

            if (passwordHash !== result[0].password) return res.sendStatus(403)

            jwt.sign({ id: result[0].id, email: req.body.email }, keyPair.priv, { expiresIn: '10h', algorithm: 'RS256' }, (err, token) => {
                if (err) return res.sendStatus(400)
                res.status(200).json({ token })
                //Update user last action
                lib.updateUserLastActionTime(db, result[0].id)
            });
        })
    })

    /**
     * Search users based on a name
     * POST /api/search
     * 
     * {
     * name: Joi.string().required()
     * }
     * 
     * Authorization: Bearer <token>
     */
    app.post('/api/search', jwtUtils.getToken, (req, res) => {
        const schema = Joi.object({
            name: Joi.string().trim().required(),
        })

        const validSchema = schema.validate(req.body)

        //Verify if the request body content is valid
        if (validSchema.error) return res.status(400).json(validSchema.error)

        req.body.name = req.body.name.trim()

        //Verify token
        jwt.verify(req.token, keyPair.pub, (err, user) => {
            if (err) return res.sendStatus(403)

            let sql = 'select id from users where id = ? limit 1'
            db.query(sql, user.id, (err, result) => {
                if (err) return res.sendStatus(400)
                if (result.length === 0) return res.sendStatus(400)

                let sql = 'select id, firstname, surname, gender, city, country from users where concat(firstname, " ", surname) like ? and id != ? limit 30'

                db.query(sql, [`%${req.body.name}%`, user.id], (err, result) => {
                    if (err) return res.sendStatus(400)
                    res.json(result)
                    //Update user last action
                    lib.updateUserLastActionTime(db, user.id)
                })
            })
        })
    })

    /**
     * Get profile information
     * GET /api/myself
     * 
     * Authorization: Bearer <token>
     */
    app.get('/api/myself', jwtUtils.getToken, (req, res) => {
        jwt.verify(req.token, keyPair.pub, (err, user) => {
            if (err) return res.sendStatus(403)

            let sql = 'select id, firstname, surname, email, gender, birth, city, country from users where id = ?'

            db.query(sql, user.id, (err, result) => {
                if (err) return res.sendStatus(403)
                if (result === 0) return res.sendStatus(403)
                res.json(result)
                //Update user last action
                lib.updateUserLastActionTime(db, user.id)
            })
        })
    })

    /**
     * Update profile information
     * POST /api/updatemyself
     * 
     * Authorization: Bearer <token>
     */
    app.put('/api/updatemyself', jwtUtils.getToken, (req, res) => {
        const schema = Joi.object({
            firstname: Joi.string().max(30).trim().required(),
            surname: Joi.string().max(30).trim().required(),
            email: Joi.string().email().trim().required(),
            gender: Joi.boolean().required(),
            year: Joi.number().min(1900).required(),
            month: Joi.number().min(1).max(12).required(),
            day: Joi.number().min(1).max(31).required(),
            city: Joi.string().allow('').max(255).trim().required(),
            country: Joi.string().allow('').max(255).trim().required(),
        })

        const validSchema = schema.validate(req.body)

        //Verify if the request body content is valid
        if (validSchema.error) return res.status(400).json(validSchema.error)

        //Verify if the date sent by the user is valid
        if (!lib.isValidDate(req.body.year, req.body.month, req.body.day)) return res.status(400).send('Bad birth date')

        jwt.verify(req.token, keyPair.pub, (err, user) => {
            if (err) return res.sendStatus(403)

            let sql = 'select id from users where id = ? limit 1'
            db.query(sql, user.id, (err, result) => {
                if (err) return res.sendStatus(400)
                if (result.length === 0) return res.sendStatus(400)

                req.body.firstname = req.body.firstname.trim()
                req.body.surname = req.body.surname.trim()
                req.body.email = req.body.email.trim()
                req.body.city = req.body.city.trim()
                req.body.country = req.body.country.trim()
                let gender = req.body.gender ? 1 : 0

                //Verify if the email already exists
                let sqlEmail = 'select id from users where email = ?'

                db.query(sqlEmail, req.body.email, (err, result) => {
                    if (err) return res.sendStatus(400)
                    if (result.length !== 0 && result[0].id != user.id) return res.status(400).send('Email already exists')

                    let sql = 'update users set firstname = ?, surname = ?, email = ?, gender = ?, birth = ?, city = ?, country = ? where id = ?'

                    const params = [
                        req.body.firstname,
                        req.body.surname,
                        req.body.email,
                        gender,
                        lib.toUnix(req.body.year, req.body.month, req.body.day),
                        req.body.city,
                        req.body.country,
                        user.id
                    ]

                    db.query(sql, params, (err, result) => {
                        if (err) return res.sendStatus(400)
                        res.sendStatus(200)
                        //Update user last action
                        lib.updateUserLastActionTime(db, user.id)
                    })
                })
            })
        })
    })

    /**
     * Get info about one user
     */
    app.get('/api/search/:id', jwtUtils.getToken, (req, res) => {
        //Verify token
        jwt.verify(req.token, keyPair.pub, (err, user) => {
            if (err) return res.sendStatus(403)
            if (user.id === parseInt(req.params.id)) return res.sendStatus(400)

            let sql = 'select id, firstname, surname, gender, city, country from users where id = ? or id = ? limit 2'
            db.query(sql, [user.id, parseInt(req.params.id)], (err, result) => {
                if (err) return res.sendStatus(400)
                if (result.length !== 2) return res.sendStatus(400)

                let row;

                if (result[0].id === user.id) {
                    row = result[1];
                } else {
                    row = result[0];
                }

                res.json(row)
                //Update user last action
                lib.updateUserLastActionTime(db, user.id)
            })
        })
    })

    /**
     * Get token information
     * 
     * GET /api/verifytoken
     * 
     * Authorization: Bearer <token>
     */
    app.get('/api/validatetoken', jwtUtils.getToken, (req, res) => {
        jwt.verify(req.token, keyPair.pub, (err, user) => {
            if (err) return res.sendStatus(403)
            res.json({ user })
        })
    })

    /**
     * Get someones photo
     * GET /api/user/:id/img
     */
    app.get('/api/user/:id/img', (req, res) => {
        let id = parseInt(req.params.id)
        let sql = 'select photo from users where id = ?'

        db.query(sql, id, (err, result) => {
            if (err) return res.sendStatus(400)
            if (result.length === 0) return res.sendStatus(400)
            res.sendFile(path.join(__dirname + `/../img/${result[0].photo}`))
        })
    })
}