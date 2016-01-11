var Promise = require('bluebird');
var collection = require('lodash/collection');
var format = require('util').format;
var errors = require('./errors');
var responseBuilder = require('./response-builder');

function emit(nick) {
    var self = this;
    return Promise.filter(self.unreadTells, function(value) {
        return value.ToNick.toLowerCase() === nick.toLowerCase();
    }).then(function(foundTells) {

        if (foundTells.length === 0) {
            throw errors.TellNoTellsError({
                nick: nick
            });
        }

        return Promise.try(function() {
            return responseBuilder(foundTells, nick);
        }).then(function(responses) {

            // Mark tells read
            return Promise.try(function() {
                
                var foundTellIDs = foundTells.map(function(tell) {
                    return tell.ID;
                });

                // Mark tell read
                return self.knex('tell').whereIn('ID', foundTellIDs).update({
                    Read: true
                }).then(function(readTell) {
                    // Remove from cache
                    self.unreadTells = self.unreadTells.filter(function(unreadTell) {
                        return !collection.includes(foundTellIDs, unreadTell.ID);
                    });
                });

            }).then(function() {
                return responses;
            });
        });
    });

}

function save(teller, told, isPrivate, message) {
    var self = this;
    // Map tells to knex
    return Promise.map(told, function(user) {
        return {
            FromNick: teller,
            ToNick: user,
            Content: message,
            Timestamp: new Date(),
            Private: isPrivate,
            Read: false
        };
    }).each(function(newTell) {
        return Promise.try(function() {
            return self.knex.insert(newTell, 'ID').into('tell');
        }).then(function(id) {
            newTell.ID = id[0];
            self.unreadTells.push(newTell);
        });
    });
}

function tell(knexContext, client) {
    return Promise.try(function() {
        return knexContext('tell').where('Read', false);
    }).then(function(dbTells) {
        client._logger.notice(format('tennu-tell: loaded %s tell(s)', dbTells.length));
        return {
            knex: knexContext,
            unreadTells: dbTells,
            save: save,
            emit: emit
        };
    });
}

module.exports = tell;