var mongoose = require('mongoose');
var File = require('./File').File;
var FileSchema = require('./File').schema;
var request = require('request');
var cheerio = require('cheerio');
var gm = require('gm');
var conf = require('../../config');
var async = require('async');
var fse = require('fs-extra');
var path = require('path');
var rndm = require('rndm');

var Media = new mongoose.Schema({
	type:{type:"string", enum:["image"], required: true},
	views:{type:"number", default:0},

	//image, file
	file:FileSchema,
	
	//image
	exif:{},
	description_dv:{type:"string"},
	description_en:{type:"string"},
	
	tags:{type:"array"},
	source:{type:"string"},
	
	user:{type:"string", required:true},
	ip:{type:"string", required:true},
	time:{type:"date", required:true, default:Date.now},
	migrated_data:{},
},{strict:false});


Media.statics.retrieveEpisodeDetails = function retrieveEpisodeDetails(tt, season, episode, fn){
	if(arguments.length != 4){
		throw Error('No arguments');
	}
	request('/')
}

Media.statics.moveFiles = function resize(id, options, fn){
	var args = arguments;
	async.waterfall([
		function sudoAccess(fn){
			if(!process.env.SUDO_UID){
				return fn("need sudo access!");
			}
			fn();
		},
		function verifyArguments(fn){
			if(args.length != 3){
				fn("invalid arguments provided");
			}else{
				options = options || {};
				fn();
			}		
		},
		function mediaExists(fn){
			model
			.findOne({_id:id})
			.lean()
			.exec(function(err, media){
				if(err){
					return fn(err);
				}
				if(!media){
					return fn("no media found");
				}
				if(media.converted){
					return fn("files already moved");
				}
				return fn(null, media);
			});
		},
		function validateFiles(media, fn){
			var files = media.files;
			if(!files.length){
				return fn("nothing to move");
			}
			fn(null, media);
		},
		function moveFilesAndUpdateDB(media, fn){
			var files = media.files;
			var id = media._id;
			async.eachSeries(files, function(file, done){
				var fid = file._id;
				var filename = rndm(60) + '.' + file.extension;
				var directory = rndm(60);
				var fs_location = file.fs_location;
				var new_location =  path.join(directory, filename);
				var new_location_path = path.join(file.migrated_location_parent || location_parent, conf.fs_location[file.location_parent].directory, new_location);
				console.log("copying:", id, fid, fs_location, "=>", new_location_path);
				if(options.simulate){
					console.log("file moved (simulate):", id, fid, fs_location, "=>", new_location_path);
					return done();
				}
				fse.move(fs_location, new_location_path, function(err){
					if(err){
						return done(err);
					}
					//update db
					file.directory = directory;
					file.name = filename;
					file.location = path.join(conf.fs_location[file.location_parent].uri, new_location);
					file.fs_location = new_location_path;
					model.update({
						_id:id, 
						'files._id':fid
					},{$set:{'files.$':file, converted:true}}, function(err, changed){
						if(err){
							return done(err);
						}
						if(changed == 0){
							return done("nothing updated");
						}
						console.log("file moved:", id, fid, fs_location, "=>", new_location_path);
						done();
					})
				});
			},fn);
		}
	],fn)
}
Media.statics.resizeImage = function resize(id, template, options, fn){
	var args = arguments;
	var file;
	var template = template;
	var sizes = {};
	async.waterfall([
		function verifyArguments(fn){
			if(args.length != 4){
				fn("invalid arguments provided");
			}else{
				fn();
			}		
		},
		function templateExists(fn){
			if(typeof template == "string"){
				if(conf && conf.resize && conf.resize[template]){
					template =  conf.resize[template];
					fn();
				}else{
					fn("template does not exist");
				}
			}else{
				fn();
			}
		},
		function validateTemplate(fn){
			if(!template.length){
				return fn("no data in template");
			}
			var res = template.every(function correctFormatted(el){
				
				if(!el.label){
					return false;
				}
				if((el.width && el.height) || (el.width && !el.height) ||  (!el.width && el.height)){
					return true
				}
				return false;
			});
			if(!res){
				return fn("error in resize template");
			}
			return fn();
		},
		function mediaExists(fn){
			model.findOne({_id:id})
			.lean()
			.exec(function(err, m){
				if(err){
					return fn(err);
				}
				if(!m){
					return fn("no media found");
				}
				file = m.file;
				fn();
			});
		},
		function fileExists(fn){
			fse.exists(file.fs_location, function(exists){
				if(!exists){
					return fn("file doesn't exist to crop");
				}
				fn();
			});
		},
		function resize(fn){
			if(options.simulate){
				return fn();
			}
			file = file;
			var filename = file.name.split('.')[0];
			var extension = file.extension;
			var filepath = file.fs_location;
 			async.each(template, function(item, done){
				var label = item.label;
				var newfile_name = label.replace("%file",filename).replace('%extension',extension);
				var fdir = filepath.split("/");
				fdir.pop();
				fdir = fdir.join("/");
				var newfile_path = path.join(fdir, newfile_name);
				var g = gm(filepath)
				.resize(item.width || null, item.height || null, '^');
				if(item.width && item.height){
					g.gravity('Center')
					.crop(item.width, item.height);	
				}
				g.noProfile()
				.write(newfile_path, function (err) {
					var s = file.location.split('/');
					s.pop()
					s = s.join('/') + '/'+ newfile_name;
					sizes[item.desc] = s;
					done(err);
				});
			},function(err){
				if(err){
					console.log(file)
					console.log(err);
				}
				fn();
			});
		},
		function update(fn){
			var s = file.sizes || {};
			for(var i in sizes){
				s[i] = sizes[i];
			}
			model.update({_id:id},{$set:{'file.sizes':s}},function(e,c){
				fn();
			})
		}
	],fn);
}

function divideStr(val){
	if(!val) return '';
	if(typeof val == 'string')
		return val.split(',');
	else
		return val[0].split(',');
}

function verifyDuration(val){
	if(val == ""){
		return 0;
	}else{
		return parseInt(val);
	}
}

function verifyIMDB(val){

	if(!val || val=='') return '';
	var v = val.match(/tt\d.*\//g);
	if(v && v.length){
		v = v.pop().replace(/tt/gi,'').replace('/','');
		return v;
	}

	return val;
}
function IsNumeric(input)
{
    return (input - 0) == input && (''+input).replace(/^\s+|\s+$/g, "").length > 0;
}
var model = mongoose.model('Media',Media);