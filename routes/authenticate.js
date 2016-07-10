var argv = require('optimist').argv;

exports.authenticate = function authenticate(req,res,next){
	if(req.isAuthenticated()){
		return next();
	}
	if(req.xhr){
		return res.json({error:'please login first'});
	}
	res.redirect('/');
}

exports.authenticateAdmin = function authenticateAdmin(req,res,next){
	if(!req.isAuthenticated()){
		return res.redirect('/login?type=admin&redirect=' + req.originalUrl);
	}
	if(req.isAuthenticated()){
		if(req.user.username == "anonymous"){			
			return res.redirect('/login?type=admin&redirect=' + req.originalUrl);
		}else{
			return next();
		}
	}
}