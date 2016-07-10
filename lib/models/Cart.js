var mongoose = require('mongoose');
var async = require('async');
var request = require('request');
var path = require('path');
var fs = require('fs');
var fse = require('fs-extra');
var conf = require('../../config');
var Cart = mongoose.Schema({
	session_uuid:{type:'string', required:true},
	status:{type:'string', default:'pending payment', enum:["verification", "pending", 'copying', 'files-copied', 'payment-received', 'disk-collected', 'closed', 'cancelled'], required:true},
	user:{type:'string', required:true},
	files:{type:'array', required:true},
	goodies:{type:'array'},
	total_bytes:{type:'number', required:true},
	number:{type:'number', required:true},
	total_bytes_copied:{type:'number'},
	date_added:{type:'date', default:Date.now},
	authorised_user:'string',
	ip:{type:'string', required:true},
	transaction_number:{type:'number', required:true},
	delivery_location:{},
	mount:{type:'string'},
	latlng:{},
	note:{type:'string'}
});

Cart.statics.getNextTransactionNumber = function(fn){
	this
	.findOne({},{transaction_number:1})
	.sort({transaction_number:-1})
	.lean()
	.exec(function(err, proc){
		if(err){
			return fn(err);
		}
		var batch = proc && proc.transaction_number ? proc.transaction_number+1 : 1;
		fn(null, batch);
	})

}

Cart.statics.calculateTotal = function(tin){
	
}

Cart.statics.copy = function(tin){
	model
	.findOne({transaction_number:tin})
	.lean()
	.exec(function(err, c){
		var bytes_copied = 0;
		var copydir = path.join(c.mount, 'DATAZONE');
		fse.mkdirpSync(copydir);
		async.eachSeries(c.files, function(file, done){
			var file_path = path.join(copydir, file.name);
			var url = file.url;
			if(!url){ url = conf.fs_location.local.uri + '/media/' + file.directory + '/' + file.name; }
			console.log(url);
			var r = request(url)
			.on('data', function(data){
				bytes_copied += data.length;
				model.update({transaction_number:tin},{$set:{total_bytes_copied:bytes_copied}}, function(err,b){});
			})
			.on('error', function(err){
				console.log(err);
			})
			.on('end', function(){
				done();
			})
			.pipe(fs.createWriteStream(file_path))
		}, function(err){
			model.update({transaction_number:tin},{$set:{status:'files copied'}}, function(err,b){

			});
		})
	})
}


var model = mongoose.model('Cart', Cart);