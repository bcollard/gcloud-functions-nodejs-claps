'use strict';

const functions = require('firebase-functions');
const Firestore = require('@google-cloud/firestore');
const express = require('express');
const cors = require('cors');
const app = express();

const FIRESTORE_ENV = process.env.FIRESTORE_ENV
const PROJECT_ID = 'personal-218506';
const COLLECTION_NAME = 'claps';

let firestore = new Firestore({
    projectId: PROJECT_ID,
    timestampsInSnapshots: true
});

if (FIRESTORE_ENV === "local") {
    firestore.settings({
        ssl: false
    });
}


app.use(cors({ origin: true }));

app.get('/', (req, res) => {
    let referer = req.get("Referer");

    let query = firestore.collection(COLLECTION_NAME).where('url', '==', referer).limit(1);

    return query
        .get()
        .then(querySnapshot => {
            if (querySnapshot.empty) {
                console.error('No matching documents for referer: ' + referer);
                return res.send(404);
            }

            return querySnapshot.forEach(documentSnapshot => {
                let count = documentSnapshot.get('claps');
                return res.status(200).send(String(count));

            });
        })
        .catch(err => {
            console.log(err);
        });
});

app.post('/', (req, res) => {
    let referer = req.get("Referer");

    let query = firestore.collection(COLLECTION_NAME).where('url', '==', referer).limit(1);

    return query
        .get()
        .then(querySnapshot => {
            if (querySnapshot.empty) {
                // add
                firestore.collection(COLLECTION_NAME).add({'url': referer, 'claps': 1})
                    .then(docRef => {
                        return res.status(201).send("1");
                    })
                    .catch(err => {
                        console.error("something went wrong while adding an entry for referer: " + referer, err);
                    });
            } else {
                // update
                querySnapshot.forEach(documentSnapshot => {
                    let currentCount = documentSnapshot.get('claps');
                    documentSnapshot.ref.set({'claps': ++currentCount}, {merge: true})
                        .then(() => {
                            return res.status(200).send(String(currentCount));
                        })
                        .catch(err => {
                            console.error("something went wrong while updating count for referer, currentCount; " + referer + ", " + currentCount, err);
                        });    
                });
            }
        })
        .catch(err => {
            console.error(err);
            return res.send(500);
        });

});

exports.claps = functions.https.onRequest(app);
