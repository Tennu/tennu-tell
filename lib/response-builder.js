var Promise = require('bluebird');
var moment = require('moment');
var format = require('util').format;

function getResponses(tells, nickname) {
    return Promise.try(function() {

        // Object eventually consumed by tennu
        var responses = {};

        return Promise.filter(tells, function(tell) {
            return tell.Private === 1 || tell.Private === true;
        }).then(function(privateTells) {
            if (privateTells.length > 0) {
                responses.query = {
                    query: true,
                    message: [
                        format('%s, you have %s private tell:', nickname, privateTells.length, (privateTells.length > 1 ? 's' : ''))
                    ]
                };
            }
        }).then(function() {
            return Promise.filter(tells, function(tell) {
                return tell.Private === 0 || tell.Private === false;
            });
        }).then(function(publicTells) {
            if (publicTells.length > 0) {
                responses.nonquery = {
                    query: false,
                    message: [
                        format('%s, you have %s tell%s:', nickname, publicTells.length, (publicTells.length > 1 ? 's' : ''))
                    ]
                }
            }
        }).then(function() {
            return Promise.each(tells, function(tell) {
                var timeAgoMessage = format('%s from %s: ', moment(tell.Timestamp).from(moment(new Date())), tell.FromNick);
                if (tell.Private) {
                    responses.query.message.push(timeAgoMessage + tell.Content);
                }
                else {
                    responses.nonquery.message.push(timeAgoMessage + tell.Content);
                }
            });
        }).then(function () {
            return responses;
        });
        
    });
    
};


module.exports = getResponses