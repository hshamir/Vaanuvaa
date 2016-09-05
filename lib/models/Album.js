var mongoose = require('mongoose');
var Album = mongoose.Schema({
	name:{type:"string"},
	description:{type:"string"},
	user:{type:"string"},
	ip:{type:"string"},
	time:{type:"date", required: true, default:Date.now},
});

mongoose.model('Album', Album);