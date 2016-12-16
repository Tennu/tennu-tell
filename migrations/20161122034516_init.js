exports.up = function(knex, Promise) {
    return knex.schema.createTableIfNotExists("tell", function(table) {
        table.increments("ID").primary();
        table.string("FromNick").notNullable();
        table.string("ToNick").notNullable();
        table.string("Content").notNullable();
        table.boolean("Private");
        table.boolean("Read").defaultTo(false);
        table.timestamp("Timestamp");
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTableIfExists("tell");
};