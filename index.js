'use strict';

const functions = require('firebase-functions');
const { Firestore } = require('@google-cloud/firestore');
const express = require('express');
const cors = require('cors');
const app = express();
const isAbsUrl = require('is-absolute-url');
const rateLimiter = require('redis-rate-limiter');
const redis = require('redis');
const fs = require('fs');
const { google } = require('googleapis');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const FIRESTORE_ENV = process.env.FIRESTORE_ENV;
const PROJECT_ID = process.env.PROJECT_ID;
const COLLECTION_NAME = 'claps';

const IP_COUNT_GET_MAP = {};
const IP_COUNT_POST_MAP = {};
const MAX_GET_PER_IP = 1000;
const MAX_POST_PER_IP = 200;
const SUPER_USER_MAIL_ADDRESS = process.env.SUPER_USER_MAIL_ADDRESS;

const firestore = new Firestore({
    projectId: PROJECT_ID,
    timestampsInSnapshots: true
});

var REDIS_HOST = "localhost"
var OAUTH_REDIRECT_URI = "http://localhost:8080/secure/oauthcallback"
let REFERRER_WHITELIST = [/^https:\/\/baptistout.net\/posts\/[\w\d-]+\/?#?[\w\d-_\?&=]*$/g, /^https:\/\/accounts.google.com\/[\w\d-]+\/?#?[\w\d-_\?&=]*$/g];
var CORS_WHITELIST = ['https://baptistout.net']

// ENV SETTINGS
if (FIRESTORE_ENV === "local") {
    firestore.settings({
        ssl: false, 
        host: "localhost",
        port: 8081
    });
    CORS_WHITELIST.push('http://localhost:1313');
    REFERRER_WHITELIST.push(/^http:\/\/localhost:1313\/posts\/[\w\d-]+\/?#?[\w\d-_\?&=]*$/g);
} else {
    REDIS_HOST = process.env.REDIS_HOST
    OAUTH_REDIRECT_URI = process.env.OAUTH_REDIRECT_URI;
}

// OAuth2 config
const clientSecretJson = JSON.parse(fs.readFileSync('./oauth_client_secret.json'));
const oauth2Client = new google.auth.OAuth2(
    clientSecretJson.web.client_id,
    clientSecretJson.web.client_secret,
    OAUTH_REDIRECT_URI
);

const client = jwksClient({
    jwksUri: 'https://www.googleapis.com/oauth2/v3/certs'
});

function getKey(header, callback) {
    client.getSigningKey(header.kid, function (err, key) {
        var signingKey = key.publicKey || key.rsaPublicKey;
        callback(null, signingKey);
    });
}

// Redis config
//var redisClient = redis.createClient(6379, REDIS_HOST, { enable_offline_queue: false });


// Accept only POST or GET
app.use((req, res, next) => {
    if (req.method != "POST" && req.method != "GET") return res.sendStatus(405);
    next();
});


// CORS
var corsOptions = {
    origin: function (origin, callback) {
        if (CORS_WHITELIST.indexOf(origin) !== -1) {
            callback(null, true)
        } else {
            callback(null, false)
        }
    }
}
app.use(cors(corsOptions));


// Referrer validation
app.use((req, res, next) => {
    let referrer = req.get("Referer");
    if (referrer !== undefined && !validReferrer(referrer)) { 
        console.warn("forbidding referrer: " + referrer);
        return res.sendStatus(403);
    };
    next();
});


// REDIS rate-limiting
// var redisMiddleware = rateLimiter.middleware({
//     redis: redisClient,
//     //key: 'ip',
//     key: function (req) {
//         return req.headers['x-forwarded-for']
//     },
//     rate: '10/second'
// });
// app.use(redisMiddleware);


// manual request limiting - GET
app.get('/claps', (req, res, next) => {
    let IP = req.ip;
    if (FIRESTORE_ENV == undefined) {
        IP = req.headers['x-forwarded-for']
    }

    var currentCount = IP_COUNT_GET_MAP[IP];
    if (currentCount && typeof (currentCount) === "number" && currentCount > MAX_GET_PER_IP) {
        console.info("Reached request limit for IP: " + IP + ", method GET, count: " + currentCount + ", Referer: " + req.get("Referer"));
        return res.sendStatus(429);
    } else {
        if (currentCount == undefined) {
            IP_COUNT_GET_MAP[IP] = new Number(1);
        } else {
            IP_COUNT_GET_MAP[IP] = ++currentCount;
        }
    }

    next();
});
// manual request limiting - POST
app.post('/claps', (req, res, next) => {
    let IP = req.ip;
    if (FIRESTORE_ENV == undefined) {
        IP = req.headers['x-forwarded-for']
    }

    var currentCount = IP_COUNT_POST_MAP[IP];
    if (currentCount && typeof (currentCount) === "number" && currentCount > MAX_POST_PER_IP) {
        console.info("Reached request limit for IP: " + IP + ", method POST, count: " + currentCount + ", Referer: " + req.get("Referer"));
        return res.sendStatus(429);
    } else {
        if (currentCount == undefined) {
            IP_COUNT_POST_MAP[IP] = new Number(1);
        } else {
            IP_COUNT_POST_MAP[IP] = ++currentCount;
        }
    }

    next();
});


// GET
app.get('/claps', (req, res) => {
    let referer = req.get("Referer");
    let query = firestore.collection(COLLECTION_NAME).where('url', '==', referer).limit(1);

    try {
        query
            .get()
            .then(querySnapshot => {
                if (querySnapshot.empty) {
                    console.info('No matching documents for referer: ' + referer);
                    return res.status(200).send("0");
                }

                return querySnapshot.forEach(documentSnapshot => {
                    let count = documentSnapshot.get('claps');
                    return res.status(200).send(String(count));

                });
            })
            .catch(err => {
                console.error(err);
                return res.sendStatus(500);
            });
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
});


// POST
app.post('/claps', (req, res) => {
    let referer = req.get("Referer");
    let query = firestore.collection(COLLECTION_NAME).where('url', '==', referer).limit(1);

    try {
        query
            .get()
            .then(querySnapshot => {
                if (querySnapshot.empty) {
                    // add
                    return firestore.collection(COLLECTION_NAME).add({ 'url': referer, 'claps': 1 })
                        .then(docRef => {
                            return res.status(200).send("1");
                        })
                        .catch(err => {
                            console.error("something went wrong while adding an entry for referer: " + referer, err);
                            return res.sendStatus(500);
                        });
                } else {
                    // update
                    return querySnapshot.forEach(documentSnapshot => {
                        let currentCount = documentSnapshot.get('claps');
                        documentSnapshot.ref.set({ 'claps': ++currentCount }, { merge: true })
                            .then(() => {
                                return res.status(200).send(String(currentCount));
                            })
                            .catch(err => {
                                console.error("something went wrong while updating count for referer, currentCount; " + referer + ", " + currentCount, err);
                                return res.sendStatus(500);
                            });
                    });
                }
            })
            .catch(err => {
                console.error(err);
                return res.sendStatus(500);
            });
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }


});

// Referrer check, if present (cannot force it because of the OAuth callback)
function validReferrer(url) {
    if (!isAbsUrl(url)) return false;

    let result = false;

    REFERRER_WHITELIST.forEach(u => {
        result = result || url.match(u);
    });

    return result;
}


// OAUTH
// init code grant flow
app.get('/claps/secure/auth', (req, res) => {
    const scopes = [
        'openid', 'email'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'online',
        scope: scopes
    });
    res.redirect(authUrl);
});
// code grant callback
app.get('/claps/secure/oauthcallback', (req, res) => {
    const code = req.query.code;

    return new Promise((resolve, reject) => {
        oauth2Client.getToken(code, (err, token) => {
            if (err) {
                return reject(err);
            }
            return resolve(token);
        });
    })
        .then((tokens) => {
            try {
                jwt.verify(tokens.id_token, getKey, { issuer: 'https://accounts.google.com' }, (err, decoded) => {
                    if (decoded.email === SUPER_USER_MAIL_ADDRESS) {
                        return res.status(200).send({
                            "IP_COUNT_POST_MAP": IP_COUNT_POST_MAP,
                            "IP_COUNT_GET_MAP": IP_COUNT_GET_MAP
                        });
                    }
                    else {
                        return res.sendStatus(403);
                    }
                });
            } catch (err) {
                console.error("error verifying the ID token: " + err);
                return res.sendStatus(403);
            }
        })
        .catch((err) => {
            console.error(err);
            return res.sendStatus(500);
        });

});


exports.claps = functions.https.onRequest(app);
