var mongoose = require('mongoose');
var Comment = new mongoose.Schema({
	comment:{type:'string', required:true},
	approved:{type:'boolean', default:false, required:true},
	approved_user:{},
	votes_up:{type:'number', required:true, default:0},
	votes_down:{type:'number', required:true, default:0},
	user:{},
	time: {type:'date', default:Date.now},
	ip:'string'
});
var Content = new mongoose.Schema({
	type:{type:'string', required:true},
	content:{type:'string', required:true},
	time:{type:'date', required:true, default:Date.now},
	user:{},
	ip:{type:"string", required:true},
},{strict:false});

var schema = {
	title:{type:'string', required:true},
	title_latin:{type:'string', required:true},
	parent:{type:'number'},
	description_latin:{type:'string'},
	article_number:{type:'number', required:true},
	entry_type:{type:'string', required:true, enum:['News Article', 'Gallery']},
	type:{type:'string', required:true, enum:['Article', 'Breaking News', 'Report']},
	category:{type:'string', required:true},
	contents:{type:'array', required:true, default:[]},
	top_article:{type:"boolean", default:false},
	live_event:{type:"boolean", default:false},
	hide_author:{type:"boolean", default:false},
	show_in_top_news:{type:"boolean", default:false},
	show_in_latest_news:{type:"boolean", default:false},
	post_comments:{type:"boolean", default:false},
	ready_to_publish:{type:'boolean', default:false},
	published:{type:'boolean', default:false},
	ip:{type:"string", required:true},
	user:{},
	time:{type:'date', required:true, default:Date.now},
	last_updated_time:{type:'date', required:true, default:Date.now},
	social_media_posted:{type:'boolean', default:false},
	views:{type:'number', default:0},
	migrated:{type:"boolean"},
	migrated_id:{type:"number"},
	comments:[Comment],
	revisions:{type:'array'}
}
var Article = new mongoose.Schema(schema);

Article.statics.getNextArticleNumber = function(fn){
	this
	.findOne({},{article_number:1})
	.sort({article_number:-1})
	.lean()
	.exec(function(err, proc){
		if(err){
			return fn(err);
		}
		var num = proc && proc.article_number ? proc.article_number+1 : 1;
		fn(null, num);
	})

}


exports.Article = Article;
exports.schema = schema;

mongoose.model('Article', Article)