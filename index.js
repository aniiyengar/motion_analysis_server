
var express = require('express');
var bodyParser = require('body-parser');
var mongodb = require('mongodb').MongoClient;

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
app.use(bodyParser.urlencoded({ extended: true, }));

// Let client know we're live
app.get('/ping', function(req, res, next) {
    res.status(200).send('pong');
});

// Run analysis on string batch
app.get('/login', function(req, res, next) {
    // The password will be in the request body.
    User.get(req.body.username, req.body.password)
        .then(function(user) {
            res.status(200).json(user);
        })
        .catch(function() {
            res.status(500).json('There was an issue.');
        });
});

// Create user with given credentials
app.post('/signup', function(req, res, next) {
    // Password in request body as plaintext.
    User.create(req.body.username, req.body.password)
        .then(function() {
            res.status(200).send('OK');
        })
        .catch(function() {
            res.status(500).send('Nope');
        });
});

// Adds recording to user's account
app.post('/data', function(req, res, next) {
    // Data encoded as string in request
    var ts = Date.now();
    var dataString = req.body.dataString;
    var username = req.body.username;
    var password = req.body.password;

    User.updateData(username, password, dataString)
        .then(function() {
            res.status(200).send('OK');
        })
        .catch(function() {
            res.status(500).send('Nope');
        });
});

app.listen(process.env.MLTA_PORT, function() {
    console.log('Now listening on :' + process.env.MLTA_PORT);
});
