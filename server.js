const Hapi = require('hapi');
const fs = require('fs');
const Joi = require('joi');
const path = require('path');
const server = new Hapi.Server();
const PORT = process.env.PORT || 3000;
const hapiImageUpload = require('hapi-bully-imageupload');
const util = require('util');

const AWS = require('aws-sdk');
const AWS_CONFIG = require('./config/aws.json');
const AWS_ACCESS_KEY = AWS_CONFIG.accessKeyId;
const AWS_SECRET = AWS_CONFIG.secretAccessKey;
const AWS_REGION = AWS_CONFIG.region;

const credentials={
  accessKeyId: AWS_ACCESS_KEY,
  secretAccessKey: AWS_SECRET,
  region: AWS_REGION
};

AWS.config.update(credentials);
const s3 = new AWS.S3();

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
  tableName: 'surfboards',
  name: 'text',
  feet: 'integer',
  inches: 'integer',
  width: 'float',
  thickness: 'float',
  shaper: 'text',
  url: 'text'
});

var Image = bookshelf.Model.extend({
	tableName: 'images',
	post_id: 'integer',
	url: 'text'
});

//assigning the actual server's configuration
//this will be edited LATER for configuration to host in a config file as well (?)
server.connection({
	host: 'localhost',
	port: PORT
});

//calling 'inert' package to allow for access to reply with public files.
server.register((
	[
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
	]
), (err) => {
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
			console.log(request.payload['surfboardImg[file]']);

			const params = {
			  Body: request.payload['surfboardImg[file]'], 
			  Bucket: "surf-garage", 
			  Key: 'surfboards/'+Date.now()+request.payload['surfboardImg[name]'],
			  ACL: 'public-read',
			  ContentType: 'image/png'
			 };

			 s3.upload(params, function(err, data) {
				  new Surfboard({
						name: request.payload.name,
						feet: request.payload.feet,
						inches: request.payload.inches,
						width: request.payload.width,
						thickness: request.payload.thickness,
						shaper: request.payload.shaper,
						fins: request.payload.fins,
						url: data.Location,
						createdAt: new Date(),
						updatedAt: new Date()
					})
					.save(null, {method: 'insert'})
					.then(function(model) {
						console.log(model.attributes.id);
						new Image({
							post_id: model.attributes.id,
							url: data.Location
						})
						.save(null, {method: 'insert'});
					});
			});
		},
		config: {
			cors: {
				origin: ['*'],
				additionalHeaders: ['cache-control', 'x-requested-with']
			},
			payload: {
				output: 'stream',
				parse: true,
				allow: ['application/json', 'image/jpeg', 'multipart/form-data','application/pdf', 'application/x-www-form-urlencoded']			}
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