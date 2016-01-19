var array = require('lodash/array');
var Promise = require('bluebird');
var format = require('util').format;
var _ = require('lodash');

var TennuTell = {
    requiresRoles: ['dbcore', 'dblogger'],
    configDefaults: {
        "tell": {
            "maxAtOnce": 10,
            "floodDelay": 1200
        },
    },
    init: function(client, imports) {

        const dbTellPromise = imports.dbcore.then(function(knex) {
            // tell.js will return a promise as it fetches all unread tells
            return require('./lib/tell')(knex, client).then(function(tell) {
                return tell;
            });
        });

        const helps = {
            "tell": [
                "Save a tell for a user(s).",
                "{{!}}tell <nick1[,<nick2>,<nick3>]> <message>",
                "Example:",
                '{{!}}tell JaneDoe,FarmerGuy Hello World'
            ]
        };

        var tellConfig = client.config("tell");

        function emitTellRecursively(IRCMessage, response, type) {
            if (type === 'nonquery') {
                client.say(IRCMessage.channel, response);
            }
            if (type === 'query') {
                client.say(IRCMessage.nickname, response);
            }
        }

        function recurse(IRCMessage, messages, type) {
            emitTellRecursively(IRCMessage, messages.shift(), type);
            if (messages.length !== 0) {
                setTimeout(function() {
                    recurse(IRCMessage, messages, type)
                }, tellConfig.floodDelay);
            }
        }

        return {
            handlers: {
                "privmsg": function(IRCMessage) {
                    dbTellPromise.then(function(tell) {
                        tell.emit(IRCMessage.nickname, client._logger.error).then(function(responses) {

                            if (responses.nonquery) {
                                setTimeout(function() {
                                    recurse(IRCMessage, responses.nonquery.message, 'nonquery')
                                }, tellConfig.floodDelay);
                            }
                            if (responses.query) {
                                setTimeout(function() {
                                    recurse(IRCMessage, responses.query.message, 'query')
                                }, tellConfig.floodDelay);
                            }

                        }).catch(function(err) {
                            if (err.type !== 'tell.notells') {
                                client._logger.error(err);
                            }
                        });
                    });
                },
                "!tell": function(IRCMessage) {
                    return Promise.try(function() {

                        // Validate input
                        if (IRCMessage.args.length < 2) {
                            throw new Error(helps.tell);
                        }
                        if (IRCMessage.args[0].toLowerCase().indexOf(client.nickname().toLowerCase()) !== -1) {
                            throw new Error('You may not record a tell for the bot.');
                        }
                        var targetUsers = array.uniq(IRCMessage.args[0].split(','));
                        if (targetUsers.length > tellConfig.maxAtOnce) {
                            throw new Error(format('You can not store more than %s tells at once.', tellConfig.maxAtOnce));
                        }
                        if (targetUsers.indexOf('') !== -1 || targetUsers.indexOf(' ') !== -1) {
                            throw new Error('Target NickName must not be null or empty.');
                        }

                        // Save and notice.
                        return dbTellPromise.then(function(tell) {
                            var message = IRCMessage.args.slice(1, IRCMessage.args.length).join(' ');
                            return tell.save(IRCMessage.nickname, targetUsers, IRCMessage.isQuery, message).then(function(savedTells) {
                                return Promise.map(savedTells, function(savedTell) {
                                    return savedTell.ToNick;
                                }).then(function(nicks) {
                                    var isPlural = '';
                                    if (nicks.length > 1) {
                                        isPlural = 's';
                                    }
                                    var isPrivate = '';
                                    if (IRCMessage.isQuery) {
                                        isPrivate = 'private ';
                                    }
                                    return {
                                        intent: 'notice',
                                        query: true,
                                        message: format('Saved %stell%s for: %s.', isPrivate, isPlural, nicks.join(', '))
                                    };
                                });
                            });
                        });
                    }).catch(function(err){
                        return {
                            intent: 'notice',
                            query: true,
                            message: err
                        };
                    });
                }
            },

            help: {
                "!tell": helps.tell
            },

            commands: ["tell"]
        }
    }
};

module.exports = TennuTell;