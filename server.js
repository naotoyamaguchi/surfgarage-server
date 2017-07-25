const Hapi = require('hapi');
const server = new Hapi.Server();
const PORT = process.env.PORT || 3000;

//setting up connection for knex to database
//this needs to end up on a config file soon.
var knex = require('knex')({
  client: 'pg',
  connection: {
    host     : 'localhost',
    user     : 'naotoy',
    password : null,
    database : 'surfgarage',
    charset  : 'utf8'
  }
});

var bookshelf = require('bookshelf')(knex);

var Surfboard = bookshelf.Model.extend({
  tableName: 'Surfboards',
  name: 'text',
  feet: 'integer',
  inches: 'integer',
  width: 'float',
  thickness: 'float',
  shaper: 'text'
});

// console.log(Surfboard);

server.connection({
	host: 'localhost',
	port: PORT
});

server.register(require('inert'), (err) => {
	if(err){
		throw err;
	}

	server.route({
		method: 'GET',
		path: '/api/test',
		handler: function(request, reply){
			var fakeApi = [
			{
				name: "John Doe",
				age: 50,
				gender: "Male"
			},
			{
				name: "Joe Smith",
				age: 25,
				gender: "Female"
			}
			];
			Surfboard.collection().fetch().then(function(collection) {
			  reply(collection);
			});
		}
	});

	server.route({
		method: 'POST',
		path: '/api/newBoard',
		handler: function(request, reply){
			console.log(request.query);
			new Surfboard({
				name: request.query.name,
				feet: request.query.feet,
				inches: request.query.inches,
				width: request.query.width,
				thickness: request.query.thickness,
				shaper: request.query.shaper,
				fins: request.query.fins,
				createdAt: new Date(),
				updatedAt: new Date()
			})
			.save(null, {method: 'insert'})
			.then(function(model) {
				reply(model);
			});
		}
	});

	server.route({
		method: 'DELETE',
		path: '/api/deleteBoard/{id}',
		handler: function(request, reply){
			Surfboard.forge({id: encodeURIComponent(request.params.id)})
			.fetch({require: true})
			.then(function(board){
				board.destroy()
				.then(function(){
					reply({error: false, data: {message: 'Board successfully deleted!'}});
				})
				.catch(function(err) {
					reply({error: true, data: {message: err.message}});
				});
			})
			.catch(function(err) {
				reply({error: true, data: {message: err.message}});
			});
		}
	});
});



server.start((err) => {
	if(err){
		throw err;
	}

	console.log('Server running at: ', server.info.uri);
});