'use strict';

const functions = require('firebase-functions');
const Firestore = require('@google-cloud/firestore');
const express = require('express');
const cors = require('cors');
const app = express();
const isAbsUrl = require('is-absolute-url');

const FIRESTORE_ENV = process.env.FIRESTORE_ENV;
const PROJECT_ID = process.env.PROJECT_ID;
const COLLECTION_NAME = 'claps';

const IP_COUNT_GET_MAP = [];
const IP_COUNT_POST_MAP = [];
const MAX_GET_PER_IP = 1000;
const MAX_POST_PER_IP = 100;

let firestore = new Firestore({
    projectId: PROJECT_ID,
    timestampsInSnapshots: true
});

if (FIRESTORE_ENV === "local") {
    firestore.settings({
        ssl: false
    });
}


// Accept only POST or GET
app.use((req, res, next) => {
    if (req.method != "POST" && req.method != "GET") return res.sendStatus(405);
    next();
});


// CORS
var corsWhitelist = ['http://localhost:1313', 'https://www.baptistout.net']
var corsOptions = {
    origin: function (origin, callback) {
        if (corsWhitelist.indexOf(origin) !== -1) {
            callback(null, true)
        } else {
            callback(null, false)
        }
    }
}
app.use(cors(corsOptions));


// Referrer validation
app.use((req, res, next) => {
    let referer = req.get("Referer");
    if ( ! checkUrl(referer)) { return res.sendStatus(403) };
    next();
});


// manual request limiting - GET
app.get('/', (req, res, next) => {
    let IP = req.ip;
    if (FIRESTORE_ENV == undefined) {
        IP = req.headers['x-forwarded-for']
    } 
    
    var currentCount = IP_COUNT_GET_MAP[IP];
    if (currentCount && typeof(currentCount) === "number" && currentCount > MAX_GET_PER_IP) {
        console.info("Reached request limit for IP: " + IP + ", method GET, count: " + currentCount + ", Referer: " + req.get("Referer"));
        return res.sendStatus(429);
    } else {
        if (currentCount == undefined) {
            IP_COUNT_GET_MAP[IP] = new Number(1);
        } else {
            IP_COUNT_GET_MAP[IP] = ++currentCount;
        }
    }
    // randomly log the IP table, around 10% of calls
    if (Math.floor(Math.random() *10) == 5) {
        console.log("HTTP GET - IP MAP:");
        console.table(IP_COUNT_GET_MAP);
    }

    next();
});
// manual request limiting - POST
app.post('/', (req, res, next) => {
    let IP = req.ip;
    if (FIRESTORE_ENV == undefined) {
        IP = req.headers['x-forwarded-for']
    }

    var currentCount = IP_COUNT_POST_MAP[IP];
    if (currentCount && typeof(currentCount) === "number" && currentCount > MAX_POST_PER_IP) {
        console.info("Reached request limit for IP: " + IP + ", method POST, count: " + currentCount + ", Referer: " + req.get("Referer"));
        return res.sendStatus(429);
    } else {
        if (currentCount == undefined) {
            IP_COUNT_POST_MAP[IP] = new Number(1);
        } else {
            IP_COUNT_POST_MAP[IP] = ++currentCount;
        }
    }
    // randomly log the IP table, around 10% of calls
    if (Math.floor(Math.random() *10) == 5) {
        console.log("HTTP POST - IP MAP:");
        console.table(IP_COUNT_POST_MAP);
    }

    next();
});


// GET
app.get('/', (req, res) => {
    let referer = req.get("Referer");
    let query = firestore.collection(COLLECTION_NAME).where('url', '==', referer).limit(1);

    return query
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
            return res.send(500);
        });
});


// POST
app.post('/', (req, res) => {
    let referer = req.get("Referer");
    let query = firestore.collection(COLLECTION_NAME).where('url', '==', referer).limit(1);

    return query
        .get()
        .then(querySnapshot => {
            if (querySnapshot.empty) {
                // add
                return firestore.collection(COLLECTION_NAME).add({'url': referer, 'claps': 1})
                    .then(docRef => {
                        return res.status(200).send("1");
                    })
                    .catch(err => {
                        console.error("something went wrong while adding an entry for referer: " + referer, err);
                        return res.send(500);
                    });
            } else {
                // update
                return querySnapshot.forEach(documentSnapshot => {
                    let currentCount = documentSnapshot.get('claps');
                    documentSnapshot.ref.set({'claps': ++currentCount}, {merge: true})
                        .then(() => {
                            return res.status(200).send(String(currentCount));
                        })
                        .catch(err => {
                            console.error("something went wrong while updating count for referer, currentCount; " + referer + ", " + currentCount, err);
                            return res.send(500);
                        });    
                });
            }
        })
        .catch(err => {
            console.error(err);
            return res.send(500);
        });

});

function checkUrl(url) {
    if (! isAbsUrl(url)) return false;

    let result = false;
    let whitelist = [ /^https:\/\/www.baptistout.net\/posts\/[\w\d-]+\/?$/g ];
    if (FIRESTORE_ENV === "local") whitelist.push( /^http:\/\/localhost:1313\/posts\/[\w\d-]+\/?$/g );
    
    whitelist.forEach(u => {
        result = result || url.match(u);
    });

    return result;
}

exports.claps = functions.https.onRequest(app);
