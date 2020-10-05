const express	 = require("express"),
	  router 	 = express.Router(),
	  multer	 = require("multer"),
	  cloudinary = require("cloudinary"),
	  User   	 = require("../models/user"),
	  Apartment  = require("../models/apartment"),
	  middleware = require("../middleware"),
	  fs		 = require("fs"),
	  builder	 = require("xmlbuilder"),
	  mongoose	 = require("mongoose");

// MULTER CONFIGURATION
var storage = multer.diskStorage({
	filename: function(req, file, callback){
		callback(null, Date.now() + file.originalname);
	}
});
var imageFilter = function(req, file, cb){
	// Accept image files only
	if(!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)){
		return cb(new Error("Only image files are allowed!"), false);
	}
	cb(null,true);
};
var upload = multer({storage: storage, fileFilter: imageFilter});


// CLOUDINARY CONFIGURATION
cloudinary.config({
	cloud_name: "meryf",
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET
});


// Show route for host
router.get("/:id/host", middleware.isHost, function(req,res){
	User.findById(req.params.id,).populate("apartments")
	.populate({ path: "reviews", populate: { path: "author" } })
	.exec(function(err, foundUser){
		if(err){
			req.flash("error", err.message);
			res.redirect("back");
		}else if(!foundUser){
			req.flash("error", "User not found");
		res.redirect("back");
		}else{
			res.render("users/host", { host: foundUser, apartments: foundUser.apartments });
		}
	 });
});


// Show Route for admin
router.get("/:id/admin", middleware.isAdmin, function(req,res){
	User.findById(req.params.id, function(err, foundUser){
		if(err){
			req.flash("error", err.message);
			res.redirect("back");
		}else if(!foundUser){
			req.flash("error", "User not found");
			res.redirect("back");
		}else{
			Apartment.find({}).populate("reservations").populate("reviews")
			.populate({ path: "host", populate: { path: "reviews" } }).exec(function(err, apartments){
				if(err){
					req.flash("error", err.message);
					return res.redirect("back");
				}

				res.render("users/admin/show", { apartments: apartments });
			});
		}
	});
});

// View users' info for admin
router.get("/:id/admin/users_list", middleware.isAdmin, function(req,res){
	User.find({}).where({ "app_role": { $ne: ["admin"] } }).exec(function(err, users){
		if(err){
			req.flash("error", err.message);
			return res.redirect("back");
		}

		res.render("users/admin/users_list", { users: users });
	});
});


// Admin will approve of a host's registration
router.post("/:id/admin/approve_host/:host_id", middleware.isAdmin, function(req,res){
	User.findById(req.params.host_id, function(err, host){
		if(err){
			req.flash("err", err.message);
			return res.redirect("back");
		}

		host.approved_by_admin = "just approved";
		host.save();

		req.flash("success", host.username + "'s registration as a host was approved.");
		res.redirect("/users/" + req.params.id + "/admin/users_list");
	});
});


// Extract dataset to JSON file
router.get("/:id/admin/extract_to_json", middleware.isAdmin, function(req,res){
	Apartment.find({}).populate("reservations.tenant")
	.populate({ path: "reviews", populate: { path: "author" } })
	.populate({ path: "host", populate: { path: "reviews", populate: { path: "author" } } })
	.exec(function(err,data){
		var str_data = JSON.stringify(data, null, 2);
		fs.writeFile("airbnb.json", str_data, function(err){
			if(err){
				req.flash("error", err.message);
				res.redirect("back");
			}else{
				req.flash("success", "Extracted dataset to airbnb.json file.");
				res.redirect("/users/" + req.params.id + "/admin");
			}
		});
	});
});


// Extract dataset to XML file
router.get("/:id/admin/extract_to_xml", middleware.isAdmin, function(req,res){
	var xml = builder.create("apartments", { encoding: 'utf-8' });

	Apartment.find({}).populate("reservations.tenant")
	.populate({ path: "reviews", populate: { path: "author" } })
	.populate({ path: "host", populate: { path: "reviews", populate: { path: "author" } } })
	.exec(function(err,data){
		data.forEach(function(apartment){
			var images = builder.create("images");
			apartment.images.forEach(function(image){
				var img_xml = builder.create("image").ele("url", image["url"]).up();
				images.importDocument(img_xml);
			});

			var availability = builder.create("availability");
			apartment.availability.forEach(function(dates){
				var dates_xml = builder.create("dates")
											.ele("from", dates["from"]).up()
											.ele("to", dates["to"]).up();
				availability.importDocument(dates_xml);
			});

			var hostReviews = builder.create("reviews");
			apartment.host.reviews.forEach(function(review){
				if(mongoose.Types.ObjectId(review.about).equals(apartment.host._id)){				
					var review_xml = builder.create("review")
												.ele("rating", review["rating"]).up()
												.ele("text", review["text"]).up()
												.ele("date", review["date"]).up()
												.ele("author", review.author["username"]).up();
					hostReviews.importDocument(review_xml);
				}
			});

			var reservations = builder.create("reservations");
			apartment.reservations.forEach(function(reservation){
				var reservation_xml = builder.create("reservation")
												.ele("tenant", reservation.tenant["username"]).up()
												.ele("from", reservation["from"]).up()
												.ele("to", reservation["to"]).up()
												.ele("guests", reservation["guests"]).up();
				reservations.importDocument(reservation_xml);
			});

			var reviews = builder.create("reviews");
			apartment.reviews.forEach(function(review){
				var review_xml = builder.create("review")
											.ele("rating", review["rating"]).up()
											.ele("text", review["text"]).up()
											.ele("date", review["date"]).up()
											.ele("author", review.author["username"]).up();
				reviews.importDocument(review_xml);
			});

			xml.ele("apartment")
					.ele("name", apartment["name"]).up()
					.ele("place")
						.ele("beds", apartment.place["beds"]).up()
						.ele("bedrooms", apartment.place["bedrooms"]).up()
						.ele("bathrooms", apartment.place["bathrooms"]).up()
						.ele("room_type", apartment.place["room_type"]).up()
						.ele("living_room", ((apartment.place["living_room"])=="False")?("No"):("Yes")).up()
						.ele("floor", apartment.place["floor"]).up()
						.ele("area", apartment.place["area"]).up().up()
					.ele("description", apartment["description"]).up()
					.ele("renting_rules")
						.ele("smoking", ((apartment.renting_rules["smoking"])=="False")?("No"):("Yes")).up()
						.ele("pets", ((apartment.renting_rules["pets"])=="False")?("No"):("Yes")).up()
						.ele("events", ((apartment.renting_rules["events"])=="False")?("No"):("Yes")).up()
						.ele("rent_days_min", apartment.renting_rules["rent_days_min"]).up().up()
					.ele("facilities")
						.ele("wifi", ((apartment.facilities["wifi"])=="False")?("No"):("Yes")).up()
						.ele("air-conditioning", ((apartment.facilities["air-condition"])=="False")?("No"):("Yes")).up()
						.ele("heating", ((apartment.facilities["heating"])=="False")?("No"):("Yes")).up()
						.ele("kitchen", ((apartment.facilities["kitchen"])=="False")?("No"):("Yes")).up()
						.ele("tv", ((apartment.facilities["tv"])=="False")?("No"):("Yes")).up()
						.ele("parking", ((apartment.facilities["parking"])=="False")?("No"):("Yes")).up()
						.ele("elevator", ((apartment.facilities["elevator"])=="False")?("No"):("Yes")).up().up()
					.ele("location")
						.ele("address", apartment.location["address"]).up()
						.ele("lat", apartment.location["lat"]).up()
						.ele("lng", apartment.location["lng"]).up()
						.ele("neighbourhood", apartment.location["neighbourhood"]).up()
						.ele("transportation", apartment.location["transportation"]).up().up()
					.ele("main_image", apartment.main_image["url"]).up()
					.importDocument(images)
					.ele("price_min", apartment["price_min"]).up()
					.ele("extra_charge_per_guest", apartment["extra_charge_per_guest"]).up()
					.importDocument(availability)
					.ele("capacity", apartment["capacity"]).up()
					.ele("host")
						.ele("username", apartment.host["username"]).up()
						.ele("firstname", apartment.host["firstname"]).up()
						.ele("lastname", apartment.host["lastname"]).up()
						.ele("email", apartment.host["email"]).up()
						.ele("phone_number", apartment.host["phone_number"]).up()
						.ele("picture", apartment.host.picture["url"]).up()
						.importDocument(hostReviews).up()
					.importDocument(reservations)
					.importDocument(reviews)
					.end();
		});

		var xmldoc = xml.toString({ pretty: true });
		fs.writeFile("airbnb.xml", xmldoc, function(err){
			if(err){
				req.flash("error", err.message);
				res.redirect("back");
			}else{
				req.flash("success","Extracted dataset to airbnb.xml file.");
				res.redirect("/users/" + req.params.id + "/admin");
			}
		});
	});
});


module.exports = router;