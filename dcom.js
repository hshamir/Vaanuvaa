console.log('Worker started: pid ' + process.pid);
//require('./lib/crons');
console = require('tracer').console();
var express = require('express');
var path = require('path');
var favicon = require('static-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var stylus = require('stylus');
var jade_browser = require('jade-browser');
var passport = require('passport');
var passport_local = require('passport-local').Strategy;
var conf = require('./config');
var session = require('express-session');
var MongoStore = require('connect-mongo')(session);
var crypto = require('crypto');
var compress = require('compression');
var multer = require('multer');
var fs = require('fs');
var async = require('async');
var imagetype = require('imagetype');
var imagesize = require('image-size');
var rndm = require('rndm');
var fse = require('fs-extra');
var _ = require('underscore');
var argv = require('optimist').argv;
var request = require('request');
var uuid = require('uuid');
var df = require('node-df');
var prettyBytes = require('pretty-bytes');
var mime = require('mime');
var moment = require('moment');

//connect to db
var authenticate = require('./routes/authenticate').authenticate;
var authenticateAdmin = require('./routes/authenticate').authenticateAdmin;
var mongoose = require('mongoose');


var host = '127.0.0.1';
if(conf.host){
	host = conf.host
}
mongoose.connect('mongodb://'+host+':27017/' + conf.db,{server:{poolSize:5}});

require('./lib/models/Article')
require('./lib/models/Media')
require('./lib/models/User')
require('./lib/models/Log')
require('./lib/models/UserGroup')
require('./lib/models/Ad')
require('./lib/models/Background')
require('./lib/models/Harvest')

var mapDoc = require('./lib/util').mapDoc;

//routes
var manage = require('./routes/manage');
var media = require('./routes/media');
var article = require('./routes/article');
var user = require('./routes/user');
var insight = require('./routes/insight');
var usergroup = require('./routes/usergroup');
var ad = require('./routes/ad');
var harvest = require('./routes/harvest');

var Article = mongoose.models.Article;
var Ad = mongoose.models.Ad;
var User = mongoose.models.User;
var UserGroup = mongoose.models.UserGroup;
var Media = mongoose.models.Media;
var Log = mongoose.models.Log;


var rss = require('./lib/util').rss;
var generatePage = require('./lib/util').generatePage;
var generateCategoryPage = require('./lib/util').generateCategoryPage;
var generateSearchPage = require('./lib/util').generateSearchPage;
var getAds = require('./lib/util').getAds;


User.createIfNotExists({username:'administrator', password:'pass', type:'admin', groups:[{name:"admin"}]});

///passport
passport.use(new passport_local({
		usernameField: 'username',
		passwordField: 'password',
		passReqToCallback: true
	},
	function(req, username, password, done) {
		User.authenticate({username:username, password:password}, function(err, user){
			if(err) throw err;
			if(!user){
				return done(null, false, {msg: "Incorrect username or password"});
			}
			done(null, user);
		});
	}
));

passport.serializeUser(function(user, done) {
  done(null, user._id);
});

passport.deserializeUser(function(id, done) {
	User.findOne({_id:id, banned:false},{subscriptions:0,password:0, downloads:0})
	.lean()
	.exec(function(err, user){
		var u = 'user writer admin'.split(' ');
		user.level = u.indexOf(user.type);
		done(err, user);
	});
});

//utils

function hashMatch(hash, password){
	return hashPassword(password) === hash;
}

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.enable('trust proxy')
app.disable('x-powered-by')
app.use(favicon(path.join(__dirname, '/public/favicon.ico')));
//app.use(logger('combined'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(multer({includeEmptyFields: true}))
app.use(cookieParser(conf.cookie_secret));
app.use(stylus.middleware({ src: __dirname + '/public', force:true}));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'bower_components')));
app.use(express.static(path.join(__dirname, 'node_modules/emojione')));
app.use(jade_browser('/templates.js', '**', {root: __dirname + '/views/components', noCache:true})); 
app.use(function(req, res, next){
    res.header('Vary', 'Accept');
    next();
}); 
app.use(jade_browser('/manage-templates.js', '**', {root: __dirname + '/views/manage/', noCache:true})); 
app.use(
	compress({
		filter: function (req, res) {
			return /json|text|javascript|css/.test(res.getHeader('Content-Type'))
		},
		level: 9
	})
);

app.use(session({
	resave:true,
	saveUninitialized:true,
	secret: conf.cookie_secret, 
	store: new MongoStore({
		mongoose_connection:mongoose.connection
	}), 
	cookie: { maxAge: 1000 * 60 * 60 * 7 * 1000 ,httpOnly: false, secure: false}}));
app.use(passport.initialize());
app.use(passport.session());
app.use(function(req,res,next){
	res.locals._session = req.session;
	res.locals._user = req.user;
	if(req.user){
		res.locals._user.groups = res.locals._user.groups || [];
		res.locals._user.groups = res.locals._user.groups.map(function(g){return g.name});
		res.locals._user.hasAccess = function(){
			var groups = Array.prototype.slice.call(arguments, 0);
			var exists = true;
			groups.forEach(function(g){
				if(res.locals._user.groups.indexOf(g) == -1){
					exists = false;
				}
			});
			return exists;
		}
	}
	if(!req.session.uuid){
		req.session.uuid = uuid.v1();
	}
	next();
});

app.get('/', function(req,res,next){			
	generatePage(function(err, page){
		res.render('home-dv', page);
	})	
});
app.get('/privacy-fb', function(req,res,next){			
	generatePage(function(err, page){
		var privacy = [
			"<p>The app published content only from Dhivehi.com.mv</p>",
			"<p>Users privacy are protected in accordance to Facebook terms</p>",
		].join('')
		res.end("<html><body><h2>Privacy policy for Facebook</h2>"+privacy+"</body></html>");
	})	
});

app.get('/p', function(req,res){
	var q = req.query.q;
	if(!q){
		res.end();
	}
	request(q)
	.pipe(res);
});

app.get('/login', function(req,res){
	if (req.isAuthenticated()){
		if(req.query.type == "admin"){
			return res.render('login');
		}
		var url = '/';
		if(req.query.redirect){
			url = req.query.redirect;
		}
		if(req.xhr){
			res.json({success:true});
		}else{
			return res.redirect(url);
		}
	}
    res.render('login');
});
app.post(
	'/login',
	function(req,res,next){
		passport.authenticate('local', function(err, user, info){
			if(err){
				return next(err);
			}
			var fail = "An error occured.";
			if(!user){
				fail = "Username or password incorrect.";
				if(req.xhr){
					return next(fail);
				}else{
					return res.render('login',{msg:fail});
				}
			}
			req.logIn(user, function(err) {
      			if (err) { return next(err); }		
      			if(req.xhr){
      				res.json({success:true});
      			}else{		
					res.redirect(req.headers.referer);
				}
			})
		})(req, res, next);		
	}
);
app.post(
	'/login-anonymous',
	function(req,res,next){
		req.body.username = "anonymous";
		req.body.password = "bell cell sell";
		passport.authenticate('local', function(err, user, info){
			if(err){
				return next(err);
			}
			var fail = "An error occured.";
			if(!user){
				fail = "Username or password incorrect.";
				return res.render('login',{msg:fail});
			}
			req.logIn(user, function(err) {
      			if (err) { return next(err); }				
				res.redirect(req.headers.referer);
			})
		})(req, res, next);		
	}
);
app.get('/logout', function(req, res){
	req.session.destroy();
	req.logout();
	res.redirect('/');
});
app.use('/manage', manage);
app.use('/media', media);
app.use('/article', article);
app.use('/user', user);
app.use('/ad', ad);
app.use('/usergroup', usergroup);
app.use('/insight', insight);
//app.use('/harvest', harvest);

app.get('/rss', function(req, res, next){
	rss(function(err, r){
		res.end(r);
	})
});
app.get('/search', function(req, res, next){
	generateSearchPage(req,res, function(err, page){
		res.render('search-dv', page);
	})	
});
app.get('/category/:cat', function(req, res, next){
	generateCategoryPage(req,res, function(err, page){
		res.render('category-dv', page);
	})	
});
app.get('/category/:cat/since/:since', function(req, res, next){
	generateCategoryPage(req,res, function(err, page){
		res.render('category-dv', page);
	})	
});
app.get('/live', function(req, res, next){
	var id = req.params.id;
	async.auto({
		ads:getAds,
		latest_all_articles:function(fn){
			var q = {published:true, entry_type:'News Article'};
			Article
			.find(q,{revisions:0})
			.sort({article_number:-1})
			.limit(6)
			.lean()
			.exec(function(err, d){
				async.map(d, mapDoc, fn);
			})
		}
	}, function(err, p){
		if(err){
			return res.json({error:err});
		}
		var d = p;
		d.ads = p.ads;
		d.latest_all_articles = p.latest_all_articles;
		d.channel = req.query.s || "dhitv";
		res.render('live',d);
	})
});
app.get('/:id', function(req, res, next){
	var id = req.params.id;
	async.auto({
		article:function(fn){
			Article
			.findOne({article_number:id},{revisions:0})
			.lean()
			.exec(function(err, doc){
				mapDoc(doc, fn);
			});
		},
		ads:getAds,
		latest_all_articles:function(fn){
			var q = {published:true, entry_type:'News Article'};
			Article
			.find(q,{revisions:0})
			.sort({article_number:-1})
			.limit(6)
			.lean()
			.exec(function(err, d){
				async.map(d, mapDoc, fn);
			})
		}
	}, function(err, p){
		if(err){
			return res.json({error:err});
		}
		var d = p.article;
		d.ads = p.ads;
		d.latest_all_articles = p.latest_all_articles;
		d.comments = d.comments.map(function(c){
			c.time_pretty = moment(c.time).fromNow()
			return c;
		})
		res.render('article',d);
		Article.update({article_number:id},{$inc:{views:1}},function(err, c){});
	})
});

function filter(obj){
	if(!obj){
		return [];
	}
	if(!obj.length){
		obj = [obj]
	};
	var ret = obj.map(function(r){
		if(!r){
			return
		}
		r.url = 'http://video2home.net/bg/' + r.file;
		delete r.ip;
		delete r.__v;
		return r;
	});
	return ret;
}


/// catch 404 and forwarding to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

/// error handlers

// development error handler
// will print stacktrace
//if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.json({
            message: err.message,
            error: err
        });
    });
//}

// production error handler
// no stacktraces leaked to user

app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.end(err || "");
});

console.log(conf.port)
var server = app.listen(argv.p || conf.port);

module.exports = app;
