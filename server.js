const Hapi = require('hapi');
const fs = require('fs');
const Joi = require('joi');
const path = require('path');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const server = new Hapi.Server();
const hapiAuthJwt = require('hapi-auth-jwt');
const jwt = require('jsonwebtoken');
const PORT = process.env.PORT || 3000;
const hapiImageUpload = require('hapi-bully-imageupload');
const util = require('util');
const RedisStore = require('connect-redis');
const AWS = require('aws-sdk');

const privateKey = process.env.PRIVATE_KEY || 'TemporaryPrivateKey';
// const AWS_CONFIG = require('./config/aws.json');
const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET = process.env.AWS_SECRET_ACCESS_KEY;
const AWS_REGION = process.env.AWS_REGION;
const POSTGRES_HOST = process.env.POSTGRES_HOST;
const POSTGRES_USER = process.env.POSTGRES_USER;
const POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD;
const POSTGRES_DB = process.env.POSTGRES_DB;

const credentials={
  accessKeyId: AWS_ACCESS_KEY,
  secretAccessKey: AWS_SECRET,
  region: AWS_REGION
};

var validate = function (request, decodedToken, callback) {
  new User({'username': decodedToken.username})
  	.fetch({ require : true })
  	.then(function(model){
  		if(!model){
  			console.log("bad model");
  			return callback(null,false);
  		}
  		// console.log("model serialize");
  		var account = model.attributes;
  		console.log("passed auth");
  		return callback(null, true, account);
  	})
  	.catch(err => {
  		console.log("Bad Token");
  		return callback(null, false);
  	});
};


AWS.config.update(credentials);
const s3 = new AWS.S3();

//setting up connection for knex to database
//this needs to end up on a config file soon.
var knex = require('knex')({
  client: 'pg',
  connection: {
    host     : POSTGRES_HOST,
    user     : POSTGRES_USER,
    password : POSTGRES_PASSWORD,
    database : POSTGRES_DB,
    charset  : 'utf8'
  }
});

//connect bookshelf to our knex which also includes connection property to our database
var bookshelf = require('bookshelf')(knex);


//defining the surfboard model from our database.
var Surfboard = bookshelf.Model.extend({
  tableName: 'surfboards',
  name: 'text',
  feet: 'integer',
  inches: 'integer',
  width: 'float',
  thickness: 'float',
  shaper: 'text',
  url: 'text',
  createdAt: 'date',
  featuredimg: 'text',
  images: function(){
  	return this.hasMany(Image);
  }
});

//defining the image model from our database.
var Image = bookshelf.Model.extend({
	tableName: 'images',
	surfboard_id: 'integer',
	url: 'text'
});

//defining the user model from our database.
var User = bookshelf.Model.extend({
	tableName: 'users',
	username: 'text',
	password: 'text'
});

//assigning the actual server's configuration
//this will be edited LATER for configuration to host in a config file as well (?)
server.connection({
	host: '0.0.0.0',
	port: PORT
});

//calling 'inert' package to allow for access to reply with public files.
server.register(
	[
		{
			'register': require('hapi-auth-jwt')
		},
		{
			'register': require('inert')
		}, 
		{
			'register': require('hapi-bully-imageupload'),
			'options': {
				'imagemagick': false,
				'maxBytes': 30000,
				'allowedMimeTypes': [ 'image/jpg', 'image/png', 'image/jpeg' ],
		    'uploadPath': process.cwd() + '/img/', // Notice the last slash
		    'allowedExtensions': ['jpg', 'jpeg']
			},
			'routes': {
				'prefix': '/api'
			}
		}
	], (err) => {
	//initial error check
	if(err){
		throw err;
	}
	server.auth.strategy('token', 'jwt', { key: privateKey,
			                                         validateFunc: validate,
			                                         verifyOptions: { algorithms: [ 'HS256' ]}
			                                       });

	//GET route for all boards in gallery
	server.route({
		method: 'GET',
		path: '/api/boards',
		handler: function(request, reply){
			Surfboard.forge()
			.orderBy('createdAt', 'DESC')
			.fetchAll({withRelated: ['images']}).then(function(surfboard){
				reply(JSON.stringify(surfboard));
			});
		}
	});

	//GET route for individual board based on params.id
	server.route({
		method: 'GET',
		path: '/api/boards/{id}',
		handler: function(request, reply){
			console.log(request.params);
			Surfboard.forge({id: encodeURIComponent(request.params.id)})
			.fetch({require: true, withRelated:['images']})
			.then(board => {
				console.log(JSON.stringify(board));
				reply(JSON.stringify(board));
			});
		}
	});

	//POST route that registers user
	server.route({
		method: 'POST',
		path: '/api/newUser',
		handler: function(request, reply){
			bcrypt.genSalt(saltRounds, function(err, salt){
				bcrypt.hash(request.payload.password, salt, function(err, hash){
					new User({
						username: request.payload.username,
						password: hash
					})
					.save(null, {method: 'insert'})
					.then(function() {
						reply("OK");
					});
				});
			});
		},
		config: {
			cors: {
				origin: ['*'],
				additionalHeaders: ['cache-control', 'x-requested-with']
			}
		}
	});

	//POST route that logs user in & gets a signed JWT on success
	server.route({
		method: 'POST',
		path: '/api/login',
		config: {
			auth: false,
			cors: {
				origin: ['*'],
				additionalHeaders: ['cache-control', 'x-requested-with']
			}
		},
		handler: function(request, reply){
			new User({'username': request.payload.username})
				.fetch()
				.then(function(model){
					console.log("model.attributes here", model.attributes);
					bcrypt.compare(request.payload.password, model.get('password')).then(res => {
						if(res){
							console.log("Success", model.attributes);
							console.log("The JWT", jwt.sign(model.attributes, privateKey, { algorithm: 'HS256'}));
							reply({'JWT': jwt.sign({username: model.attributes.username, id: model.attributes.id}, privateKey, { algorithm: 'HS256'})});
						} else {
							console.log("Bad password");
						}
					});
				})
				.catch(err => {
					console.log("Error", err);
					return done(null, false);
				});
		}
	});

	//POST route that takes in key/value pairs from POST request
	server.route({
		method: 'POST',
		path: '/api/newBoard',
		config: {
			auth: 'token',
			cors: {
				origin: ['*'],
				additionalHeaders: ['cache-control', 'x-requested-with']
			},
			payload: {
				output: 'stream',
				parse: true,
				allow: ['application/json', 'image/jpeg', 'multipart/form-data','application/pdf', 'application/x-www-form-urlencoded']
			}
		},
		handler: function(request, reply){
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
			.then(function(model){
				return Promise.all(new Array(parseInt(request.payload.numOfFiles)).fill(null).map((c, i) => {
					const params = {
						Body: request.payload['surfboardImg'+`[${i}]`]._data,
						Bucket: "surf-garage", 
						Key: 'surfboards/'+Date.now()+'/'+request.payload['surfboardImg'+`[${i}]`].hapi.filename,
						ACL: 'public-read',
						ContentType: 'image/png'
					};
					return new Promise((resolve, reject) => {
						s3.upload(params, function(err, data){
							if(err){
								return reject(err);
							}
							new Image({
								surfboard_id: model.attributes.id,
								url: data.Location
							})
							.save(null, {method: 'insert'})
							.then(resolve)
							.catch(reject);
						});
					});
				}));
			})
			.then((images) => {
				reply("OK");
			})
			.catch((err) => {
				reply(err);
			});
		}
	});

	//PUT route to specify a featured or default image to each surfboard
	server.route({
		method: 'PUT',
		path: '/api/boards/edit/{surfboard_id}/{image_url}',
		config: {
		},
		handler: function(request, reply){
			console.log("in handler");
			console.log(request.params);
			Surfboard.forge({id: encodeURIComponent(request.params.surfboard_id)})
			.fetch()
			.then(board => {
				console.log(board);
				board.save({
					featuredimg: request.params.image_url
				})
				.then(function () {
					console.log("saved");
	        reply({error: false, data: {message: 'Board details updated'}});
	      })
	      .catch(function (err) {
	      	console.log("error 1", err.message);
	        reply({error: true, data: {message: err.message}});
	      });
			})
			.catch(function (err) {
				console.log("error 2", err.message);
        reply({error: true, data: {message: err.message}});
      });
		}
	});

	//DELETE route that utilizes a parameter from {id} to delete specific boards from the database
	server.route({
		method: 'DELETE',
		path: '/api/deleteBoard/{id}',
		config: {
			auth: 'token',
			cors: {
				origin: ['*'],
				additionalHeaders: ['cache-control', 'x-requested-with']
			},
			payload: {
				output: 'stream',
				parse: true,
				allow: ['application/json', 'image/jpeg', 'multipart/form-data','application/pdf', 'application/x-www-form-urlencoded']
			}
		},
		handler: function(request, reply){
			console.log("in handler");
			Surfboard.forge({id: encodeURIComponent(request.params.id)})
			.fetch({require: true, withRelated:['images']})
			.then(function(board){
				return [board, Promise.all(
					board.related('images').models.map((image, index, array) => {
						const params = {
							Bucket: "surf-garage",
							Key: image.attributes.url.split('.com/').pop()
						};
						return new Promise((resolve, reject) =>  {
							s3.deleteObject(params, function(err, data){
								if(err){
									reject(err);
								} else {
									resolve(data);
								}
							});
						});
					})
				)];
			})
			.then(([board, deletedS3Objects]) => {
				return [board, board.related('images')
				.invokeThen('destroy')];
			})
			.then(function([board, deletedImages]){
				return board.destroy();
			})
			.then(function(board){
				reply(board);
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

	//console log when server is running properly
	console.log('Server running at: ', server.info.uri);
});