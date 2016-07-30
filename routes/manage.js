var express = require('express');
var mongoose = require('mongoose');
var async = require('async');
var _ = require('underscore');
var conf = require('../config');
var fs = require('fs');
var fse = require('fs-extra');
var prettyBytes = require('pretty-bytes');
var validator = require('validator');
var sms = require('../lib/sms');
//var Media = mongoose.models.Media;
var User = mongoose.models.User;
var UserGroup = mongoose.models.UserGroup;
var Log = mongoose.models.Log;
var Article = mongoose.models.Article;
var Pool = require('mysql-simple-pool');
var nodemailer = require('nodemailer');
var renderPage = require('../lib/render_page').renderPage;
var moment = require('moment');
var rndm = require('rndm');
var crypto = require('crypto');
var jade = require('jade');
var authenticate = require('./authenticate').authenticate;
var authenticateAdmin = require('./authenticate').authenticateAdmin;
var access = require('../lib/access').access;
var _str = require('underscore.string');
var router = express.Router();
var path = require('path');
var redis = require("redis").createClient();
var FB = require('fb');

router.get('/writers', authenticate, function(req, res, next) {
	renderPage(req,res, function(err, page){
		res.render('writers');
	});
});
router.get('/admins/add-facebook', authenticate, function(req, res, next) {
	FB.api('oauth/access_token', {
	    client_id: conf.facebook_client_id,
	    client_secret: conf.facebook_client_secret,
	    redirect_uri: 'http://vaanuvaa.mv/manage/admins/add-facebook',
	    code: req.query.code
	}, 
	function (resp) {
	    if(!resp || resp.error) {
	        console.log(!resp ? 'error occurred' : resp.error);
	        return;
	    }
	 
	    var accessToken = resp.access_token;
	    var expires = resp.expires ? resp.expires : 0;
		redis.hset('vaanuvaa-facebook', 'access_token', accessToken);
		redis.hset('vaanuvaa-facebook', 'code', req.query.code, function(err){
			if(err){
				return res.end(err);
			}
			res.redirect('/manage/admins');
		});
	});
});
router.get('/admins', authenticate, function(req, res, next) {
	renderPage(req,res, function(err, page){
		async.auto({
			fb_url:function(fn){
				var u = FB.getLoginUrl({
				    scope: 'pages_show_list',
				    redirect_uri: 'http://vaanuvaa.mv/manage/admins/add-facebook',
				    appId:conf.facebook_client_id
				});
				fn(null, u);
			},
		}, function(err, p){
			res.render('admins',p);
		})
	});
});

router.get('/write', authenticate, function(req, res, next) {
	var r = {
		id:null
	}
	if(req.query.parent){
		r.parent = parseInt(req.query.parent)
	}
	renderPage(req,res, function(err, page){
		res.render('write',r);
	});
});
router.get('/write/:id', authenticate, function(req, res, next) {
	Article
	.findOne({article_number:req.params.id})
	.lean()
	.exec(function(err, d){
		if(!d){
			return res.redirect("/manage/writers");
		}
		if(d.user.username == req.user.username || req.user.hasAccess("editor")){
			renderPage(req,res, function(err, page){
				res.render('write',{id:req.params.id});
			});
		}else{
			res.end("You don't have permission to edit this article.")
		}
	})
});
module.exports = router;