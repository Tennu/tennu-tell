var Promise = require('bluebird');
var collection = require('lodash/collection');
var format = require('util').format;
var errors = require('./errors');
var responseBuilder = require('./response-builder');
var _ = require('lodash');

function emit(nick) {
    var self = this;

    return Promise.try(function() {

            // Deposit any expired delayed tells
            return removeExpiredDelayedTells(self.delayedTells);

        })
        .then(function(expiredDelayedTells) {

            if (expiredDelayedTells.length > 0) {
                self.unreadTells = self.unreadTells.concat(expiredDelayedTells);
            }

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
        });

}


function removeExpiredDelayedTells(delayed) {
    var now = new Date();
    return _.remove(delayed, function(tell) {
        return tell.expiresOn < now;
    });
}

function delay(nickname, expires) {
    var self = this;
    return Promise.try(function() {

        // Extract users tells and move them to pending zone.
        var delayedTells = self.unreadTells.filter(function(unreadTell) {
                return unreadTell.ToNick.toLowerCase() === nickname.toLowerCase();
            })
            .map(function(tell) {
                tell.expiresOn = expires;
                return tell;
            });

        if (delayedTells.length === 0) {
            throw errors.TellNoTellsError({
                nick: nickname
            });
        }

        self.delayedTells = self.delayedTells.concat(delayedTells);

        // Remove pending from unreadTells
        self.unreadTells = self.unreadTells.filter(function(unreadTell) {
            return unreadTell.ToNick.toLowerCase() !== nickname.toLowerCase();
        });

        return delayedTells;
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

function force(nickname) {
    var self = this;
    return Promise.try(function() {

        var removed = _.remove(self.delayedTells, function(tell) {
            return tell.ToNick.toLowerCase() === nickname.toLowerCase();
        });

        if (removed.length === 0) {
            throw errors.TellNoTellsError({
                nick: nickname
            });
        }

        self.unreadTells = self.unreadTells.concat(removed);
    });
}

function refresh() {
    return this.knex('tell').where('Read', false);
}

function tell(knexContext, client) {
    return Promise.try(function() {
        return refresh.call({
            knex: knexContext
        });
    }).then(function(dbTells) {
        client._logger.notice(format('tennu-tell: loaded %s tell(s)', dbTells.length));
        return {
            knex: knexContext,
            unreadTells: dbTells,
            delayedTells: [],
            delay: delay,
            save: save,
            emit: emit,
            refresh: refresh,
            force: force
        };
    });
}

module.exports = tell;