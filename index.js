
var Promise = require('bluebird');
var express = require('express');
var bodyParser = require('body-parser');
var mongodb = require('mongodb').MongoClient;
var fork = require('child_process').spawn;
var path = require('path');

var Worker = function(data) {
    return new Promise(function(resolve, reject) {
        var child = fork(
            path.join(__dirname, 'analyze/venv/bin/python3'),
            [
                path.join(__dirname, 'analyze/worker.py'),
                data
            ]
        );

        child.stderr.on('data', function(data) {
            reject(data);
        });

        child.stdout.on('data', function(data) {
            resolve(data);
        });
    })
};

var User;

mongodb.connect(
    'mongodb://localhost:27017/mlta',
    { useNewUrlParser: true },
    function(err, client) {
        if (err !== null) {
            console.error('Could not connect to DB');
            process.exit(1);
            return;
        }

        User = require('./models/user.js')(client);
        console.log('Initialized user model');
    }
);

var app = express();
app.use(bodyParser.json());

// Let client know we're live
app.get('/ping', function(req, res, next) {
    res.status(200).send('pong');
});

// Run analysis on string batch
app.get('/login', function(req, res, next) {
    // The username will be a url param
    // The password will be in the Auth Basic header
    console.log(req.get('Authorization').split('Basic')[1].trim());
    var password = req.get('Authorization').split('Basic')[1].trim();
    User.get(req.query.username, password)
        .then(function(user) {
            res.status(200).json(user);
        })
        .catch(function() {
            res.status(500).json({
                error: 'Invalid credentials.',
            });
        });
});

// Create user with given credentials
app.post('/signup', function(req, res, next) {
    // Password in request body as plaintext.
    User.create(req.body.username, req.body.password)
        .then(function() {
            User.get(req.body.username, req.body.password)
                .then(function(user) {
                    res.status(200).json(user);
                })
                .catch(function() {
                    res.status(500).json({
                        error: 'Invalid credentials...??',
                    });
                });
        })
        .catch(function() {
            res.status(500).json({
                error: 'There was a problem creating the user.'
            });
        });
});

// Adds recording to user's account
app.post('/data', function(req, res, next) {
    // Data encoded as string in request
    var ts = Date.now();
    var dataString = req.body.dataString;
    var username = req.body.username;
    var password = req.body.password;

    var newData = JSON.stringify({
        timestamp: ts,
        dataString: dataString
    });

    console.log(newData);

    User.updateData(username, password, newData)
        .then(function() {
            User.get(username, password)
                .then(function(user) {
                    res.status(200).json(user);
                })
                .catch(function() {
                    res.status(500).json({
                        error: 'Invalid credentials...??',
                    });
                });
        })
        .catch(function() {
            res.status(500).send({
                error: 'There was a problem updating the data.'
            });
        });
});

// Perform analysis on 2 seconds of data.
app.post('/analyze', function(req, res, next) {
    // Data encoded as string in request
    var dataString = req.body.dataString;

    Worker(dataString).then(function(result) {
        res
            .status(200)
            .setHeader('Content-Type', 'application/json');

        res.send(result);
    }).catch(function(err) {
        res
            .status(500)
            .setHeader('Content-Type', 'text/plain');

        res.send(err);
    });
});

app.listen(process.env.MLTA_PORT, function() {
    console.log('Now listening on :' + process.env.MLTA_PORT);
});
