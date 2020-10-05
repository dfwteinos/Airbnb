var Apartment	= require("../models/apartment"),
	User		= require("../models/user"),
	Review		= require("../models/review"),
	Message		= require("../models/message");

var middlewareObj = {};

middlewareObj.isLoggedIn = function(req, res, next){
	if(req.isAuthenticated()){
		return next();
	}
	req.flash("error", "Please login first.");
	res.redirect("/login");
};

middlewareObj.checkApartmentOwnership = function(req, res, next){
	// Check if user is logged in
	if(req.isAuthenticated()){
		Apartment.findById(req.params.id, function(err, foundApartment){
			// If there is an error
			if(err){
				req.flash("error", err.message);
				res.redirect("back");
			// If there is no such apartment in the db
			}else if(!foundApartment){
				req.flash("error", "Place not found");
				res.redirect("back");
			}else{
				// Check if the user owns the apartment
				if(foundApartment.host._id.equals(req.user._id)){
					next();
				}else{
					req.flash("error", "You don't have host permissions.");
					res.redirect("back");
				}
			}
		});	
	}else{
		req.flash("error", "Please login first.");
		res.redirect("/login");
	}	
};

middlewareObj.isHost = function(req,res,next){
	// Check if user is logged in
	if(req.isAuthenticated()){
		User.findById(req.params.id, function(err,user){
			// If there is an error
			if(err){
				req.flash("error", err.message);
				res.redirect("back");
			// If there is no such user in the db
			}else if(!user){
				req.flash("error", "User not found");
				res.redirect("back");
			}else{
				// Check if the user is a host
				if(user.app_role.includes("host")){
					next();
				}else{
					req.flash("error", "You don't have host permissions.");
					res.redirect("back");
				}
			}
		});
	}else{
		req.flash("error", "Please login first.");
		res.redirect("/login");
	}
};

middlewareObj.isTenant = function(req,res,next){
	// Check if user is logged in
	if(req.isAuthenticated()){
		User.findById(req.params.tenant_id, function(err,user){
			// If there is an error
			if(err){
				req.flash("error", err.message);
				res.redirect("back");
			// If there is no such user in the db
			}else if(!user){
				req.flash("error", "User not found");
				res.redirect("back");
			}else{
				// Check if the user is a tenant
				if(user.app_role.includes("tenant")){
					next();
				}else{
					req.flash("error", "You don't have tenant permissions.");
					res.redirect("back");
				}
			}
		});
	}else{
		req.flash("error", "Please login first.");
		res.redirect("/login");
	}
};

middlewareObj.isAdmin = function(req,res,next){
	// Check if user is logged in
	if(req.isAuthenticated()){
		User.findById(req.params.id, function(err,user){
			// If there is an error
			if(err){
				req.flash("error", err.message);
				res.redirect("back");
			// If there is no such user in the db
			}else if(!user){
				req.flash("error", "User not found");
				res.redirect("back");
			}else{
				// Check if the user is admin
				if(user.app_role[0] == "admin" && user.app_role.length == 1){
					next();
				}else{
					req.flash("error", "You don't have admin permissions.");
					res.redirect("back");
				}
			}
		});
	}else{
		req.flash("error", "Please login first.");
		res.redirect("/login");
	}
};

middlewareObj.checkReviewOwnership = function(req, res, next){
	// Check if user is logged in
	if(req.isAuthenticated()){
		Review.findById(req.params.id, function(err, foundReview){
			// If there is an error
			if(err){
				req.flash("error", err.message);
				res.redirect("back");
			// If there is no such review in the db
			}else if(!foundReview){
				req.flash("error", "Review not found");
				res.redirect("back");
			}else{
				// Check if the user "owns" the review
				if(foundReview.author._id.equals(req.user._id)){
					next();
				}else{
					req.flash("error", "You don't have host permissions.");
					res.redirect("back");
				}
			}
		});	
	}else{
		req.flash("error", "Please login first.");
		res.redirect("/login");
	}	
};


middlewareObj.checkMessageOwnership = function(req, res, next){
	// Check if user is logged in
	if(req.isAuthenticated()){
		Message.findById(req.params.message, function(err, foundMessage){
			// If there is an error
			if(err){
				req.flash("error", err.message);
				res.redirect("back");
			// If there is no such message in the db
			}else if(!foundMessage){
				req.flash("error", "Message not found");
				res.redirect("back");
			}else{
				// Check if the user has sent or recieved the message
				if(foundMessage.sender._id.equals(req.user._id) ||
				   foundMessage.recipient._id.equals(req.user._id)){
					next();
				}else{
					req.flash("error", "You don't have permission to delete this message.");
					res.redirect("back");
				}
			}
		});	
	}else{
		req.flash("error", "Please login first.");
		res.redirect("/login");
	}	
};


module.exports = middlewareObj;