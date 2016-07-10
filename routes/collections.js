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
var Canvas = require('canvas');
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
var setPrice = require('../lib/util').setPrice;

_.str = require('underscore.string');

require('../lib/models/Media.js');

var Media = mongoose.models.Media;
var User = mongoose.models.User; 
var Ad = mongoose.models.Ad; 
var renderPage = require('../lib/render_page').renderPage;

var authenticate = require('./authenticate').authenticate;
var authenticateAdmin = require('./authenticate').authenticateAdmin;

var router = express.Router();

router.get('/',  function(req, res) {
	getCols(function(err, collections){
		if(err){
			console.log(err);
			return res.redirect('/');
		}
		renderPage(req,res,function(err,page){
			request('http://127.0.0.1:3067/collections', function(err, resp, body){
				page.collections = collections;
				res.render('collections',page);
			});
		});	
	})
});
router.get('/:id',  function(req, res) {
	getCols(req.params.id, function(err, collections){
		if(err){
			console.log(err);
			return res.redirect('/');
		}
		renderPage(req,res,function(err,page){
			request('http://127.0.0.1:3067/collections', function(err, resp, body){
				page.collections = collections;
				res.render('collections',page);
			});
		});	
	})
});
router.get('/:id/image.png',  function(req, res) {
	var  Image = Canvas.Image
	var  canvas = new Canvas(600, 240)
	var  ctx = canvas.getContext('2d');
	var files;
	async.waterfall([
		function getCollection(fn){
			getCols(req.params.id, function(err, cols){
				if(err){
					return fn(err);
				}
				files = cols[0].medias.map(function(m){
					return "/root/images/posters/" + m._id + ".jpg";
				});
				console.log(files);
				fn();
			});
		},
		function readFiles (fn) {
			async.map(files, fs.readFile, fn);
		},
		function(files, fn){
			files = files;
			fn();
		},
		function concat(fn){
			var edge = 0;
			files.forEach(function(file, i){
				var img = new Image;
				img.src = file;
				var width = 200;
				var height = Math.round(img.height * width / img.width);
				ctx.drawImage(img, edge, 0, width, height);
				edge += width;
			});
			fn();
		}
	], function(err){
		if(err){
			console.log(err);
			return res.end();
		}
		var stream = canvas.pngStream();
		stream.pipe(res);
	})
});
function getCols(){
	var fn;
	var _id;
	if(arguments.length == 1){
		fn=arguments[0];
	}
	if(arguments.length == 2){
		_id=arguments[0];
		fn=arguments[1];
	}
	var collections;
	var json;
	async.waterfall([
		function getCollections(fn){
			var url = _id ? "collection/" + _id : 'collections';
			request('http://127.0.0.1:3067/' + url, function(err, resp, body){
				try{
					json = JSON.parse(body);
					if(_id){
						json = [json];
					}
					fn();
				}catch(e){
					fn("error parsing json");
				}
			});		
		},
		function map(fn){
			async.map(json, function(col, done){
				async.map(col.medias, function(id, done){
					console.log(id)
					Media
					.findOne({_id:id})
					.lean()
					.exec(done);
				}, function(err, d){
					col.medias = d;
					done(err, col);
				});
			}, function(err, cols){
				console.log(cols)
				collections = cols
				fn(err, collections);
			})
		}
	], fn)
}

module.exports = router;
