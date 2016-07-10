var mongoose = require('mongoose');
var schema = {
	name:{type:"string", required: true},
	directory:{type:"string"},
	original_name:{type:"string"},
	extension:{type:"string"},
	size:{type:"number", required: true},
	//url:{type:"string", required:true},
	location:{type:"string", required:true},
	sizes:{},
	fs_location:{type:"string", required:true},
	season:{type:"number"},
	episode:{type:"number"},
	title:{type:"string"}, //episode title, etc
	release_date:{type:"date"}, //episode release date
	plot:{type:"string"}, //episode plot
	image:{type:"string"}, //episode screeshot
	user:{type:"string"},
	ip:{type:"string"},
	time:{type:"date", required: true},
	migrated:{type:"boolean"},
	migrated_id:{type:"number"},
	migrated_location:{type:"string"},
	migrated_location_parent:{type:"string"},
	downloads:{type:'number', default:0},
	flags:[{
		reason:{type:'string'},
		solved:{type:'boolean', default:false}
	}]
}
var File = mongoose.Schema(schema);

exports.File = File;
exports.schema = schema;