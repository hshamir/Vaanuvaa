//libs
var util = require('util');
var fs = require('fs');
var jade = require('jade');
var _ = require('underscore');
var async = require('async');
var path = require('path');
var mongoose = require('mongoose');
var formidable = require('formidable');
var crypto = require('crypto');
var jade_browser = require('jade-browser');
var gm = require('gm');
//settings
//application settings
var app_settings = {
	url: '/cms',
	upload_directory: __dirname + "/../../public/files/",
	templates_dir: __dirname + "/templates/",
	views:  __dirname +  '/views/',
	password_salt: '56 laari'
}
app_settings['templates_url'] = app_settings['url'] +  "/templates.js";


var settings = {};
var mongooseMap = {
	string:'string',
	number:'number',
	string_thaana:'string',
	table:{
		columns:{type:'array'},
		rows:{type:'array'}
	},
	image:'string',
	select:{id:mongoose.Schema.Types.ObjectId, name:'string'},
	images:'array',
	file:'string',
	boolean:'boolean',
	reference:mongoose.Schema.Types.ObjectId
}
var snapshot_schema  = {
	_ip:'string',
	_date: {type:'date', default: new Date() }
}

var user_schema = {
	user:'string',
	realname:'string',
	password:{type:'string', default:'password'},
	type: 'string', //normal poweruser administrator
	access:[{module:{type:'string'}}], //features allowed
	banned:{type:'boolean', default: false},
	created: {type:'date', default: new Date()}
}

function hashPassword(password){
	return crypto.createHash("sha1").update(password + app_settings.password_salt).digest("hex");
}

function hashMatch(hash, password){
	return hashPassword(password) === hash;
}

function createUser(user, realname, password, type, callback){
	var user = user.trim().toLowerCase(),
		userTest = user.match(/^[a-z]+$/);
	if(userTest == null){
		callback("Incorrect username supplied");
		return;
	}
	userExists(user, function(err, exists){
		if(exists)
			callback("user already exists");
		else{
			var newUser = new cms.users({user:user, realname:realname, password:hashPassword(password), type:type});
			newUser.save(function(err){
				if(err)
					throw Error(err);
				callback(null, "User created");
			});
		}
	});
}

function userExists(user, callback){
	if (featureExists('users') == false){
		callback('User module not initialized');
		return;
	}
	cms['users'].findOne({user:user},function(err,doc){
		if(err) throw Error(err);
		if(doc)
			callback(null, true);
		else
			callback(null, false);
	});
}

function setupUsers(){
	//create users if not exists
	if (featureExists('user') == true){
		return;
	}
	var schema = mongoose.Schema(user_schema);
	cms['users'] = db.model('users',schema);
	
	//add administrator if not exist
	userExists('administrator',function(err, exist){
		if(exist == false){
			createUser('administrator', 'Administrator', 'pass', 'administrator',function(err, res){
				
			});
		}
	});
}

function keyValidate(obj,arr){
	var ok = true;
	arr.forEach(function(e){
		if(!_.has(obj,e))
			ok = false;
	});
	return ok;
}

function verifyFeature(feature, data){
	var extract = settings[feature]['local'];
	var ok = true;
	_.keys(data).forEach(function(e){
		if(e in extract == false)
			ok = false;
	});
	return ok
}

function saveFile(req,options,callback){
	var form = new formidable.IncomingForm();
	form.uploadDir = path.normalize(app_settings.upload_directory);
	form
	.on('file',function(name,file){
		console.log("Creating new file " + name + " ("+bytesToSize(file.size)+")");
	})
	.on('fileBegin',function(name,file){
		file.path = form.uploadDir + crypto.createHash("sha1").update(String(Math.random()+name)).digest("hex") + "."+ (name.split(".").pop());
	})
	.on('field',function(name,val){
		//console.log(name, val);
	})
	.parse(req,callback);
}

function expectFileOperation(feature){
	var extract = settings[feature]['local'];
	var ok = false;
	for(var i in extract){
		if('image file images'.indexOf(extract[i]['type']) !== -1){
			ok = true;
			return ok;
		}
	}
	return ok;
}

function bytesToSize(bytes) {
	var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
	if (bytes == 0) return 'n/a';
	var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
	return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
};

function sanitizeFields(feature,fields){
	extract = settings[feature]['local'];
	var ret = {};
	for(var i in fields){
		if(i in extract)
			ret[i] = fields[i]
	}
	return ret;
}


function validateUser(userObj, callback){
	var user = userObj.user;
	var password = userObj.password;
	cms.users.findOne({user:user},function(err,doc){
		if(err) throw Error(err);
		if(doc){
			if(password === doc.password){
				return callback(null, true, doc);
			}
			console.log(password, doc.password)
			return callback("Password incorrect", false);
		}
		return callback("User doesn't exist", false);
	});
}

function addRoutes(){
	var app = cms.app;
	var url = app_settings.url;
	app.get(url + '/login', function(req,res){
		if(typeof req.session.user == 'undefined'){
			return res.render(app_settings.views + 'login.jade',{layout: app_settings.views + 'loginlayout.jade'});
		}
		res.redirect(url);
	});
	app.post(url + '/login',function(req,res){
		
		var user = {user:req.body.username, password:hashPassword(req.body.password)};
		validateUser(user,function val(err, validated, user){
			if(!validated) return res.render(app_settings.views + 'login.jade',{layout: app_settings.views + 'loginlayout.jade', msg:err});
			req.session._user = user;
			req.session.user = {
				user:user.user,
				password:user.password
			};
			res.redirect(url);
		});
	});
	app.get(url + '/logout',function(req,res){
		req.session.destroy();
		res.redirect(app_settings.url + '/login');
	});
	app.all(url + "/", function(req,res, next){
		if(typeof req.session == 'undefined')
			throw Error("Session not started");
		if(typeof req.session.user == 'undefined'){
			if(req.xhr){
				return res.json({error:"Please login"});
			}
			return res.render(app_settings.views + 'login.jade',{layout: app_settings.views + 'layout.jade'});
		}
		/*
			return next() will skip  validateUser() because async operation hangs uploads 
			in formidable.
		*/
		
		validateUser(req.session.user, function(err, validated){
			return next();
			if(err) {
				if(req.xhr){
					return res.json({error:err});
				}
				return res.render(app_settings.views + 'login.jade',{layout: app_settings.views + 'layout.jade', msg:err});
			}
			if(validated){
				return next();
			}
			if(req.xhr){
				return res.json({error:"Unable to validate you"});
			}
			return res.render(app_settings.views + 'login.jade',{layout: app_settings.views + 'layout.jade', msg:"Unable to validate you"});

		});
	});
	app.get(url, function(req,res){
		if(typeof req.session == 'undefined')
			throw Error("Session not started");
		if(typeof req.session.user == 'undefined'){
			if(req.xhr){
				return res.json({error:"Please login"});
			}
			return res.redirect(url + '/login')
		}
		//get accessible modules
		cms.users.findOne({user:req.session.user.user},{access:1, type:1}, function(err, user){
			if(err) throw err;
			var pages = cms.pageStructure(user.type == 'administrator'? void 0:user.access);
			res.render(app_settings.views + 'index.jade',{user_type:user.type, menus:pages, layout: app_settings.views + 'layout.jade'});
		});			
	});
	app.get(app_settings['templates_url'], function(req,res,next){
		jade_browser(app_settings.templates_url, '**', {root:app_settings.templates_dir, minify: true})(req,res,next);
	});
	app.get(url + '/users', function(req, res){
		//get all users
		if(req.session._user.type == 'normal'){
			
			return res.redirect(url);
		}
		cms.users.find({},{password:0},function(err, users){
			var users_structure = {users:_.map(users, function(u){ u.name = "users_" + u.user; return u; })};
			res.render(app_settings.views + 'user.jade',{pages:cms.pageStructure(), menus:users_structure, layout: app_settings.views + 'layout.jade'});
		});
	});
	app.post(url + '/users/create', function(req, res){
		var user = req.body.username;
		var realname = req.body.realname;
		var type = req.body.type ? req.body.type.toLowerCase() : '';
		console.log(user, realname, type)
		if(user == "" || realname == "" || type == "" || !type || !user || !realname && (type != "administrator" || type != "normal")){
			return res.json({error:"unable to create user, please fill all the fields"});
		}
		userExists(user,function(err, exist){
			if(exist == false){
				createUser(user, realname, 'welcome', 'normal',function(err, u){
					console.log(u);
					res.json({message:"user created"});
				});
			}else{
				return res.json({error:"user already exists"});
			}
		});
	});
	app.post(url + '/users/update', function(req, res){
		var id = req.body.id;
		var access = req.body.access;
		var user = req.body.username;
		var realname = req.body.realname;
		var type = req.body.type ? req.body.type.toLowerCase() : '';
		if(access== "" || !access || id== "" || !id || user == "" || realname == "" || type == "" || !type || !user || !realname && (type != "administrator" || type != "normal")){
			return res.json({error:"unable to create user, please fill all the fields"});
		}
		access = JSON.parse(access);
		cms.users.update({_id:id},{$set:{username:user,realname:realname, access:access}}, function(err, changed){
			if(err) throw err;
			if(changed == 0){
				return res.json({error:'unable to update user'});
			}else{
				return res.json({success:'updated!'});
			}
			
		});
	});
	app.post(url + '/users/remove', function(req, res){
		if(!req.body.user || req.body.user == ""){
			return res.json({error:"invalid request"});
		}
		cms.users.remove({_id:req.body.user}, function(err, changed){
			if(err) throw err;
			if(changed == 0){
				return res.json({error:'unable to remove user'});
			}else{
				return res.json({success:'removed!'});
			}
		});
	});
	app.post(url + '/users/update/password', function(req, res){
		if(req.body.password == '' || !req.body.password){
			return res.json({error:'no password provided'});
		}
		cms.users.update({user:req.session.user.user}, {$set:{password:hashPassword(req.body.password)}},function(err, changed){
			if(err) throw err;
			if(changed == 0){
				return res.json({error:'unable to change password'});
			}else{
				return res.json({success:'changed'});
			}
		});
	});
	app.post(url + '/users/passwordreset', function(req, res){
		if(!req.body.user || req.body.user == ""){
			return res.json({error:"invalid request"});
		}
		cms.users.update({_id:req.body.user}, {$set:{password:hashPassword('welcome')}},function(err, changed){
			if(err) throw err;
			if(changed == 0){
				return res.json({error:'unable to change your password'});
			}else{
				return res.json({success:'password changed to "welcome"'});
			}
		});
	});
	app.get(url + '/get-data', function(req,res){
		var sources = req.query.sources.split(" ");
		var response = {};
		async.map(
			sources,
			function(source, done){
				cms[source].findOne()
				.populate('prod1 prod2 prod3 prod4', 'gallery')
				.exec(function(err, doc){
					response[source] = doc;
					done(null, doc);
				});
			},
			function(err, result){
				res.json(response);
			}
		);
	});

	app.get(url + "/:feature",function(req,res){
		var feature = req.params.feature;
		cms.get(feature,function(err,docs){
			if(err){
				console.log(err);
				res.json({error:err});
			}else{
				res.json(docs);
			}
		});
	});

	app.get(url + "/:feature/search/:query",function(req,res){
		var feature = req.params.feature;
		var query = new RegExp(req.params.query, 'gi');
		cms.get(feature, {name:query}, function(err,docs){
			if(err){
				console.log(err);
				res.json({error:err});
			}else{
				res.json(docs);
			}
		});
	});
	
	
	app.post(url + '/:feature/:command', function(req,res){
		var feature = req.params.feature;
		var command = req.params.command;
		var data = req.body;
		cms.execute(feature,command,data,req,function(err, result){
			res.json(result);
		});
	});
	
	app.post(url + '/remove-component',function(req,res){
		var feature = req.body.feature;
		var id = req.body.id;
		if(typeof cms[feature] != 'function') res.json({error:"Unable to complete your request"});
		else{
			cms[feature].remove({_id:id},function(err,docs){
				if (err) res.json({error:"There was an error occured while removing"});
				else res.json({removed:docs, message:"Successfully removed component" + (docs > 1 ? "s" : "")});
			});
		}
	});
	
	app.post(url + '/remove-image', function(req,res){
		var feature = req.body.feature
		  , id = req.body.document
		  , item = req.body.image
		  , label = req.body.label
		var pull_obj = {};
		pull_obj[label] = item;
		console.log(pull_obj)
		cms[feature].update({_id:id}, {$pull:pull_obj}, function(err){
			if (err) return res.json({error:err});
			res.json({});
		});
	});
}

function featureExists(feature){
	return typeof cms[feature] == 'function';
}

function createSnapshot(feature, id, callback){
	if(!featureExists(feature)){
		callback("Feature doesn't exist!");
		return;
	} 
	cms[feature].findOne({_id:id}, function(err,doc){
		var snap = _.clone(JSON.parse(JSON.stringify(doc)));
		delete snap._id;
		delete snap['__v'];
		//delete snap['snapshot'];
		//doc.snapshot.push(snap);
		doc.save(callback);
	});
}
function removeKeys(keys,obj){
	var newObject = {};
	for(var key in obj){
		if(!key in obj){
			newObject[key] = obj[key];
		}
	}
}
function getSchema(feature){
	if(typeof settings[feature] == 'undefined'){
		return false;
	}
	return settings[feature].local;
	/*
	
	commented because attributes other than type are not exposed to the client
	
	var schema = {};
	for(var i in settings[feature].local){
		schema[i] = {type:settings[feature].local[i]['type']}
	}
	return schema;
	*/
}
function getSchemaStatics(feature){
	return settings[feature].statics;
	/*
	
	commented because attributes other than type are not exposed to the client
	
	var schema = {};
	for(var i in settings[feature].local){
		schema[i] = {type:settings[feature].local[i]['type']}
	}
	return schema;
	*/
}
function getMongooseFieldType(type){
	return mongooseMap[type];
}

var cms = module.exports = {
	app:null,
	listen:function(app){
		cms.app = app;
		addRoutes();
		setupUsers();
	},
	router:function router(req,res,next){
		
	},
	add:function add(feature,fields){
		if(feature in settings) throw new Error ("Feature "+ feature +" already exists");
		settings[feature] = {};
		var mongoose_data = {};
		
		var obj = {};
		var statics = {};
		if(typeof fields['fields'] != 'undefined'){
			obj = fields.fields;
			statics = _.clone(fields);
			delete statics.fields;
		}else{
			obj = fields;
		}
		for(var i in obj){
			if('type' in obj[i] == false) throw new Error("Could not find 'type' of " + i);
			
			var schema_set = null;
			
			switch(obj[i]['type']){
				case "reference":
					if(!keyValidate(obj[i], ["collection"])){
						throw new Error("collection not defined for 'reference' type");
					}
					schema_set = {type:mongooseMap[obj[i]['type']], ref:obj[i]['collection']}
					break;
			}
			mongoose_data[i] = schema_set || mongooseMap[obj[i]['type']];
			
			
		}
		//var snapshot = new mongoose.Schema(_.extend(JSON.parse(JSON.stringify(mongoose_data)), snapshot_schema));
		//mongoose_data.snapshot = [snapshot]; 
		/*
		if(typeof fields['single'] != 'undefined'){
			obj.single = true;
		}*/
		settings[feature].local = obj
		settings[feature].statics = statics
		settings[feature].mongoose = mongoose.Schema(mongoose_data,{strict:false});
		
		//create mongoose model
		cms[feature] = db.model(feature,settings[feature].mongoose);
		//console.log(util.inspect(settings,true,2,true));
	},
	execute:function execute (feature,cmd,additional,req,callback){
		//cmd = new, update, delete, edit
		//expect quote and an image

		if(feature in settings == false){
			callback("Undefined feature " + feature + ".");
			return;
		}
		if("add update remove".indexOf(cmd) === -1){
			callback("Method '" + cmd + "' is invalid, please make sure to request with 'add, update or remove'.");
			return;
		}
		if(!req){
			callback("Request not supplied");
			return;
		}
		
		/*if(!verifyFeature(feature,data)){
			callback("Data mismatch, please ensure that you supply enough data.");
			return;
		}*/
		if(expectFileOperation(feature)){
			saveFile(req,null,function(err,fields,files){
				//replace file/images.. fields in field list with file paths
				var data = sanitizeFields(feature,fields);

				for(var i in data){
					var ftype = settings[feature].local[i].type;
					if(data[i] in files === true){
						var _files = [];
						
						var crop_files = ftype == 'file' ? null : JSON.parse(fields[i+"-crop"]);
						async.forEach(_.keys(files), function(file, done){
							var fpath = path.normalize(files[file]['path']);
							var file_name = fpath.split('/').pop();
							_files.push(file_name);
							if(ftype == 'file'){
								return done(null, null);
							}
							//resize
							var dimensions = crop_files[file];
							var sizes = settings[feature].local[i].sizes;
							if(dimensions){
								gm(fpath)
								.crop(dimensions.w,dimensions.h,dimensions.x,dimensions.y)
								.write(fpath, function(err){
									if(sizes){
										sizes.forEach(function(size){
											var normalized = path.normalize(app_settings.upload_directory);
											gm(fpath)
											.resize(size.width, size.height)
											.write(normalized + size.prefix + file_name, function(err){
										
											});
										});
									}
									done(null, null);
								});
							}else{
								gm(fpath)
								.write(fpath, function(err){
									if(sizes){
										sizes.forEach(function(size){
											var normalized = path.normalize(app_settings.upload_directory);
											gm(fpath)
											.resize(size.width, size.height)
											.write(normalized + size.prefix + file_name, function(err){
										
											});
										});
									}
									done(null, null);
								});							
							}
							
						});
						var type = getMongooseFieldType(ftype);
						if(type === 'array'){
							data[i] = _files
						}else{
							data[i] = _files[0]
						}
					}
				}

				var operation = {fields:fields, cmd:cmd, feature:feature, data:data, callback:callback};
				cms.executeOperation(operation);
				
			});	
		}else{
			var form = new formidable.IncomingForm();
			
			form.parse(req,function(err,fields,files){
				if(err) throw err;
						console.log('here');
				var data = sanitizeFields(feature,fields);
				for(var i in data){
					if(data[i] in files === true){
						data[i] = path.normalize(files[data[i]]['path']);
					}
				}
				var operation = {fields:fields, cmd:cmd, feature:feature, data:data, callback:callback};
				cms.executeOperation(operation);
			});
		}
		
	},
	executeOperation:function executeOperation(obj){
		for(var i in obj.data){
			var ftype = settings[obj.feature].local[i].type;
			if(ftype == 'select'){
				obj.data[i] = JSON.parse(obj.data[i]);
			}else if(ftype == "table"){
				obj.data[i] = JSON.parse(obj.data[i]);
			}
		}
		if(obj.cmd == 'update'){
			//expects obj.fields to hold data 'id'
			var id = obj.fields.id;
			//console.log(obj);
			if(typeof id == 'undefined' && settings[obj.feature].local.single != true){
				//upsert reference fields
				obj.callback("no id found to update");
				return;
			}
			cms.update(obj.feature, id, obj.data,function(err, doc){
				if(err){
					obj.callback(err);
					return;
				}
				
				cms[obj.feature].findOne({_id:id},function(err,doc){
					var schema = getSchema(obj.feature);
					obj.callback(null, {schema: schema , docs:doc});				
				});
				
			});
		}
		
		if(obj.cmd == "add"){
			cms.save(obj.feature, obj.data, obj.callback);
		}
	},
	save:function save(feature,data,callback){
		//console.log(data);
		var document = new cms[feature](data);
		document.save(callback);
	},
	update:function update(feature, id, data, callback){
		var update = {};
		for(var i in data){
			if(data.length){
				if(!update.$addToSet){
					update.$addToSet = {};
				}
				update.$addToSet[i] = {};
				update.$addToSet[i].$each = data[i];
			}else{
				if(!update.$set){
					update.$set = {};
				}
				update.$set[i] = data[i];
			}
		
		}
		if(settings[feature].local.single == true){
			return cms[feature].update({}, update, {upsert:true},callback);
		}
		cms[feature].update({_id:id}, update, callback);

	},
	pageStructure:function generateMainPages(filter){
		//return _.groupBy(_.keys(settings),function(e){return e.split("_")[0]});
		var modules = filter ? _.pluck(filter,"module") : _.keys(settings);
		var obj = {};
		modules.forEach(function(feature){
			var feat = feature.split("_");
			var parent = feat[0];
			if(settings[feature].statics.render == false){
				return;
			}
			if(typeof obj[parent] == 'undefined'){
				obj[parent] = [];
			}
			var opt = _.extend(settings[feature].statics, {name:feature});
			obj[parent].push(opt);
		});
		return obj

	},
	get:function get(feature,query,callback){
		if(arguments.length == 2){
			var callback = query;
			var query = {}; 
		}
		module.exports[feature].find(query,function(err,docs){
			if(err){
				callback(err);
				return;
			}
			var schema = getSchema(feature);
			if(!schema){
				return callback("error");
			}
			var statics = getSchemaStatics(feature);
			console.log(settings[feature].statics);
			//get data for 'source' attribute
			async.forEach(_.keys(schema),
				function(item, done){
					if(!schema[item].source){
						done(null,null);
					}else{
						var str = schema[item].source.split(".");
						var collection = str[0];
						var field = str[1];
						var filter = {};
						filter[field] = 1;
						
						module.exports[collection].find(query,filter, function(err, docs){
							schema[item].data=docs;
							done(null,null);
						});					
						
					}
				}, 
				function(err){
					callback(null, {feature:feature, schema:schema, statics:statics, docs:docs});
				}
			);
			
		});
	},
	prepare:function prepare(page,callback){
		var collect = [];
		for(var i in settings){
			if(i.indexOf(page) !== 0)	
				continue;
			collect.push(i);
		}
		async.map(collect, cms.get, function(err, results){
			var obj = {};
			results.forEach(function(r){
				obj[r['feature']] = r['docs'];
			});
			callback(null, obj);
		});
	},
	run: function(fn){
		fn();
	}
}

var db = mongoose.createConnection('127.0.0.1',cms.db);
