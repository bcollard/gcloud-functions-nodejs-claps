// Smoke test for CI: loads the function the way the Functions Framework
// does and checks the routes that don't need Firestore. Run with `yarn test`.
'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

// index.js reads ./oauth_client_secret.json from the working directory.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claps-'));
fs.writeFileSync(path.join(dir, 'oauth_client_secret.json'),
    JSON.stringify({ web: { client_id: 'test-client', client_secret: 'test-secret' } }));
process.chdir(dir);
process.env.PROJECT_ID = 'test-project';
process.env.FIRESTORE_ENV = 'local';
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:65535'; // never reached

const { claps } = require(path.join(__dirname, '..', 'index.js'));
assert.strictEqual(typeof claps, 'function', 'index.js must export the claps handler');

function request(port, method, urlPath, headers = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request({ port, method, path: urlPath, headers }, (res) => {
            res.resume();
            res.on('end', () => resolve(res));
        });
        req.on('error', reject);
        req.end();
    });
}

const server = http.createServer(claps).listen(0, async () => {
    const { port } = server.address();
    try {
        let res = await request(port, 'GET', '/claps/secure/auth');
        assert.strictEqual(res.statusCode, 302, 'auth route redirects to Google');
        assert.match(res.headers.location, /^https:\/\/accounts\.google\.com\//);
        assert.match(res.headers.location, /client_id=test-client/);

        res = await request(port, 'DELETE', '/claps');
        assert.strictEqual(res.statusCode, 405, 'only GET and POST are accepted');

        res = await request(port, 'GET', '/claps', { Referer: 'https://evil.example/posts/x/' });
        assert.strictEqual(res.statusCode, 403, 'unknown referrers are rejected');

        res = await request(port, 'GET', '/claps/secure/auth', { Origin: 'https://baptistout.net' });
        assert.strictEqual(res.headers['access-control-allow-origin'], 'https://baptistout.net', 'CORS allows the blog');

        console.log('smoke test passed');
        server.close();
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
});
