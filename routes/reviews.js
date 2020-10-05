const 	express 	= require("express"),
		mongoose	= require("mongoose"),
		router  	= express.Router(),
		middleware	= require("../middleware"),
		User		= require("../models/user"),
		Apartment	= require("../models/apartment"),
		Review		= require("../models/review"),
		url			= require("url");


// ----------------------------------------- REVIEWS FOR HOST  ----------------------------------------- //

// NEW Route for reviews about a host
router.get("/host/new", middleware.isLoggedIn, function(req, res){
	var host = JSON.parse(req.query.host);

	res.render("reviews/host/new", { host: host, apartment: req.query.apartment,
									 num_days: req.query.num_days,
									 check_in: req.query.check_in, guests: req.query.guests,
									 check_out: req.query.check_out });
});

// Create Route for reviews about a host
router.post("/host/:tenant_id/:host_id", middleware.isTenant, function(req,res){
	User.findById(req.params.tenant_id).populate("reviews").exec(function(err,tenant){
		if(err){
			req.flash("error", err.message);
			return res.redirect("back");
		}

		var today = new Date();
		var dd = String(today.getDate()).padStart(2, '0');
		var mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
		var yyyy = today.getFullYear();
		today = dd + '-' + mm + '-' + yyyy;

		var review = {
			about: req.params.host_id.toString(),
			text: req.body.text,
			rating: req.body.rating,
			date: today,
			author: tenant._id
		};
	
		Review.create(review, function(err, newReview){
			if(err){
				req.flash("error", err.message);
				return res.redirect("back");
			}

			newReview.save();

			tenant.reviews.push(newReview);
			tenant.save();

			User.findById(req.params.host_id, function(err,host){
				if(err){
					req.flash("error", err.message);
					return res.redirect("back");
				}

				host.reviews.push(newReview);
				host.save();
			
				req.flash("success", "Your review was submitted successfully.");
				return res.redirect(url.format({
					pathname: "/reviews/host/" + host._id,
					query: {
						"apartment": req.query.apartment,
						"num_days": req.query.num_days,
						"check_in": req.query.check_in,
						"check_out": req.query.check_out,
						"guests": req.query.guests
					}
				}));
			});
		});
	});
});


// Edit Route for reviews about a host
router.get("/host/:id/edit", middleware.checkReviewOwnership, function(req, res){
	Review.findById(req.params.id).populate("author").exec(function(err,review){
		if(err){
			req.flash("error", err.message);
			return res.redirect("back");
		}

		var host = JSON.parse(req.query.host);
		res.render("reviews/host/edit", { review: review, host: host, apartment: req.query.apartment,
										  num_days: req.query.num_days,
										  check_in: req.query.check_in, guests: req.query.guests,
										  check_out: req.query.check_out });
	});
});

// Update Route for reviews about a host
router.put("/host/:id", middleware.checkReviewOwnership, function(req,res){
	Review.findById(req.params.id, function(err, review){
		if(err){
			req.flash("error", err.message);
			return res.redirect("back");
		}

		// Update rating
		review.rating = req.body.rating;

		// Update text
		review.text = req.body.text;

		// Update date
		var today = new Date();
		var dd = String(today.getDate()).padStart(2, '0');
		var mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
		var yyyy = today.getFullYear();
		review.date = dd + '-' + mm + '-' + yyyy;

		review.save();

		req.flash("success", "Review updated successfully.");
		return res.redirect(url.format({
			pathname: "/reviews/host/" + mongoose.Types.ObjectId(review.about),
				query: {
				"apartment": req.query.apartment,
				"num_days": req.query.num_days,
				"check_in": req.query.check_in,
				"check_out": req.query.check_out,
				"guests": req.query.guests
			}
		}));
	});
});

// SHOW Route - show more info about the reviews of one specific host
router.get("/host/:host_id", function(req,res){
	User.findById(req.params.host_id)
	.populate({ path:"reviews", populate: { path:"author" }})
	.exec(function(err, host){
		if(err){
			req.flash("error", err.message);
			res.redirect("back");
		}else{
			if(req.user && req.user._id.equals(req.params.host_id)){
				return res.render("reviews/host/show", { host: host });
			}else{
				var apartment = JSON.parse(req.query.apartment);

				return res.render("reviews/host/show", { host: host, apartment: apartment,
												  num_days: req.query.num_days,
												  check_in: req.query.check_in, guests: req.query.guests,
												  check_out: req.query.check_out });
			}
		}
	});
});


// Delete Route for reviews about a host
router.delete("/host/:id", middleware.checkReviewOwnership, function(req,res){
	// Remove review from host's reviews
	User.findById(req.query.host).populate("reviews").exec(function(err,host){
		if(err){
			req.flash("error", err.message);
			return res.redirect("back");
		}

		var i= 0;
		for(var review of host.reviews){
			if(review._id.equals(req.params.id)){
				var part1 = host.reviews.slice(0,i);
				var part2 = host.reviews.slice(i+1,host.reviews.length);

				host.reviews = part1.concat(part2);
			}
			i += 1;
		}
		host.save();

		// Remove review from tenant's reviews
		User.findById(req.user._id).populate("reviews").exec(function(err,tenant){
			if(err){
				req.flash("error", err.message);
				return res.redirect("back");
			}

			var i= 0;
			for(var review of tenant.reviews){
				if(review._id.equals(req.params.id)){
					var part1 = tenant.reviews.slice(0,i);
					var part2 = tenant.reviews.slice(i+1,tenant.reviews.length);

					tenant.reviews = part1.concat(part2);
				}
				i += 1;
			}
			tenant.save();

			Review.findByIdAndRemove(req.params.id, function(err){
				if(err){
					req.flash("error", err.message);
					return res.redirect("back");
				}

				req.flash("success", "Your review was deleted successfully.");
				return res.redirect(url.format({
					pathname: "/reviews/host/" + host._id,
					query: {
						"apartment": req.query.apartment,
						"num_days": req.query.num_days,
						"check_in": req.query.check_in,
						"check_out": req.query.check_out,
						"guests": req.query.guests
					}
				}));
			});
		});
	});
});


// ------------------------------------ REVIEWS FOR APARTMENT  ----------------------------------------- //

// NEW Route for reviews about an apartment
router.get("/apartment/new", middleware.isLoggedIn, function(req, res){
	var apartment = JSON.parse(req.query.apartment);

	res.render("reviews/apartment/new", { apartment: apartment,
										  num_days: req.query.num_days,
										  check_in: req.query.check_in, guests: req.query.guests,
										  check_out: req.query.check_out });
});

// Create Route for reviews about an apartment
router.post("/apartment/:tenant_id/:apartment_id", middleware.isTenant, function(req,res){
	User.findById(req.params.tenant_id).populate("reviews").exec(function(err,tenant){
		if(err){
			req.flash("error", err.message);
			return res.redirect("back");
		}

		var today = new Date();
		var dd = String(today.getDate()).padStart(2, '0');
		var mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
		var yyyy = today.getFullYear();
		today = dd + '-' + mm + '-' + yyyy;

		var review = {
			about: req.params.apartment_id.toString(),
			text: req.body.text,
			rating: req.body.rating,
			date: today,
			author: tenant._id
		};
	
		Review.create(review, function(err, newReview){
			if(err){
				req.flash("error", err.message);
				return res.redirect("back");
			}

			newReview.save();

			tenant.reviews.push(newReview);
			tenant.save();

			Apartment.findById(req.params.apartment_id, function(err,apartment){
				if(err){
					req.flash("error", err.message);
					return res.redirect("back");
				}

				apartment.reviews.push(newReview);
				apartment.save();
			
				req.flash("success", "Your review was submitted successfully.");
				return res.redirect(url.format({
					pathname: "/reviews/apartment/" + apartment._id,
					query: {
						"num_days": req.query.num_days,
						"check_in": req.query.check_in,
						"check_out": req.query.check_out,
						"guests": req.query.guests
					}
				}));
			});
		});
	});
});


// Edit Route for reviews about an apartment
router.get("/apartment/:id/edit", middleware.checkReviewOwnership, function(req, res){
	Review.findById(req.params.id).populate("author").exec(function(err,review){
		if(err){
			req.flash("error", err.message);
			return res.redirect("back");
		}

		var apartment = JSON.parse(req.query.apartment);
		res.render("reviews/apartment/edit", { review: review, apartment: apartment,
											   num_days: req.query.num_days,
											   check_in: req.query.check_in, guests: req.query.guests,
											   check_out: req.query.check_out });
	});
});

// Update Route for reviews about an apartment
router.put("/apartment/:id", middleware.checkReviewOwnership, function(req,res){
	var review = JSON.parse(req.query.review);

	// Update rating
	review.rating = req.body.rating;
	// Update text
	review.text = req.body.text;
	// Update date
	var today = new Date();
	var dd = String(today.getDate()).padStart(2, '0');
	var mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
	var yyyy = today.getFullYear();
	review.date = dd + '-' + mm + '-' + yyyy;

	Review.findByIdAndUpdate(req.params.id, review, function(err, review){
		if(err){
			req.flash("error", err.message);
			return res.redirect("back");
		}

		review.save();

		req.flash("success", "Review updated successfully.");
		return res.redirect(url.format({
			pathname: "/reviews/apartment/" + req.query.apartment,
			query: {
				"num_days": req.query.num_days,
				"check_in": req.query.check_in,
				"check_out": req.query.check_out,
				"guests": req.query.guests
			}
		}));
	});
});


// SHOW Route - show more info about the reviews of one specific apartment
router.get("/apartment/:apartment_id", function(req,res){
	Apartment.findById(req.params.apartment_id)
	.populate({ path:"reviews", populate: { path:"author" }}).exec(function(err, apartment){
		if(err){
			req.flash("error", err.message);
			res.redirect("back");
		}else{
			res.render("reviews/apartment/show", { apartment: apartment, num_days: req.query.num_days,
												   check_in: req.query.check_in, guests: req.query.guests,
												   check_out: req.query.check_out });
		}
	});
});


// Delete Route for reviews about an apartment
router.delete("/apartment/:id", middleware.checkReviewOwnership, function(req,res){
	// Remove review from apartment's reviews
	Apartment.findById(req.query.apartment).populate("reviews").exec(function(err,apartment){
		if(err){
			req.flash("error", err.message);
			return res.redirect("back");
		}

		var i= 0;
		for(var review of apartment.reviews){
			if(review._id.equals(req.params.id)){
				var part1 = apartment.reviews.slice(0,i);
				var part2 = apartment.reviews.slice(i+1,apartment.reviews.length);

				apartment.reviews = part1.concat(part2);
			}
			i += 1;
		}
		apartment.save();

		// Remove review from tenant's reviews
		User.findById(req.user._id).populate("reviews").exec(function(err,tenant){
			if(err){
				req.flash("error", err.message);
				return res.redirect("back");
			}

			var i= 0;
			for(var review of tenant.reviews){
				if(review._id.equals(req.params.id)){
					var part1 = tenant.reviews.slice(0,i);
					var part2 = tenant.reviews.slice(i+1,tenant.reviews.length);

					tenant.reviews = part1.concat(part2);
				}
				i += 1;
			}
			tenant.save();

			Review.findByIdAndRemove(req.params.id, function(err){
				if(err){
					req.flash("error", err.message);
					return res.redirect("back");
				}

				req.flash("success", "Your review was deleted successfully.");
				return res.redirect(url.format({
					pathname: "/reviews/apartment/" + req.query.apartment,
					query: {
						"num_days": req.query.num_days,
						"check_in": req.query.check_in,
						"check_out": req.query.check_out,
						"guests": req.query.guests
					}
				}));
			});
		});
	});
});


module.exports = router;