
var Promise = require('bluebird');
var bcrypt = require('bcrypt');

// This is insecure authentication.
// Not intended for production.
// Only for demo purposes.

module.exports = function(connection) {
    var db = connection.db('mlta');
    var collection = db.collection('user');

    this.get = function(username, password) {
        return new Promise(function(resolve, reject) {
            collection.find({
                username: username
            }).toArray(function(err, docs) {
                if (err !== null) {
                    reject();
                } else if (docs.length !== 1) {
                    reject();
                } else {
                    // Check if password matches
                    var match = bcrypt.compareSync(
                        password,
                        docs[0].password,
                    );
                    if (match) {
                        resolve(docs[0]);
                    } else {
                        reject()
                    }
                }
            });
        });
    };

    this.create = function(username, password) {
        // Hash password before going anywhere
        var salt = bcrypt.genSaltSync(10);
        var hash = bcrypt.hashSync(password, salt);

        return new Promise(function(resolve, reject) {
            collection.insertOne({
                username: username,
                password: hash
            }, function(err, result) {
                if (err !== null) {
                    reject();
                } else {
                    resolve(result);
                }
            });
        });
    };

    this.updateData = function(username, password, dataset) {
        return new Promise(function(resolve, reject) {
            this.get(username, password)
                .then(function(user) {
                    var currentData = JSON.parse(user.data);
                    currentData.push(dataset);
                    collection.updateOne(
                        { username: username },
                        { $set: { data: JSON.stringify(currentData) } },
                        function(err, result) {
                            if (err !== null) {
                                reject();
                            } else {
                                resolve(result);
                            }
                        }
                    );
                })
                .catch(function() {
                    reject();
                });
        });
    };

    return this;
}