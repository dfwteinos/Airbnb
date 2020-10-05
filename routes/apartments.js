const express			= require("express"),
	  router			= express.Router(),
	  multer			= require("multer"),
	  middleware		= require("../middleware"),
	  cloudinary 		= require("cloudinary"),
	  User		 		= require("../models/user"),
	  apartment 		= require("../models/apartment"),
	  NodeGeocoder 		= require("node-geocoder"),
	  transliteration 	= require('transliteration'),
	  greekUtils 		= require('greek-utils'),
	  tr 				= require('transliteration').transliterate;

var options = {
  provider: 'opencage',
  httpAdapter: 'https',
  apiKey: "6b35a781fad343ddac3172ddaf206b45",
  formatter:null
};

var geocoder = NodeGeocoder(options);


// MULTER CONFIGURATION
var upload = multer({ "dest": "../uploads/"});


// CLOUDINARY CONFIGURATION
cloudinary.config({
	cloud_name: "meryf",
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET
});



// New Route for a host's apartment
router.get("/new", middleware.isLoggedIn, function(req,res){
	res.render("apartments/new");
});


// Create Route for a host's apartment
router.post("/", middleware.isLoggedIn, upload.array("images", 30), async(req,res) => {
	req.body.apartment["images"] = [];

	var	i=0;
	// For each uploaded image
	for(const file of req.files){
		var image = await cloudinary.v2.uploader.upload(file.path);
		// The firstly uploaded image should be the apartment's main image
		if(i == 0){
			req.body.apartment["main_image"] = {
				url: image.secure_url,
				public_id: image.public_id
			};
		}else{
			req.body.apartment.images.push({
				url: image.secure_url,
				public_id: image.public_id
			});
		}
	
		i += 1;
	}

	// Check if the renting dates are valid
	var today = new Date();
	var dd = String(today.getDate()).padStart(2, '0');
	var mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
	var yyyy = today.getFullYear();
	today = yyyy + '-' + mm + '-' + dd;

	var d1 = Date.parse(req.body.availability_from),
		d2 = Date.parse(req.body.availability_to),
		one_day = 1000*60*60*24,
		diff = Math.round((d2-d1)/one_day);

	if(req.body.availability_from.valueOf() < today.valueOf() ||
	   req.body.availability_to.valueOf() < today.valueOf() ||
	   req.body.availability_from.valueOf() > req.body.availability_to.valueOf() ||
	   diff < req.body.renting_rules.rent_days_min){
		req.flash("error", "Availability dates should be valid. Please try again.");
		return res.redirect("/apartments/new");
	}

	// Dates are valid
	var availability = {
		from: req.body.availability_from,
		to:	  req.body.availability_to
	};
	req.body.apartment["availability"] = [];
	req.body.apartment.availability.push(availability);

	// Get apartment objects from new.ejs
	req.body.apartment["place"] = Object.assign({}, req.body.place);
	req.body.apartment["renting_rules"] = Object.assign({}, req.body.renting_rules);
	req.body.apartment["facilities"] = Object.assign({}, req.body.facilities);
	req.body.apartment["location"] = Object.assign({}, req.body.location);
	req.body.apartment["host"] = Object.assign({}, req.user._doc);
	req.body.apartment["reservations"] = [];
	req.body.apartment["reviews"] = [];

	// Use default values if needed
	var	tempApartment = new apartment({});
	if(!req.body.apartment.place.living_room){
		req.body.apartment.place.living_room = tempApartment.place.living_room;
	}
	if(!req.body.apartment.renting_rules.smoking){
		req.body.apartment.renting_rules.smoking = tempApartment.renting_rules.smoking;
	}
	if(!req.body.apartment.renting_rules.pets){
		req.body.apartment.renting_rules.pets = tempApartment.renting_rules.pets;
	}
	if(!req.body.apartment.renting_rules.events){
		req.body.apartment.renting_rules.eventse = tempApartment.renting_rules.events;
	}
	if(!req.body.apartment.facilities.wifi){
		req.body.apartment.facilities.wifi = tempApartment.facilities.wifi;
	}
	if(!req.body.apartment.facilities.air_conditioning){
		req.body.apartment.facilities.air_conditioning = tempApartment.facilities.air_conditioning;
	}
	if(!req.body.apartment.facilities.heating){
		req.body.apartment.facilities.heating = tempApartment.facilities.heating;
	}
	if(!req.body.apartment.facilities.kitchen){
		req.body.apartment.facilities.kitchen = tempApartment.facilities.kitchen;
	}
	if(!req.body.apartment.facilities.tv){
		req.body.apartment.facilities.tv = tempApartment.facilities.tv;
	}
	if(!req.body.apartment.facilities.parking){
		req.body.apartment.facilities.parking = tempApartment.facilities.parking;
	}
	if(!req.body.apartment.facilities.elevator){
		req.body.apartment.facilities.elevator = tempApartment.facilities.elevator;
	}

	var reverse_geocoding = false;
	for([key, value] of Object.entries(req.body)){
		if(typeof value == 'string' && value == 'reverse_geocoding'){
			req.body.apartment.location.address = key;
			var greeklish = greekUtils.toGreeklish(req.body.apartment.location.address);
			reverse_geocoding = true;
			break;
		}
	}

	var latitude;
	var longitude;

	geocoder.geocode(req.body.apartment.location.address, function(err, data){
    	if(err){
			req.flash("error", err.message);
			return res.redirect('back');
		}else if(!data.length){
			req.flash('error', 'Invalid address');
    		return res.redirect('back');
     	}

    	req.body.apartment.location.lat 	= data[0].latitude;
    	req.body.apartment.location.lng  	= data[0].longitude;
		if(reverse_geocoding){
			req.body.apartment.location.address += "," + data[0].country;
		}

		req.body.apartment.location.address = tr(req.body.apartment.location.address);		//Making Normal 

		// Find current user in db
		User.findById(req.user._id, function(err, user){
			if(err){
				req.flash("error", err.message);
				res.redirect("/users/" + user._id + "/host");
			}else if(!user){
				req.flash("error", "User not found");
				res.redirect("back");
			}else{
				// Create apartment in db
				apartment.create(req.body.apartment, function(err, apartment){
					if(err){
						req.flash("error", err.message);
						res.redirect("/users/" + user._id + "/host");
					}else{
						apartment.save();
						user.apartments.push(apartment);
						user.save();
						req.flash("success", "Added " + apartment.name + " successfully!");
						res.redirect("/users/" + user._id + "/host");
					}
				});
			}
		});

	});

});

// SHOW Route - show more info about one specific appartement
router.get("/:id", middleware.checkApartmentOwnership, function(req,res){
	apartment.findById(req.params.id).populate("reviews").populate("host").populate("reservations.tenant")
	.exec(function(err, foundApartment){
		if(err){
			req.flash("error", err.message);
			res.redirect("back");
		}else{
			res.render("apartments/show", {apartment: foundApartment});
		}
	});
});


// Edit Route
router.get("/:id/edit", middleware.checkApartmentOwnership, function(req,res){
	apartment.findById(req.params.id).populate("host").exec(function(err, foundApartment){
		if(err){
			req.flash("error", err.message);
			res.redirect("back");
		}else{
			res.render("apartments/edit", {apartment: foundApartment});
		}
	});
});


// Update Route
router.put("/:id",  middleware.checkApartmentOwnership, upload.array("images", 10), function(req,res){
	apartment.findById(req.params.id).populate("host").populate("reservations").populate("reviews")
	.exec(async function(err, foundApartment){

		req.body.apartment["images"] = foundApartment.images.concat([]);

		// Remove selected images, if there is any
		if(req.body.deleteImages && req.body.deleteImages.length){
			// For each image selected to be removed
			for(const public_id of req.body.deleteImages){
				// Destroy access to the image on cloudinary
				await cloudinary.v2.uploader.destroy(public_id);
				// Remove it from apartment's images
				for(const image of req.body.apartment.images){
					if(image.public_id == public_id){
						var index = req.body.apartment.images.indexOf(image);
						var part1 = req.body.apartment.images.slice(0, index);
						var part2 = req.body.apartment.images.slice(index+1,
																	req.body.apartment.images.length);
						req.body.apartment.images = part1.concat(part2);
					}
				}
			}
		}

		// If one or more images were uploaded
		if(req.files){
			var	i=0;
			// For each uploaded image
			for(const file of req.files){
				var image = await cloudinary.v2.uploader.upload(file.path);
				// The firstly uploaded image should be the apartment's main image
				if(i == 0 && req.body.new_main_image){
					req.body.apartment["main_image"] = {
						url: image.secure_url,
						public_id: image.public_id
					};
				}else{
					req.body.apartment.images.push({
						url: image.secure_url,
						public_id: image.public_id
					});
				}

				i += 1;
			}
		}

		// If the room type is still the old one
		if(typeof req.body.room_type == 'undefined'){
			req.body.place.room_type = foundApartment.place.room_type;
		}

		var today = new Date();
		var dd = String(today.getDate()).padStart(2, '0');
		var mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
		var yyyy = today.getFullYear();
		today = yyyy + '-' + mm + '-' + dd;

		req.body.apartment["availability"] = [];
		var entries = Object.entries(req.body.availability);
		var	d1, d2, from, to;

		// For each from-to date pair
		for(var i=0; i<foundApartment.availability.length; i++){
			var dates = {
				from: foundApartment.availability[i].from,
				to: foundApartment.availability[i].to
			};

			[from,d1] = entries.find(([from,d1]) => from == "from_"+i);
			[to,d2] = entries.find(([to,d2]) => to == "to_"+i);

			// If any of the availability dates has changed
			if(dates.from.valueOf() != d1.valueOf() ||
			   dates.to.valueOf() != d2.valueOf()){
				// Check if the renting dates are valid
				if(d1.valueOf() < today.valueOf() || d2.valueOf() < today.valueOf() ||
				   d1.valueOf() > d2.valueOf()){
					req.flash("error", "Availability dates should be valid. Please try again.");
					return res.redirect("/apartments/" + foundApartment._id + "/edit");
				};

				if(dates.from.valueOf() != d1.valueOf()){
					dates.from = d1;
				};

				if(dates.to.valueOf() != d2.valueOf()){
					dates.to = d2;
				};
			};

			req.body.apartment.availability.push(dates);
		};

		// If new dates have been added
		if(req.body.more_dates_from && req.body.more_dates_to){
			d1 = req.body.more_dates_from;
			d2 = req.body.more_dates_to;

			// Check if the new dates are valid
			if(d1.valueOf() < today.valueOf() || d2.valueOf() < today.valueOf() ||
			   d1.valueOf() > d2.valueOf()){
				req.flash("error", "Availability dates should be valid. Please try again.");
				return res.redirect("/apartments/" + foundApartment._id + "/edit");
			};

			dates = {
				from: d1,
				to:   d2
			};

			req.body.apartment.availability.push(dates);
		};

		if(req.body.apartment.availability.length > 0){
			req.body.apartment.availability.sort(function({ from: f1, to: t1 },{ from: f2, to: t2 }){
			var d1 = Date.parse(f1),
				d2 = Date.parse(f2),
				one_day = 1000*60*60*24,
				diff = Math.round((d2-d1)/one_day);

				return diff < 0;
			});
		};

		// Get apartment object from new.ejs
		req.body.apartment["place"] = Object.assign({}, req.body.place);
		req.body.apartment["renting_rules"] = Object.assign({}, req.body.renting_rules);
		req.body.apartment["facilities"] = Object.assign({}, req.body.facilities);
		req.body.apartment["location"] = Object.assign({}, req.body.location);
		req.body.apartment["host"] = Object.assign({}, req.user._doc);
		req.body.apartment["reservations"] = foundApartment.reservations.concat([]);
		req.body.apartment["reviews"] = foundApartment.reviews.concat([]);

		// Use default values if needed
		var	tempApartment = new apartment({});
		if(!req.body.apartment.place.living_room){
			req.body.apartment.place.living_room = tempApartment.place.living_room;
		}
		if(!req.body.apartment.renting_rules.smoking){
			req.body.apartment.renting_rules.smoking = tempApartment.renting_rules.smoking;
		}
		if(!req.body.apartment.renting_rules.pets){
			req.body.apartment.renting_rules.pets = tempApartment.renting_rules.pets;
		}
		if(!req.body.apartment.renting_rules.events){
			req.body.apartment.renting_rules.eventse = tempApartment.renting_rules.events;
		}
		if(!req.body.apartment.facilities.wifi){
			req.body.apartment.facilities.wifi = tempApartment.facilities.wifi;
		}
		if(!req.body.apartment.facilities.air_conditioning){
			req.body.apartment.facilities.air_conditioning = tempApartment.facilities.air_conditioning;
		}
		if(!req.body.apartment.facilities.heating){
			req.body.apartment.facilities.heating = tempApartment.facilities.heating;
		}
		if(!req.body.apartment.facilities.kitchen){
			req.body.apartment.facilities.kitchen = tempApartment.facilities.kitchen;
		}
		if(!req.body.apartment.facilities.tv){
			req.body.apartment.facilities.tv = tempApartment.facilities.tv;
		}
		if(!req.body.apartment.facilities.parking){
			req.body.apartment.facilities.parking = tempApartment.facilities.parking;
		}
		if(!req.body.apartment.facilities.elevator){
			req.body.apartment.facilities.elevator = tempApartment.facilities.elevator;
		}

		for([key, value] of Object.entries(req.body)){
			if(typeof value == 'string' && value == 'reverse_geocoding'){
				req.body.apartment.location.address = key;
				break;
			}
		}
		
		geocoder.geocode(req.body.apartment.location.address, function(err, data){
    		if(err || !data.length){
				req.flash('error', 'Invalid address');
    			return res.redirect('back');
			} 

			req.body.apartment.location.lat 		=    	data[0].latitude;
			req.body.apartment.location.lng  		=     	data[0].longitude;

			req.body.apartment.location.address = tr(req.body.apartment.location.address);	//Making Normal Geocoding and Reverse in english format

			// Find current user in db
			User.findById(req.user._id, function(err, user){
				if(err){
					req.flash("error", err.message);
					res.redirect("/users/" + user._id + "/host");
				}else if(!user){
					req.flash("error", "User not found");
					res.redirect("back");
				}else{
					// Update apartment in db
					apartment.findByIdAndUpdate(foundApartment._id, req.body.apartment, function(err, apartment){
						if(err){
							req.flash("error", err.message);
							res.redirect("/users/" + user._id + "/host");
						}else{
							apartment.save();
							var i=0;
							for(var place in user.apartments){
								if(place._id == apartment._id){
									user.apartments[i] = Object.assign({}, apartment);
								}
								i += 1;
							}
							user.save();
							req.flash("success", "Updated " + apartment.name + " successfully!");
							res.redirect("/apartments/" + apartment._id);
							}
					});
				}
			});
		});
	});
});


// Delete Route
router.delete("/:id", middleware.checkApartmentOwnership, function(req,res){
	// Find current user in db
	User.findById(req.user._id, function(err, user){
		if(err){
			req.flash("error", err.message);
			return res.redirect("/users/" + user._id + "/host");
		}else if(!user){
			req.flash("error", "User not found");
			return res.redirect("back");
		}else{
			for(const apartment of user.apartments){
				if(apartment._id == req.params.id){
					var index = user.apartments.indexOf(apartment);
					var part1 = user.apartments.slice(0, index);
					var part2 = user.apartments.slice(index+1,user.apartments.length);
					user.apartments = part1.concat(part2);
				}
			}
			user.save();
		}
	});

	apartment.findByIdAndRemove(req.params.id, function(err){
		if(err){
			req.flash("error", err.message);
			res.redirect("/apartments/" + req.params.id);
		}else{
			req.flash("success", "Place deleted successfully!");
			res.redirect("/users/" + req.user._id + "/host");
		}
	});
});


module.exports = router;