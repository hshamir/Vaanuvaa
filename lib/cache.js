var generatePage = require('./util')._generatePage;
var async = require('async');
var mongoose = require('mongoose');
var conf = require('../config');
var redis = require("redis").createClient();
var host = '127.0.0.1';
if(conf.host){
	host = conf.host
}
mongoose.connect('mongodb://'+host+':27017/' + conf.db,{server:{poolSize:5}});

require('./models/Article')
require('./models/Media')
require('./models/User')
require('./models/Log')
require('./models/UserGroup')
require('./models/Ad')
require('./models/Background')
require('./models/Harvest')

generatePage(function(err, data){
	redis.set("vaanuvaa", JSON.stringify(data), function(err){
		setTimeout(function(){ next(); }, 5000);
	})
})