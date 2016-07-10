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
var df = require('node-df');

_.str = require('underscore.string');

require('../lib/models/Article.js');

var Article = mongoose.models.Article;
var User = mongoose.models.User; 
var renderPage = require('../lib/render_page').renderPage;

var authenticate = require('./authenticate').authenticate;
var authenticateAdmin = require('./authenticate').authenticateAdmin;

var router = express.Router();

router.get('/', function(req, res) {
	renderPage(req,res,function(err,page){
		res.render('insight', page);
	});
});

router.get('/:type', function(req, res, next) {
	var type = req.params.type;
	if(!Insight[type] || typeof Insight[type] == "undefined"){
		return next(new Error("invalid request"));
	}
	Insight[type](function(err, data){
		var a = jade.renderFile('views/evals/insight-'+type+'.jade',{data:data});
		res.json({html:a});
	})
});

var Insight = {
	articles: function(fn){
		async.auto({
			total: function(fn){
				Article.count({}, fn)
			},
			total_today: function(fn){
				Article.count({time:{$gt:moment().startOf('today')}, published:true}, fn)
			},
			total_week: function(fn){
				Article.count({time:{$gt:moment().startOf('week')}, published:true}, fn)
			},
			total_month: function(fn){
				Article.count({time:{$gt:moment().startOf('month')}, published:true}, fn)
			},
			total_year: function(fn){
				Article.count({time:{$gt:moment().startOf('year')}, published:true}, fn)
			},
			top_all: function(fn){
				Article
				.find({published:true}, {title:1, article_number:1, views:1})
				.sort({views:-1})
				.limit(20)
				.exec(fn);
			},
			top_today: function(fn){
				Article
				.find({published:true, time:{$gt:moment().startOf('today')}}, {title:1, article_number:1, views:1})
				.sort({views:-1})
				.limit(20)
				.exec(fn);
			},
			top_week: function(fn){
				Article
				.find({published:true, time:{$gt:moment().startOf('week')}}, {title:1, article_number:1, views:1})
				.sort({views:-1})
				.limit(20)
				.exec(fn);
			},
		}, fn);
	},
	writers: function(fn){
		async.auto({
			overall:function(fn){
				var agg = [
					{
						$group:{
							_id:'$user.username', 
							count: { $sum: 1 },
						}
					}
				];
				Article
				.aggregate(agg)
				.exec(fn);
			},
			today:function(fn){
				var agg = [
					{ $match: { time: { $gte: moment().startOf('day').toDate() } } },
					{
						$group:{
							_id:'$user.username', 
							count: { $sum: 1 },
						}
					}
				];
				Article
				.aggregate(agg)
				.exec(fn);
			},
			yesterday:function(fn){
				var agg = [
					{ $match: { time: { $gte: moment().startOf('day').subtract('days', 1).toDate(), $lt: moment().startOf('day').toDate() } } },
					{
						$group:{
							_id:'$user.username', 
							count: { $sum: 1 },
						}
					}
				];
				Article
				.aggregate(agg)
				.exec(fn);
			},
			week:function(fn){
				var agg = [
					{ $match: { time: { $gte: moment().startOf('week').toDate() } } },
					{
						$group:{
							_id:'$user.username', 
							count: { $sum: 1 },
						}
					}
				];
				Article
				.aggregate(agg)
				.exec(fn);
			},
			last_week:function(fn){
				var agg = [
					{ $match: { time: { $gte: moment().startOf('week').subtract('weeks', 1).toDate(), $lt: moment().startOf('week').toDate() } } },
					{
						$group:{
							_id:'$user.username', 
							count: { $sum: 1 },
						}
					}
				];
				Article
				.aggregate(agg)
				.exec(fn);
			},
			month:function(fn){
				var agg = [
					{ $match: { time: { $gte: moment().startOf('month').toDate() } } },
					{
						$group:{
							_id:'$user.username', 
							count: { $sum: 1 },
						}
					}
				];
				Article
				.aggregate(agg)
				.exec(fn);
			},
			last_month:function(fn){
				var agg = [
					{ $match: { time: { $gte: moment().startOf('month').subtract('months', 1).toDate(), $lt: moment().startOf('month').toDate() } } },
					{
						$group:{
							_id:'$user.username', 
							count: { $sum: 1 },
						}
					}
				];
				Article
				.aggregate(agg)
				.exec(fn);
			},
		}, fn);
	}
}
module.exports = router;
