
exports.up = function(knex, Promise) {
  return knex.schema.createTable('surfboards', function(table) {
  	table.increments('id');
  	table.string('name').notNullable();
  	table.string('shaper').notNullable();
  	table.integer('feet').notNullable();
  	table.integer('inches').notNullable();
  	table.float('width').notNullable();
  	table.float('thickness').notNullable();
  	table.integer('fins').notNullable();
  	table.timestamp('createdAt').defaultTo(knex.fn.now());
  	table.timestamp('updatedAt').defaultTo(knex.fn.now());
  	table.string('featuredImg');
  })
  .createTable('users', function(table) {
  	table.increments('id');
  	table.string('username').notNullable();
  	table.string('password').notNullable();
  })
  .createTable('images', function(table) {
  	table.increments('id');
  	table.integer('surfboard_id').notNullable();
  	table.string('url').notNullable();
  });
};

exports.down = function(knex, Promise) {
  return knex.schema.dropTable('surfboards').dropTable('users').dropTable('images');
};
