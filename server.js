const Hapi = require('hapi');
const server = new Hapi.Server();
const PORT = process.env.PORT || 3000;

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
			reply(fakeApi);
		}
	});
});



server.start((err) => {
	if(err){
		throw err;
	}

	console.log('Server running at: ', server.info.uri);
});