var TypedError = require("error/typed");
var format = require('util').format;

var TellNoTellsError = TypedError({
    type: 'tell.notells',
    message: 'No tells for {nick}',
});

module.exports = {
    TellNoTellsError: TellNoTellsError
};