var Promise = require('bluebird');
var collection = require('lodash/collection');
var format = require('util').format;
var errors = require('./errors');
var responseBuilder = require('./response-builder');

function emit(nick, errorLogger) {
    var self = this;

    return Promise.try(function() {

            var foundTells = self.unreadTells.filter(function(unreadTell) {
                return unreadTell.ToNick.toLowerCase() === nick.toLowerCase();
            });

            if (foundTells.length === 0) {
                throw errors.TellNoTellsError({
                    nick: nick
                });
            }

            // convert foundTells to an object tennu can work with more easily
            var responseFriendlyTells = responseBuilder(foundTells, nick);

            var foundTellIDs = foundTells.map(function(tell) {
                return tell.ID;
            });

            // Remove from cache
            self.unreadTells = self.unreadTells.filter(function(unreadTell) {
                return !collection.includes(foundTellIDs, unreadTell.ID);
            });

            // Mark tell read
            return self.knex('tell').whereIn('ID', foundTellIDs).update({
                    Read: true
                })
                .then(function() {
                    return responseFriendlyTells;
                })
        })

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