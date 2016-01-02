var array = require('lodash/array');
var Promise = require('bluebird');
var format = require('util').format;

var TennuTell = {
    requiresRoles: ['dbcore', 'dblogger'],
    init: function(client, imports) {

        const dbTellPromise = imports.dbcore.then(function(knex) {
            // tell.js will return a promise as it fetches all unread tells
            return require('./tell')(knex, client).then(function(tell) {
                return tell;
            });
        });

        const helps = {
            "tell": [
                "Save a tell for a user(s).",
                "{{!}}tell <nick1[,<nick2>,<nick3>]> <message>",
                "Example:",
                '{{!}}tell JaneDoe,JohnFarmer Hello World'
            ]
        };

        var tellConfig = client.config("tell");
        if (!tellConfig || !tellConfig.hasOwnProperty('maxAtOnce')) {
            throw Error('tennu-tell: is missing some or all of its configuration.');
        }
        
        return {
            handlers: {
                "privmsg": function(IRCMessage) {
                    dbTellPromise.then(function(tell) {
                        tell.emit(IRCMessage.nickname).then(function(responses) {
                            if (responses.nonquery) {
                                client.say(IRCMessage.channel, responses.nonquery.message);
                            }
                            if (responses.query) {
                                client.say(IRCMessage.nickname, responses.query.message);
                            }
                        }).catch(function(err) {
                            if (err.type !== 'tell.notells') {
                                client._logger.error(err);
                            }
                        });
                    });
                },
                "!tell": function(IRCMessage) {

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