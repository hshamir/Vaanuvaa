var express = require('express');
var mongoose = require('mongoose');
var async = require('async');
var request = require('request');
var cheerio = require('cheerio');
var _ = require('lodash');
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
var mapDoc = require('../lib/util').mapDoc;
var mapContents = require('../lib/util').mapContents;
var share = require('../lib/util').share;
var ExifImage = require('exif').ExifImage;
var validator = require('validator');

_.str = require('underscore.string');


var Article = mongoose.models.Article;
var Media = mongoose.models.Media;
var User = mongoose.models.User; 

var renderPage = require('../lib/render_page').renderPage;

var authenticate = require('./authenticate').authenticate;
var authenticateAdmin = require('./authenticate').authenticateAdmin;

var router = express.Router();

router.get('/list', authenticate, function(req, res){
	var type = req.query.type;
	var q = {published:true};
	if(type == "unpublished"){
		q.published = false;
	}
	if(type == "live"){
		q.live_event = true;
	}
	Article
	.find(q, {revisions:0})
	.lean()
	.limit(30)
	.sort({article_number:-1})
	.exec(function(err, docs){
		// async.map(docs, mapDoc, function(err, docs){
		// 	res.json(docs);
		// })
		docs = docs.map(function(doc){
			doc.time_pretty = moment(doc.time).fromNow();
			doc.time_formatted = moment(doc.time).format("MMMM Do YYYY");
			doc.time_pretty_dv = moment(doc.time).locale('dv').fromNow();
			return doc;
		})
		res.json(docs);
	})
});
router.get('/unapproved-comments', authenticate, function(req,res){
	Article
	.aggregate([
		{$match:{'comments.approved':false}},
		{
			$project:{
				title:1,
				comments:1,
				article_number:1
			}
		}
	])
	.exec(function(err, docs){
		if(err){
			return fn(err);
		}
		var docs = docs.map(function(d){
			d.comments = d.comments.map(function(c){
				c.time_pretty = moment(c.time).format('YYYY-MM-DD HH:mm')
				return c;
			})
			return d;
		})
		res.json(docs);
	});
});
router.post('/:id/remove', authenticate, function(req, res){
	var article_number = req.params.id;
	article_number = parseInt(article_number);
	var art;
	async.waterfall([
		function find(fn){
			Article
			.findOne({article_number:article_number})
			.lean()
			.exec(function(err, d){
				art = d;
				fn(err);
			})
		},
		function validate(fn){
			console.log(art)
			if(!art){
				return fn("article not found");
			}
			if(req.user.hasAccess('editor') == false){
				if(art.user.username != req.user.username){
					return fn("You must be the author of the article or an editor to delete it.")
				}
			}
			if(art.published){
				return fn("Please unpublish it first.");
			}
			fn();
		},
		function remove(fn){
			Article.remove({article_number:article_number}, fn)
		}
	], function(err){
		if(err){
			return res.json({error:err});
		}
		res.json({success:true});
	})
})
router.post('/approve-comment', authenticate, function(req, res){
	var id = req.body.id;
	var set = {
		'comments.$.approved':true,
		'comments.$.approved_user':{
			username:req.user.username,
			name:req.user.name,
			id:req.user._id
		}
	}
	Article
	.update({'comments._id':id},{$set:set})
	.exec(function(err, c){
		if(err){
			return res.json({error:err})
		}
		if(c==0){
			res.json({error:"Error approving"});
		}else{
			res.json({success:true});
		}
	});
});
router.get('/:id', authenticate, function(req, res){
	var id = req.params.id;
	Article
	.findOne({article_number:id})
	.lean()
	.exec(function(err, doc){
		mapContents(doc, function(err, d){
			if(err){
				return res.json({error:err});
			}
			res.json(doc);
		});
	});
});
router.post('/', authenticate, createOrUpdateArticle);
router.post('/:num/comment', authenticate, function(req,res,next){
	var num = req.params.num;
	async.waterfall([
		function validate(fn){
			var c = req.body.comment;
			if(!c || c == "" || c.length < 10){
				fn("ފޮނުއްވި ޚިޔާލު މާ ކުރު.")
			}else if(c.length > 2000){
				fn("ޚިޔާލު މާ ދިގު")
			}else{
				fn();
			}
		},
		function update(fn){
			var comment = {
				comment:req.body.comment,
				user:{
					id:req.user._id,
					username:req.user.username,
					name:req.user.name
				},
				ip:req.ip,
				date:new Date()
			};
			console.log(comment);
			Article.update({article_number:parseInt(num)},{$push:{comments:comment}}, function(err, c){
				if(err){
					fn(err)
				}else{
					fn()
				}
			})
		}
	], function(err){
		if(err){
			return next(err);
		}
		res.json({success:true, message:'ފޮނުއްވި ޚިޔާލު ލިބިެއްޖެ, ކުޑަ އިރުކޮޅެއްގެ ތެރޭގައި ޝާއިޢު ކުރެވޭނެ!'});
	})
});
router.post('/:id', authenticate, createOrUpdateArticle);
router.post('/:id/toggle-publish', authenticate, function(req,res){
	Article
	.findOne({article_number:req.params.id})
	.lean()
	.exec(function(err, d){
		if(req.user.hasAccess('editor') == false){
			return res.json({error:'Permission denied, you must be an editor to publish and unpublish articles'});
		}
		var newstatus = d.published ? "publish" : "unpublish";
		var _newstatus = d.published ? false : true;
		if(!d.social_media_posted){
			//post twitter/fb..etc
			share(d.article_number);
		}
		d.social_media_posted = true;
		Article.update({article_number:req.params.id},{$set:{published:_newstatus, social_media_posted:true}}, function(err, c){
			res.json({new_status:newstatus});
		})
	})
});

function createOrUpdateArticle (req, res, next) {
	var id = req.params.id;
	var doc;
	var data = req.body.data;
	async.waterfall([
		function valid(fn){
			try{
				data = JSON.parse(data);
				console.log(data);
			}catch(e){
				return fn(e)
			}
			fn();
		},
		function createIfNotExists(fn){
			if(id){
				return fn();
			}
			var d = new Article(data);
			d.ip = req.ip;
			d.user = {username:req.user.username, name:req.user.name};
			d.published = false;
			Article.getNextArticleNumber(function(err, n){
				d.article_number = n;
				d.save(function(err, d){
					doc = d;
					fn(err);
				})
			});
		},
		function find(fn){
			if(!id){
				return fn();
			}			
			Article
			.findOne({article_number:id},{revisions:0})
			.lean()
			.exec(function(err, e){
				fn(err, e)
			});
		},
		function updateIfExists(existing, fn){
			if(!id){
				return arguments[0]();
			}
			//filter removed ids
			data.contents = data.contents.map(function(e){
				if(e.time == "" || e.time == undefined){
					e.ip =  req.ip;
					e.user =  {username:req.user.username, name:req.user.name};
					e.time =  new Date();
				}else{
					e.time = new Date(e.time);
				}
				return e;
			});
			data.last_updated_time = new Date();
			if(data.revisions){
				delete data.revisions;
			}
			Article.update({article_number:id},{$set:data, $push:{revisions:existing}}, function(err, c){
				if(err){
					return fn(err);
				}
				fn();
			});
		},
		function find(fn){
			if(!id){
				return fn();
			}			
			Article
			.findOne({article_number:id})
			.lean()
			.exec(function(err, d){
				mapDoc(d, function(err, d){
					doc = d;
					fn(err);
				});
			});
		}
	], function(err){
		if(err){
			return res.json(err);
		}

		res.json(doc);
	});
}


module.exports = router;
