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
var Media = mongoose.models.Media;
var User = mongoose.models.User;
var Cart = mongoose.models.Cart;
var Log = mongoose.models.Log;
var Device = mongoose.models.Device;
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
var request = require('request');
_.str = require('underscore.string');
var setPrice = require('../lib/util').setPrice;
var md5 = require('md5');


router.use(function(req,res,next){
	res.header('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
	next();
})
router.get('/', authenticate, function(req, res, next){
	getCart(req, function(err, json){
		res.json(json);
	});
});
router.get('/pending', function(req, res, next){
	async.waterfall([
		function find(fn){
			Cart
			.find({status:'pending'})
			.sort({_id:1})
			.lean()
			.exec(fn)			
		},
		function mapFiles(transactions, fn){
			var _transactions = [];
			async.eachSeries(transactions, function(t, done){
				async.mapSeries(t.files, function(f, done){
					Media
					.findOne({"files._id":f._id},{'files.$':1})
					.lean()
					.exec(function(err, m){
						if(!m){
							return done();
						}
						var file = m.files.pop();
						f.datacenter = file.datacenter;
						done(null, f);
					})
				}, function(err, files){
					t.files = files;
					_transactions.push(t);
					done()
				});
			}, function(err){
				fn(null, _transactions);
			});
		}
	], function(err, mapped){
		res.json(mapped);
	})
});
router.get('/status/:status', function(req, res, next){
	async.waterfall([
		function find(fn){
			Cart
			.find({status:req.params.status})
			.sort({_id:1})
			.lean()
			.exec(fn)			
		},
		function mapFiles(transactions, fn){
			var _transactions = [];
			async.eachSeries(transactions, function(t, done){
				async.mapSeries(t.files, function(f, done){
					Media
					.findOne({"files._id":f._id},{'files.$':1})
					.lean()
					.exec(function(err, m){
						if(!m){
							return done();
						}
						var file = m.files.pop();
						f.datacenter = file.datacenter;
						done(null, f);
					})
				}, function(err, files){
					t.files = files;
					_transactions.push(t);
					done()
				});
			}, function(err){
				fn(null, _transactions);
			});
		}
	], function(err, mapped){
		res.json(mapped);
	})
});

router.post('/complete',authenticate, function(req, res){
	var latlng;
	var goodies;
	async.waterfall([
		function isVerified(fn){
			console.log(req.session)
			if(!req.session.verified){
				return fn("Invalid request");
			}
			fn();
		},
		function validate(fn){
			try{
				var data = JSON.parse(req.body.data);			
				latlng = data.latlng;
				goodies = data.goodies;
			}catch(e){
				return fn(e);
			}
			if(!latlng || latlng.lat == 0){
				return fn("invalid location")
			}
			fn();
		},
		function validateGoodies(fn){
			if(!goodies.length){
				return fn();
			}
			request('http://127.0.0.1:3067/goodies', function(err, resp, body){
				var all_goodies = JSON.parse(body);
				goodies = goodies.map(function(g){
					var id = _.keys(g).pop();
					var good = _.find(all_goodies, function(fgood){return fgood._id == id});
					delete good._id;
					delete good.__v;
					delete good.quantity;
					good.id = id;
					good.purchase_quantity = g[id];
					return good;
				});
				fn();
			});
		},
		function commit(fn){
			getCart(req, function(err, cart){
				Cart.getNextTransactionNumber(function(err, num){
					var trans = {
						session_uuid:req.session.uuid,
						user:req.user._id,
						number:req.session.number,
						ip:req.ip,
						status:'verification',
						total_bytes:cart.total_bytes,
						files:cart.files,
						transaction_number:num,
						latlng:latlng,
						note:req.body.note,
						goodies:goodies
					};
					var transaction = new Cart(trans);
					transaction.system_id = conf.system_id;
					transaction.save(function(err, d){
						if(err){
							return fn(err);
						}
						req.session.cart.transaction_number = num;
						fn();
					})
				});
			});			
		},
		function alertCustomer(fn){

			var number =req.session.number;
			var url = ''
			var post = {
				api_key:conf.nexmo.key,
				api_secret:conf.nexmo.secret,
				from:"Cinepix",
				to:"+960" + number,
				text: "We have received your order (ref: #"+req.session.cart.transaction_number+") and will let you know once it's ready for delivery."
			}
			request({
				url:"https://rest.nexmo.com/sms/json",
				method:"POST",
				form:post
			}, function(err,res,body){
				fn();
			});
		},
		function sendTelegramAsync(fn){
			var message = "New order from " + req.session.number + "."
			var url = "https://api.telegram.org/"+conf.telegram.bot+":"+conf.telegram.token+"/sendMessage?chat_id="+conf.telegram.chat_id+"&text=" + message;
			request(url, function(err, req, body){
				console.log(body);
			});
			fn();
		}
	], function(err){
		if(err){
			return res.json({error:err});
		}
		req.session.destroy();
		req.logout();
		res.json({success:1})
	})
});
router.post('/verify',authenticate, function(req, res){
	var verified = (req.body.code && req.body.code == req.session.code);
	req.session.verified = verified;
	res.json({verified:verified});
})
router.post('/register',authenticate, function(req, res){
	var url = 'https://www.google.com/recaptcha/api/siteverify';
	var response = req.body.response;
	var number = req.body.number;
	var verified = false;
	var code;
	var vf;
	if(req.session.verified == true){
		return res.json({verified:true});
	}
	async.waterfall([
		function validateCaptcha(fn){
			if(conf.skip_captcha){
				return fn();
			}
			if(!req.body.captcha){
				return fn("reCAPTCHA needed to authenticate");
			}
			request.post(url, {form:{secret:conf.recaptcha, response:req.body.captcha}}, function(err, resp, body){
				if(err){
					return fn("reCAPTCHA authentication failed");
				}
				try{
					var resp = JSON.parse(body);
					if(!resp.success){
						return fn("reCAPTCHA authentication failed");
					}
				}catch(e){
					return fn("Request to reCAPTCHA failed");
				}
				fn();
			});			
		},
		function validNumber(fn){
			if(number == "" || number.length > 7 || "7 9".indexOf(number[0]) == -1){
				return fn("Invalid number");
			}
			number = parseInt(number);
			fn();
		},
		function hasDoneTransactionBefore(fn){
			Cart.count({number:number}, function(err, c){
				verified = c > 0;
				req.session.verified = verified;
				req.session.number = number;
				console.log(333)
				fn();
			})
		},
		function sendCode(fn){
			if(verified){
				return fn();
			}
			code = ~~(Math.random()*10000);
			//vf doesn't do anything, just confuse the hacker
			vf = md5(code + conf.salt);
			req.session.code = code;
			var post = {
				api_key:conf.nexmo.key,
				api_secret:conf.nexmo.secret,
				from:"Cinepix",
				to:"+960" + number,
				text: code + " is your code."
			}
			request({
				url:"https://rest.nexmo.com/sms/json",
				method:"POST",
				form:post
			}, function(err,res,body){
				if(err){
					return fn("error sending sms");
				}
				fn();
			});

		}
	], function(err){
		if(err){
			return res.json({error:err});
		}
		var ret = {
			verified:verified
		};
		if(!verified){
			ret.vf = vf;
		}
		res.json(ret);
	})
});
router.post('/add', authenticate, function(req, res, next){
	req.session.cart = req.session.cart || {};
	if(req.body.file){
		var f = req.body.file.split(",")
		f.forEach(function(f){
			req.session.cart[f] = 1;
		})
	}
	console.log(req.session.cart)
	res.json({success:1});
});
router.post('/remove', authenticate, function(req, res, next){
	req.session.cart = req.session.cart || {};
	if(req.body.id){
		delete req.session.cart[req.body.id];
	}
	res.json({success:1});
});
router.get('/checkout', authenticate, function(req, res, next){
	getCart(req, function(err, json){
		json.items = json.medias;
		//get goodies
		request('http://127.0.0.1:3067/goodies', function(err, resp, body){
			try{
				json.goodies = JSON.parse(body);
			}catch(e){
				json.goodies = [];
			}
			res.render('cart-checkout', json);
		});
	});	
});
router.get('/authorize', authenticate, function(req, res, next){
	res.render('cart-authorize', {transaction_number:req.session.cart.transaction_number});
});
router.get('/move', authenticate, function(req, res, next){
	res.render('cart-move', {transaction_number:req.session.cart.transaction_number});
});
router.get('/cancel', authenticate, function(req, res, next){
	var uuid = req.session.uuid;
	if(!uuid){
		return res.redirect('/');
	}
	//console.log('here');process.exit();
	Cart.update({session_uuid:uuid, status:'pending payment'}, {$set:{status:'cancelled'}},function(err, c){
		delete req.session.cart;
		res.redirect('/');
	})
});
router.post('/:id/approve', authenticateAdmin, function(req, res, next){
	var id = req.params.id;
	Cart.findOne({_id:id}, function(err, c){
		if(err){
			return next(err);
		}
		if(c.status == "pending payment"){
			Cart.update({_id:id},{$set:{status:'payment received'}}, function(err, c){
				if(err){
					return next(err);
				}
				if(c == 1){
					res.json({success:1})
				}else{
					res.json({success:0});
				}
			})
		}else{
			res.json({error:'transaction is not in pending payment status'});
		}
	});
});
router.get('/status', authenticate, function(req, res, next){
	var uuid = req.session.uuid;
	if(!uuid){
		return res.redirect('/');
	}
	Cart.findOne({session_uuid:uuid},function(err, c){
		res.json(c);
	})
});
router.get('/pending-payment', authenticateAdmin, function(req, res,next){
	Cart
	.find({status:'pending payment'})
	.lean()
	.exec(function(err, carts){
		carts = carts.map(function(c){
			var total_bytes = 0;
			var total_price = 0;
			c.files.forEach(function(f){
				if(!f){
					return;
				}
				total_bytes += f.size;
				total_price += f.price;
			});
			c.total_bytes = total_bytes;
			c.total_price = total_price;
			return c;
		});
		res.json(carts)
	})
});
router.get('/copy', authenticate, function(req, res, next){
	res.render('cart-copy', {transaction_number:req.session.cart.transaction_number});
})
router.post('/copy', authenticate, function(req, res, next){
	var t = parseInt(req.body.transaction_number);
	var mount = req.body.mount;
	var cart;
	async.waterfall([
		function validate(fn){
			Cart.findOne({transaction_number:t}, function(err, c){
				if(err){
					return next(err);
				}
				if(!c){
					return next('transaction not found');
				}
				if(c.status != "payment received"){
					return next('invalid status');
				}
				fn();
			});
		},
		function update(fn){
			var u = {
				mount:mount,
				status:'copying'
			}			
			Cart.update({transaction_number:t},{$set:u}, function(err, c){
				if(err){
					return fn(err);
				}
				fn();
			})
		}
	], function(err){
		if(err){
			return next(err);
		}
		Cart.copy(t);
		res.redirect('/cart/copy')
	})
})
router.get('/transaction/:tid', function(req, res, next){
	async.waterfall([
		function find(fn){
			Cart
			.findOne({transaction_number:req.params.tid},{status:1, files:1, transaction_number:1, date_added:1})
			.sort({_id:1})
			.lean()
			.exec(fn)			
		},
		function mapFiles(transaction, fn){
			async.mapSeries(transaction.files, function(f, done){
				Media
				.findOne({"files._id":f._id},{'files.$':1})
				.lean()
				.exec(function(err, m){
					var file = m.files.pop();
					f.datacenter = file.datacenter;
					done(null, f);
				})
			}, function(err, files){
				transaction.files = files;
				fn(null, transaction);
			});
		}
	], function(err, mapped){
		res.json(mapped);
	})
});
router.post('/transaction/:tid/status', function(req, res, next){
	var current_status;
	var new_status = req.body.status;
	var tid = req.params.tid;
	async.waterfall([
		function find(fn){
			Cart
			.findOne({transaction_number:tid})
			.lean()
			.exec(fn)			
		},
		function validate(transaction, fn){
			current_status = transaction.status;
			if(!new_status || !current_status){
				return fn("invalid transaction");
			}
			fn();
		},
		function update(fn){
			Cart.update({transaction_number:tid},{$set:{status:new_status}}, function(err, c){
				fn(err, c);
			});
		},
		function announce(t, fn){
			var tid = req.params.tid;
			if(t > 0) {
				var message = "Transaction #" + tid + ' updated from "'+current_status+'" to "'+new_status+'"';
				message = encodeURIComponent(message);
				var url = "https://api.telegram.org/"+conf.telegram.bot+":"+conf.telegram.token+"/sendMessage?chat_id="+conf.telegram.chat_id+"&text=" + message;
				request(url, function(err, req, body){
					console.log(body);
				});				
			}else{
				return fn("not set")
			}
			fn();
		}
	], function(err, mapped){
		if(err){
			return next(err);
		}
		res.json({success:true, message:"ok"});
	})
});
module.exports = router;

function getCart(req, fn){
	if(!req.session.cart){
		return fn(null, {});
	}
	var files = _.keys(req.session.cart);
	async.mapSeries(files, function(item, done){
		Media.findOne({'files._id':item}, {'files.$':1, year:1, type:1, quality:1, title:1})
		.lean()
		.exec(done);
	}, function(err, medias){
		if(err){
			console.log(err)
			return fn(err);
		};
		var total_bytes = 0;
		var total_price = 0;
		var _medias = {};
		var files = [];
		medias.forEach(function(m){
			if(!m){
				return;
			}
			//apply price
			m = setPrice(m);
			var f = m.files[0];
			files.push(f);
			total_bytes += f.size;
			total_price += f.price;
			if(!_medias[m._id]){
				_medias[m._id] = m;
			}else{
				_medias[m._id].files.push(f)
			}
		});
		var a = [];
		for(var i in _medias){
			a.push(_medias[i]);

		}
		var json = {
			files:files,
			medias:a,
			total_bytes:total_bytes,
			total_price:total_price
		}
		fn(null, json);
	});
}

function encrypt(text){
  var cipher = crypto.createCipher('aes-256-ctr',conf.verify_salt)
  var crypted = cipher.update(text,'utf8','hex')
  crypted += cipher.final('hex');
  return crypted;
}
 
function decrypt(text){
  var decipher = crypto.createDecipher('aes-256-ctr',conf.verify_salt)
  var dec = decipher.update(text,'hex','utf8')
  dec += decipher.final('utf8');
  return dec;
}