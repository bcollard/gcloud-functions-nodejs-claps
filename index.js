'use strict';

const FIRESTORE_ENV = process.env.FIRESTORE_ENV

const Firestore = require('@google-cloud/firestore');

const PROJECT_ID = 'personal-218506';
const COLLECTION_NAME = 'claps';



var firestore = new Firestore({
    projectId: PROJECT_ID,
    timestampsInSnapshots: true
});

if (FIRESTORE_ENV === "local") {
    firestore.settings({
        host: "localhost:8081",
        ssl: false
    });
}




/**
* @param {!express:Request} HTTP request
* @param {!express:Response} HTTP response
*/
exports.claps = (req, res) => {

    res.set('Access-Control-Allow-Origin', '*');

    switch (req.method) {
        case 'OPTIONS': { // CORS
            res.set('Access-Control-Allow-Methods', 'GET');
            res.set('Access-Control-Allow-Headers', 'Content-Type');
            res.set('Access-Control-Max-Age', '3600');
            res.status(204).send('');
            break;
        }

        case 'POST': {
            const data = (req.body) || {};
            express.response.send("received:" + data)
            break;
        }

        case 'GET': {
            let referer = req.get("Referer");
            
            let query = firestore.collection(COLLECTION_NAME).where('url', '==', referer);

            return query
                .get()
                .then(querySnapshot => {
                    if (querySnapshot.empty) {
                        console.error('No matching documents for referer: ' + referer);
                        return res.send(404);
                    }

                    return querySnapshot.forEach(documentSnapshot => {
                        let count = documentSnapshot.get('claps');
                        res.status(200).send(String(count));

                    })
                })
                .catch(err => {
                    console.log(err);
                });
        }

        default:
            res.send(403);
            break;
    }

};