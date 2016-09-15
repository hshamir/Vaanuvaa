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
var Album = mongoose.models.Album; 
var renderPage = require('../lib/render_page').renderPage;

var authenticate = require('./authenticate').authenticate;
var authenticateAdmin = require('./authenticate').authenticateAdmin;

var router = express.Router();

router.get('/', authenticate, function(req, res,next) {
	res.render('media');
})
router.get('/albums', authenticate, function(req, res,next) {
	var name = req.query.name;
	var limit = 20;
	Album
	.find({name:new RegExp(name,'i')})
	.lean()
	.exec(function(err, albums){
		albums = albums.map(function(album){
			album.time_long = moment(album.time).format("DD/MM/YYYY");
			return album;
		})
		res.json(albums);
	})
})
router.get('/album/:id', authenticate, function(req, res,next) {
	var id = req.params.id;
	Media
	.find({album:id})
	.lean()
	.exec(function(err, media){
		res.json(media);
	})
})
router.get('/add-media', authenticate, function(req, res,next) {
	var a = jade.renderFile('views/evals/add-media-dialog.jade',{album:req.query.album});
	res.json({html:a});		
})
router.get('/new-album', authenticate, function(req, res,next) {
	var a = jade.renderFile('views/evals/album-new.jade');
	res.json({html:a});		
})
router.post('/new-album', authenticate, function(req, res,next) {
	async.waterfall([
		function validate(fn){
			if(!req.body.name || req.body.name == ""){
				return fn("Invalid name");
			}
			fn();
		},
		function save(fn){
			new Album(req.body)
			.save(function(err, d){
				fn(err);
			})
		}
	], function(err){
		var html='';
		if(err){
			html = jade.renderFile('views/evals/error.jade', {error:err});
		}else{
			html = '<script>$(".modal").modal("hide")</script>';
		}
		res.json({html:html});
	})		
})
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
router.post('/:id/info', authenticate, function(req, res,next) {
	var id = req.params.id;
	req.body.tags = req.body.tags.split(",");
	req.body.tags = _.compact(req.body.tags);
	req.body.tags = req.body.tags.map(function(t){
		return t.trim();
	})
	Media.update({_id:id},{$set:req.body}, function(err, c){
		if(err){
			return res.json({error:err});
		}
		Media
		.findOne({_id:id})
		.lean()
		.exec(function(err, m){
			res.json(m);
		})
	})
});

module.exports = router;
