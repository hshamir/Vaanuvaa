var mysql = require('mysql')
var async = require('async')
var conf = require('./config');
var mongoose = require('mongoose');
var media = require('./routes/media');
var cheerio = require('cheerio');
var request = require('request');
var fs = require('fs');
var _ = require('lodash');
var _s = require('underscore.string');
var host = '127.0.0.1';
var rndm = require('rndm')
if(conf.host){
	host = conf.host
}
mongoose.connect('mongodb://'+host+':27017/' + conf.db,{server:{poolSize:5}});

require('./lib/models/Article')
require('./lib/models/Media')

var Article = mongoose.models.Article;
var Media = mongoose.models.Media;

var saveImage = require('./lib/util').saveImage;

var q = [
"SELECT",
"wp_posts.*,",
"wp_users.user_login,",
"wp_users.display_name, p.GUID,",
"group_concat(distinct wp_terms.name separator ',') as categories,",
"group_concat(distinct p.guid separator ',') as att,",
"group_concat(distinct p.ID separator ',') as ids",
"FROM `wp_posts`",
"inner join wp_posts as p on wp_posts.ID = p.post_parent",
"inner join wp_users on wp_posts.post_author = wp_users.id",
"inner join wp_term_relationships on wp_term_relationships.object_id = wp_posts.ID",
"inner join wp_terms on wp_terms.term_id = wp_term_relationships.term_taxonomy_id ",
"where wp_posts.post_status = 'publish' and wp_posts.post_type='post'",
"group by wp_posts.ID",
"order by wp_posts.ID desc ",
"limit 100",
].join(' ');

//console.log(q);

var connection = mysql.createConnection({
	host            : 'dhivehi.com.mv',
	user            : 'dhivehic_m',
	password        : '529007',
	database: "dhivehic_db"
});
async.waterfall([
	function getPosts(fn){
		connection.query(q, function(err, rows){
			async.eachLimit(rows, 20, function(item, done){
				addPost(item, function(err, d){
					if(err){
						console.log("err, skipping ", item, err);
					}
					done();
				})
			}, fn);
		});
	}
], function(err){
	console.log(err);
	process.exit()
})


function addPost(e, fn){
	var _contents;
	var first_image_found = true;
	var category;
	async.waterfall([
		function skip(fn){
			Article.count({article_number:e.ID}, function(err, c){
				if(c == 1){
					fn("already exists");
				}else{
					fn();
				}
			})
		},
		function format(fn){
			var replace = ['ހައިލައިޓް','ކުއްލި ޚަބަރު', 'ޚިޔާލު', 'ފަހުގެ ޚަބަރު', 'މަޤުބޫލު'];
			var categories = e.categories.split(',');
			var replace = _.difference(categories,replace);
			category = replace.pop();
			var contents = e.post_content.split('\r\n');
			contents = _.compact(contents);
			contents = _.filter(contents, function(c){
				return c != '' && c != '&nbsp;'
			});
			var first = [];
			//find first img
			var i = e.att.split(',');
			i.forEach(function(a){
				if(!first.length && a != '' && 'jpg png gif'.indexOf(a) != -1){
					first_image_found = false;
					first.push({
						type:'image',
						content: {
							id:e.ID,
							caption:e.post_title,
							media:e.GUID,
							fname: rndm(15) + "." + e.GUID.split('.').pop()
						}					
					})
				}
			})
			contents = _.compact(contents);
			contents = first.concat(contents);
			contents = contents.map(function(c){
				if(c.type == 'image') return c;
				var cont = {
					type:'paragraph-dv',
					content:_s.stripTags(c)
				};
				var id;
				var caption;
				var media;
				if(c.indexOf('attachment_') != -1){
					c = c.replace(/\[/g,'<');
					c = c.replace(/\]/g,'>');
					$ = cheerio.load(c);
					caption = $('caption').text();
					id = $('caption').attr('id').replace('attachment_','');
					var index = e.ids.split(',').indexOf(id);
					var media = e.att.split(',')[index];
					if(!media){
						return;
					}
					cont.type = 'image';
					cont.content = {
						id:id,
						caption:caption,
						media:media,
						fname: rndm(15) + "." + media.split('.').pop()
					}
				}
				return cont;
			});
			_contents = _.compact(contents);
			_contents = contents;
			fn();
		},
		function firstImgNotFound(fn){
			if(first_image_found == false){
				return fn();
			}
			console.log('no image found, scraping page');
			request('http://dhivehi.com.mv/?p=' + e.ID, function(err, res, body){
				try{
					var $ = cheerio.load(body);
					var media = $(".post_layout_5_img").attr('src');
					var name = rndm(15) + "." + media.split('.').pop();
					var ret = {
						media:media,
						caption:$(".photo-credit").text() || "",
						fname:name,
						id:e.ID
					}
					if(media){
						_contents = _contents.reverse();
						_contents.push({
							type:'image',
							content:ret
						})
						_contents = _contents.reverse();
					}
					fn();
				}catch(e){
					fn(e);
				}
			})
		},
		function saveMedia(fn){
			_contents = _.compact(_contents);
			async.mapSeries(_contents, function(c, done){
				if(c.type != 'image'){
					return done(null, c);
				}
				var temp = './temp';
				var new_path = temp + "/" + c.content.fname;
				var data = {
					url:c.content.media,
					temp_name:c.content.fname,
					ip:"0.0.0.0",
					body:{
						description_dv: c.content.caption,
						description_en: "",
						tags:"",
						user:"migrate"
					},
					user:{
						username:"migrate"
					}
				}
				saveImage('url', data, function(err, m){
					if(err){
						return done(err);
					}
					done(null, {type:"image", content:m._id.toString()});
				})
			},function(err, c){
				if(err){
					return fn(err);
				}
				_contents = c;
				fn();
			});
		},
		function save(fn){
			var a = new Article({
				title:e.post_title,
				entry_type:'News Article',
				title_latin:e.post_title,
				type:'Article',
				contents:_contents,
				article_number: e.ID,
				category:category,
				published:true,
				post_comments:true,
				social_media_posted:true,
				ready_to_publish:true,
				migrated_id: e.ID,
				migrated:true,
				ip:"0.0.0.0",
				time: new Date(e.post_date),
				last_updated_time: new Date(e.post_modified),
				user:{
					username:e.user_login,
					name:e.display_name
				}
			});
			a.save(function(err, d){
				if(err){
					return fn(err);
				}
				console.log('saved http://dhivehi.com.mv/?p=' + e.ID);
				fn();
			})	
		}
	], fn)
}