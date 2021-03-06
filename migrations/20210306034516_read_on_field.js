exports.up = function(knex, Promise) {
    return knex.schema.table('tell', function (table) {
        table.timestamp('ReadOn').nullable();
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.table('tell', table => {
        table.dropColumn('ReadOn');
    })
};