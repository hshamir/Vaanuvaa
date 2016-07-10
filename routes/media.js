var express = require('express');
var mongoose = require('mongoose');
var async = require('async');
var request = require('request');
var cheerio = require('cheerio');
var _ = require('underscore');
var conf = require('../config');
var fs = require('fs');
var prettyBytes = require('pretty-bytes');
var servers = require('../lib/fileservers');
var rndm = require('rndm');
var path = require('path');
var mv = require('mv');
var fse = require('fs-extra');
var validUrl = require('valid-url');
var sms = require('../lib/sms');
var path = require('path');
var gm = require('gm');
var mime = require('mime');
var jade = require('jade');
var moment = require('moment');
var crypto = require('crypto');
var filterMedia = require('../lib/util').filterMedia;
var saveImage = require('../lib/util').saveImage;
var validator = require('validator');

_.str = require('underscore.string');

require('../lib/models/Media.js');

var Media = mongoose.models.Media;
var User = mongoose.models.User; 
var Ad = mongoose.models.Ad; 
var renderPage = require('../lib/render_page').renderPage;

var authenticate = require('./authenticate').authenticate;
var authenticateAdmin = require('./authenticate').authenticateAdmin;

var router = express.Router();

router.get('/find', authenticate, function(req, res,next) {
	var type = req.query.type;
	var query = req.query.query;
	var q = {type:type};
	var or = [{description_dv:new RegExp(query, 'ig')},{description_en:new RegExp(query, 'ig')},{tags:new RegExp(query, 'ig')}];
	if(validator.isMongoId(query)){
		q._id = query;
	}else{
		q['$or'] = or;
	}
	Media
	.find(q)
	.lean()
	.sort({_id:-1})
	.limit(20)
	.exec(function(err, r){
		if(err){
			return next(err);
		}
		res.json(r);
	})
})
router.post('/image', authenticate, function(req, res,next) {
	saveImage("upload", req, function(err, media){
		if(err){
			return next(err);
		}
		res.json(media);
	});
});

module.exports = router;
