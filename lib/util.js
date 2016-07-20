var mongoose = require('mongoose');
var async = require('async')
var moment = require('moment');
var request = require('request');
var rndm = require('rndm');
var fs = require('fs');
var path = require('path');
var ExifImage = require('exif').ExifImage;
var _ = require('lodash');
var conf = require('../config');
var fse = require('fs-extra');
require('./models/Ad')
require('./models/Article')
require('./models/Media')
var Article = mongoose.models.Article;
var Media = mongoose.models.Media;
var User = mongoose.models.User;
var Ad = mongoose.models.Ad;
var redis = require("redis").createClient();
var FB = require('fb');
var Twitter = require('twitter');
var cheerio = require('cheerio');
 
var tw = new Twitter({
  consumer_key: conf.twitter_ck,
  consumer_secret: conf.twitter_cs,
  access_token_key: conf.twitter_at,
  access_token_secret: conf.twitter_ats
});
exports.share = function(article_number){
	Article.findOne({article_number:article_number})
	.lean()
	.exec(function(err, article){
		exports.mapDoc(article, function(err, article){
			async.parallel([
				function facebook(){
					redis.hget('facebook', 'access_token', function(err, access_token){
						request('https://graph.facebook.com/'+conf.facebook_page+'?fields=access_token&access_token='+access_token, function(err, req, body){
							var access_token = "";
							try{
								var j = JSON.parse(body);
								access_token = j.access_token;
							}catch(e){}
							FB.setAccessToken(access_token);
							FB.api(conf.facebook_page+'/feed', 'post', { message: "http://dhivehi.com.mv/"+article_number, link: "http://dhivehi.com.mv/"+article_number }, function (res) {
								console.log(res)
							});
						})
					})
				},
				function twitter(){
					if(!article.image){
						return;
					}
					var img = path.join(conf.images_location, article.image.file.name);
					fs.readFile(img, function(err, data){
						if(err){
							return;
						}
						tw.post('media/upload',{media:data}, function(err, m, r){
							var status = article.title_latin || article.title;
							status += " http://dhivehi.com.mv/"+article_number;
							var status = {
								status:status,
								media_ids: m.media_id_string
							};
							tw.post('statuses/update', status, function(error, tweet, response){
							})
						})
					})
				}
			])
		});
	})
}
exports.breakingNews = function(fn){
	Article
	.find({published:true, type:'Breaking News'},{revisions:0})
	.sort({article_number:-1})
	.lean()
	.exec(function(err, d){
		async.map(d, exports.mapDoc, function(err, docs){
			fn(null, docs);
		});
	})	
}
exports.rss = function(fn){

	Article
	.find({published:true},{revisions:0})
	.sort({article_number:-1})
	.limit(20)
	.lean()
	.exec(function(err, d){
		async.map(d, exports.mapDoc, function(err, docs){
			var html=""
			docs.forEach(function(d){
				var x = [
					'<item>',
					'<title>'+d.title+'</title>',
					'<link>http://dhivehi.com.mv/'+d.article_number+'</link>',
					'<description>'+d.description+'</description>',
					'<pubDate>'+d.time+'</pubDate>',
					'<media:content url="http://dhivehi.com.mv'+d.image.file.sizes.mediumsmall+'" type="image/jpeg"/>',
					'<content>'+d.contents.map(function(c){return c.type == "paragraph-dv" ? c.content : "";}).join('\n')+'</content>',
					'</item>',
				].join('\n');
				html += x;
			})
			var c = [
				'<?xml version="1.0" encoding="UTF-8"?>',
				'<rss version="2.0"\
				xmlns:media="http://search.yahoo.com/mrss/"\
				xmlns:atom="http://www.w3.org/2005/Atom"\
				>',
				'<channel>',
				'<title>Dhivehi Online</title>',
				'<atom:link href="http://dhivehi.com.mv/rss" rel="self" type="application/rss+xml" />',
				'<description>Latest news from Dhivehi Online</description>',
				'<language>dv</language>',
				html,
				'</channel>',
				'</rss>'
			].join("\n")
			fn(null, c)
		});
	});	
}
exports._generatePage = generatePage;

exports.generatePage = function(fn){
	redis.get('vaanuvaa', function(err, d){
		var data = JSON.parse(d);
		fn(null, data);
	})
}

function generatePage(fn){
	async.auto({
		breaking:exports.breakingNews,
		popular:function(fn){
			Article
			.find({published:true, time:{$gt:moment().subtract(10,'day').toDate()}},{revisions:0})
			.sort({views:-1})
			.limit(4)
			.lean()
			.exec(function(err, d){
				async.map(d, exports.mapDoc, function(err, docs){
					fn(null, docs);
				});
			})
		},
		show_in_top_news:function(fn){
			Article
			.find({published:true, show_in_top_news:true},{revisions:0})
			.sort({views:-1})
			.limit(10)
			.lean()
			.exec(function(err, d){
				async.map(d, exports.mapDoc, function(err, docs){
					fn(null, docs);
				});
			})
		},
		show_in_latest_news:function(fn){
			Article
			.find({published:true, show_in_latest_news:true},{revisions:0})
			.sort({views:-1})
			.limit(10)
			.lean()
			.exec(function(err, d){
				async.map(d, exports.mapDoc, function(err, docs){
					fn(null, docs);
				});
			})
		},
		homepage_main_top:function(fn){
			Article
			.findOne({published:true, top_article:true, type:{$ne:'Breaking News'}},{revisions:0})
			.sort({article_number:-1})
			.lean()
			.exec(function(err, d){
				if(d)
					exports.mapDoc(d, fn)
				else
					fn();
			})
		},
		popular_week:function(fn){
			Article
			.find({published:true, time:{$gt:moment().subtract(7,'day').toDate()}},{revisions:0})
			.sort({views:-1})
			.limit(6)
			.lean()
			.exec(function(err, d){
				async.map(d, exports.mapDoc, function(err, docs){
					fn(null, docs);
				});
			})
		},
		homepage_main:function(fn){
			Article
			.find({published:true, type:{$ne:'Breaking News'}},{revisions:0})
			.sort({article_number:-1})
			.limit(20)
			.lean()
			.exec(function(err, d){
				async.map(d, exports.mapDoc, function(err, docs){
					//docs = docs.reverse();
					//find top article
					var ret = {
						main_article:docs.shift(),
						second_main_article:docs.shift(),
						primary_article_list:docs.splice(0,3),
						secondary_article_list:docs.splice(0,6)
					}
					fn(null, ret);
				});
			});
		},
		galleries:function(fn){
			Article
			.find({published:true, entry_type:"Gallery"},{revisions:0})
			.sort({article_number:-1})
			.limit(3)
			.lean()
			.exec(function(err, d){
				async.map(d, exports.mapDoc, function(err, docs){
					docs = docs.map(function(d){
						d.contents.splice(3);
						return d;
					})
					fn(null, docs);
				});
			});
		},
		categories:function(fn){
			var agg = [
				{
					$group : {
						_id : '$category', 
						count : {$sum : 1}
					}
				}
			]
			Article
			.aggregate(agg)
			.exec(function(err, g){
				var c = _.sortBy(g, 'count');
				var raajje = _.find(c, function(r){
					return  "ރާއްޖެ".indexOf(r._id) != -1;
				});
				c = _.filter(c, function(r){
					return  "ރާއްޖެ ޚަބަރު Uncategorized post-format-quote".indexOf(r._id) == -1;
				});
				c.push(raajje);
				c = c.reverse();
				async.map(c, function(cat, done){
					var c = cat._id;
					Article
					.find({category:c, published:true},{revisions:0})
					.sort({article_number:-1})					
					.limit(6)
					.lean()
					.exec(function(err, articles){
						async.map(articles, exports.mapDoc, function(err, a){
							var ret = {
								category:c,
								articles:a
							}
							done(null, ret);
						});						
					})
				},fn);
			});
		},
		ads:exports.getAds
	},function(err, d){
		d.homepage_main.primary_article_list = d.show_in_latest_news.concat(d.homepage_main.primary_article_list);
		d.homepage_main.primary_article_list = d.homepage_main.primary_article_list.splice(0,3);
		d.popular = d.show_in_top_news.concat(d.popular);
		d.popular = d.popular.splice(0,4);
		fn(err, d)
	})
}
exports.generateCategoryPage = function(req, res, fn){
	var cat = req.params.cat;
	if(!cat || cat == ""){
		return res.redirect('/');
	}

	async.auto({
		articles:function(fn){
			var q;
			if(cat == "gallery"){
				q = {published:true, entry_type:'Gallery'};
			}else{				
				q = {published:true, entry_type:'News Article', category:cat};
			}
			if(req.params.since){
				q.article_number = {$lt:parseInt(req.params.since)}
			}
			Article
			.find(q,{revisions:0})
			.sort({article_number:-1})
			.limit(20)
			.lean()
			.exec(function(err, d){
				//d = d.reverse();
				async.map(d, exports.mapDoc, fn);
			})
		},
		latest_all_articles:function(fn){
			var q = {published:true, entry_type:'News Article'};
			if(req.params.since){
				q.article_number = {$lt:parseInt(req.params.since)}
			}
			Article
			.find(q,{revisions:0})
			.sort({article_number:-1})
			.limit(6)
			.lean()
			.exec(function(err, d){
				async.map(d, exports.mapDoc, fn);
			})
		},
		galleries:function(fn){
			Article
			.find({published:true, entry_type:'Gallery', category:cat},{revisions:0})
			.sort({article_number:-1})
			.limit(20)
			.lean()
			.exec(function(err, d){
				async.map(d, exports.mapDoc, fn);
			})
		},
		general_news:function(fn){
			fn()
		},
		ads:exports.getAds,
		category:function(fn){
			return fn(null,cat);
		},
		popular_week:function(fn){
			Article
			.find({published:true, time:{$gt:moment().subtract(7,'day').toDate()}},{revisions:0})
			.sort({views:-1})
			.limit(6)
			.lean()
			.exec(function(err, d){
				async.map(d, exports.mapDoc, function(err, docs){
					fn(null, docs);
				});
			})
		}
	},fn)
}

exports.generateSearchPage = function(req, res, fn){
	var q = req.query.q;
	if(!q || q == ""){
		return res.redirect('/');
	}
	var s = new RegExp(q, 'g');
	async.auto({
		articles:function(fn){
			var q = {published:true, entry_type:'News Article', $or:[{title:s}]};
			if(req.params.since){
				q.article_number = {$lt:parseInt(req.params.since)}
			}
			Article
			.find(q,{revisions:0})
			.sort({article_number:-1})
			.limit(20)
			.lean()
			.exec(function(err, d){
				d = d.reverse();
				async.map(d, exports.mapDoc, fn);
			})
		},
		latest_all_articles:function(fn){
			var q = {published:true, entry_type:'News Article'};
			if(req.params.since){
				q.article_number = {$lt:parseInt(req.params.since)}
			}
			Article
			.find(q,{revisions:0})
			.sort({article_number:-1})
			.limit(6)
			.lean()
			.exec(function(err, d){
				async.map(d, exports.mapDoc, fn);
			})
		},
		ads:exports.getAds,
		search:function(fn){
			return fn(null,q);
		}
	},fn)
}


exports.mapDoc = function mapDoc(){
	var doc=arguments[0]
	var fn = arguments[1];
	var skip_thread;
	if(arguments.length == 3){
		skip_thread = arguments[1];
		fn = arguments[2];
	}
	doc.time_pretty = moment(doc.time).fromNow();
	doc.time_formatted = moment(doc.time).format("MMMM Do YYYY");
	doc.time_pretty_dv = moment(doc.time).locale('dv').fromNow();
	async.auto({
		contents:function(fn){
			exports.mapContents(doc,fn);
		},
		thread: function(fn){
			if(skip_thread){
				return fn();
			}
			exports.thread(doc.article_number, fn)
		}
	}, function(err, p){
		if(err){
			return fn(err);
		}
		doc.contents = p.contents;
		doc.thread = p.thread;
		doc.image = _.find(doc.contents, function(d){
			return d.type == 'image';
		}) || null;
		doc.description = _.find(doc.contents, function(d){
			return d.type == 'paragraph-dv' && d.content != '';
		}) || null;
		if(doc.description){
			doc.description = doc.description.content;
			if(doc.description.length > 180){
				var s = doc.description.split(" ");
				var str = "";
				s.forEach(function(t){
					if(str.length > 180){
						return;
					}
					str += t + " ";
				})
				doc.description = str+"..."; 
			}
		}
		fn(null, doc);
	})
}
exports.mapContents = function mapContents(doc, fn){
	doc.contents = _.compact(doc.contents);
	async.map(doc.contents, function(c, done){
		c.time_pretty = moment(c.time).format("HH:mm");
		if(c.type == "image"){
			Media
			.findById(c.content)
			.lean()
			.exec(function(err, d){done(err, _.extend(c,d))});
		}else{
			done(null, c)
		}
	},function(err, contents){
		if(err){
			return fn(err);
		}
		doc.contents = contents;
		fn(null, contents);
	})
}

exports.saveImage = function saveImage(save_type, req, fn){
	var description_dv = req.body.description_dv;
	var description_en = req.body.description_en;
	var tags = req.body.tags == "" ? [] : req.body.tags.split(",");

	async.waterfall([
		function validate(fn){
			if(save_type == "upload" && !req.files){
				return fn("no file found")
			}
			if(save_type == "upload" && description_dv == "" && description_en == ""){
				return fn("no description found");
			}
			fn();
		},
		function downloadFile(fn){
			if(save_type == 'url'){
				var tmp = path.join(__dirname, '../temp/', req.temp_name);
				var size;
				req.files = {}
				var r = request({
					url: req.url,
					method:'GET',
					encoding: null
				});
				r.pipe(fs.createWriteStream(tmp));
				r.on('response', function(resp){
					size = resp.headers['content-length'];
				})
				r.on('end', function(){
					size = parseInt(size);
					req.files[req.temp_name] = {
						originalName: req.temp_name,
						extension:req.temp_name.split('.').pop(),
						size:size || 0,
						path:tmp
					}					
					fn();
				})	
			}else{
				fn();
			}
		},
		function collect(fn){
			collectFiles(req, fn);
		},
		function moveFiles(files, fn){
			if(!files.length){
				return fn("no file uploaded");
			}
			var file = files.pop();
			async.waterfall([
				function findExif(fn){
					ExifImage({image:file.path}, function(err, edata){
						if(err){
							return fn();
						}
						file.exif = edata;
						fn();
					})
				},
				function move(fn){
					fse.move(file.path, file.fs_location, function(err){
						fn(err);
					});
				}
			], function(err){
				fn(err, file);
			});
		},
		function addMedia(file, fn){
			new Media({
				type:'image',
				description_dv:description_dv,
				description_en:description_en,
				tags:tags,
				file:file,
				ip:req.ip,
				user:req.user.username,
				time:new Date()
			}).save(function(err, m){
				fn(err, m)
			})
		},
		function resize(m, fn){
			Media.resizeImage(m._id, 'standard', {simulate:false}, function(err){
				fn(err, m._id);
			})
		},
		function find(id, fn){
			Media
			.findById(id)
			.lean()
			.exec(function(err, m){
				fn(err, m);
			})
		}
	], fn);	
}
exports.getAds = function(fn){
	Ad
	.find({effective_to:{$gt:new Date()}})
	.lean()
	.exec(function(err, ads){
		var a = _.groupBy(ads, 'type');
		fn(null, a)
	});	
}
exports.thread = function(id, fn){
	if(!id){
		return fn(null, []);
	}
	var article;
	var parents = [];
	var children = [];
	async.waterfall([
		function findArticle(fn){
			Article
			.findOne({article_number:id},{revisions:0})
			.lean()
			.exec(function(err, a){
				article = a;
				fn();
			})
		},
		function walkParents(fn){
			var parent = article.parent;
			async.forever(
				function(next){
					Article
					.findOne({article_number:parent},{revisions:0})
					.lean()
					.exec(function(err, a){
						if(!a){
							return next('done');
						}
						exports.mapDoc(a, true, function(err, doc){
							parents.push(doc);
							parent = doc.parent;
							next();
						});
					})					
				},
				function(e){
					fn();
				}
			);
		},
		function walkChildren(fn){
			var child = id;
			async.forever(
				function(next){
					Article
					.findOne({parent:child},{revisions:0})
					.lean()
					.exec(function(err, a){
						if(!a){
							return next("done");
						}
						exports.mapDoc(a, true, function(err, doc){
							children.push(doc);
							child = doc.article_number;
							next();
						});						

					})					
				},
				function(err){
					fn();
				}
			);
		}
	], function(err){
		if(err){
			return fn(err);
		}
		fn(null, {parents:parents.reverse(), children:children})
	})
}

function collectFiles(req, fn){
	var files = [];
	for(var file in req.files){
		var f = req.files[file];
		var filename = "media-" + rndm(15) +'.' + f.extension;
		var directory = conf.images_location;
		var newFile = {
			_id: mongoose.Types.ObjectId(),
			name:filename,
			orginal_name:f.originalname,
			extension:f.extension,
			size:f.size,
			ip:req.ip,
			time:new Date(),
			user:req.user.username,
			directory:directory,
			path:f.path,
			fs_location: path.join(directory,filename),
			migrated:false
		}
		newFile.location = path.join('/statics/images', filename);
		files.push(newFile);
	}
	fn(null, files);
}

