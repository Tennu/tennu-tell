var array = require('lodash/array');
var Promise = require('bluebird');
var format = require('util').format;
var path = require("path");
var moment = require("moment");
var parseDuration = require('parse-duration');
var errors = require('./lib/errors');
var _ = require('lodash');

var TennuTell = {
    requiresRoles: ['dbcore'],
    configDefaults: {
        "tell": {
            "maxAtOnce": 10,
            "floodDelay": 1200
        },
    },
    init: function(client, imports) {

        const knex = imports.dbcore.knex;
        
        var dbTellPromise = knex.migrate.latest({
                tableName: 'tennu_tell_knex_migrations',
                directory: path.join(__dirname, 'migrations')
            }).then(function() {
            return require('./lib/tell')(knex, client);
        });

        const helps = require("./helps.json")

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

        function processResponses(IRCMessage, responses) {
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
        };

        return {
            handlers: {
                "privmsg": function(IRCMessage) {

                    // !delaytells command should abort tell emitter
                    if (/^!delaytells?/.test(IRCMessage.message)) {
                        return;
                    }
                    
                    // !skiptells command should abort tell emitter
                    if (/^!skiptells?/.test(IRCMessage.message)) {
                        return;
                    }                    

                    dbTellPromise.then(function(tell) {
                        tell.emit(IRCMessage.nickname).then(function(responses) {
                            processResponses(IRCMessage, responses);
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
                    }).catch(function(err) {
                        return {
                            intent: 'notice',
                            query: true,
                            message: err
                        };
                    });
                },
                '!tellrefresh !reloadtells': function() {
                    return dbTellPromise.then(function(tell) {
                        return tell.refresh().then(function(tells) {
                            tell.unreadTells = tells;
                            tell.pendingTells = [];
                            return {
                                intent: 'notice',
                                query: true,
                                message: format('Tell cache reloaded with %s unread tells.', tells.length)
                            };
                        });
                    })
                },
                '!delaytells': function(IRCMessage) {

                    // Process the duration
                    var durationMS = parseDuration(IRCMessage.message);

                    if (!durationMS) {
                        durationMS = 1800000
                    }

                    var duration = moment.duration(Math.abs(durationMS), 'ms');
                    var expiresOn = moment().add(duration).toDate();
                    var humanized = duration.humanize();

                    return dbTellPromise.then(function(tell) {
                        return tell.delay(IRCMessage.nickname, expiresOn).then(function(tells) {
                                return {
                                    intent: 'notice',
                                    query: true,
                                    message: format("Delayed %s tells for %s.", tells.length, humanized)
                                };
                            })
                            .catch(errors.TellNoTellsError, function(err) {
                                return {
                                    intent: 'notice',
                                    query: true,
                                    message: err
                                };
                            });
                    })
                },
                '!forcetells': function(IRCMessage) {
                    return dbTellPromise.then(function(tell) {
                        return tell.force(IRCMessage.nickname)
                            .catch(errors.TellNoTellsError, function(err) {
                                return {
                                    intent: 'notice',
                                    query: true,
                                    message: err
                                };
                            });
                    })
                },
                '!skiptells': function(IRCMessage) {
                    return dbTellPromise.then(function(tell) {
                        return tell.skip(IRCMessage.nickname)
                            .then(function(removedTells){
                                return {
                                    intent: 'notice',
                                    query: true,
                                    message: format("Marked %s pending tells for you as read.", removedTells.length)
                                };
                            })
                            .catch(errors.TellNoTellsError, function(err) {
                                return {
                                    intent: 'notice',
                                    query: true,
                                    message: err
                                };
                            });
                    })
                }
            },

            help: {
                "tell": helps.tell,
                "tellrefresh": helps.tellrefresh,
                "delaytells": helps.delaytells,
                "forcetells": helps.forcetells,
                "skiptells": helps.skiptells
            },

            commands: ["tell", "!tellrefresh", "!delaytells", "forcetells"]
        }
    }
};

module.exports = TennuTell;