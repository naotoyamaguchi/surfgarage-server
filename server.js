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

//connect bookshelf to our knex which also includes connection property to our database
var bookshelf = require('bookshelf')(knex);

//defining the surfboard model from our database.
var Surfboard = bookshelf.Model.extend({
  tableName: 'Surfboards',
  name: 'text',
  feet: 'integer',
  inches: 'integer',
  width: 'float',
  thickness: 'float',
  shaper: 'text'
});

//assigning the actual server's configuration
//this will be edited LATER for configuration to host in a config file as well (?)
server.connection({
	host: 'localhost',
	port: PORT
});

//calling 'inert' package to allow for access to reply with public files.
server.register(require('inert'), (err) => {
	//initial error check
	if(err){
		throw err;
	}

	//dummyApi for testing
	//Need to delete later
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

	//POST route that takes in key/value pairs from POST request
	server.route({
		method: 'POST',
		path: '/api/newBoard',
		handler: function(request, reply){
			console.log(request);
			new Surfboard({
				name: request.payload.name,
				feet: request.payload.feet,
				inches: request.payload.inches,
				width: request.payload.width,
				thickness: request.payload.thickness,
				shaper: request.payload.shaper,
				fins: request.payload.fins,
				createdAt: new Date(),
				updatedAt: new Date()
			})
			.save(null, {method: 'insert'})
			.then(function(model) {
				reply(model);
			});
		}
	});

	//DELETE route that utilizes a parameter from {id} to delete specific boards from the database
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


//initializes server
server.start((err) => {
	//initial error check
	if(err){
		throw err;
	}

	//console log sanity when server is running properly
	console.log('Server running at: ', server.info.uri);
});