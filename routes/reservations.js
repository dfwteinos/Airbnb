const	express	 	= require("express"),
	  	router	 	= express.Router(),
	  	middleware	= require("../middleware"),
	  	User		= require("../models/user"),
	  	Apartment	= require("../models/apartment"),
	  	url			= require("url");


router.post("/:tenant_id/:apartment_id", middleware.isTenant,function(req,res){
	var check_in  = req.query.check_in,
		check_out = req.query.check_out,
		guests	  = req.query.guests;

	Apartment.findById(req.params.apartment_id, function(err,foundApartment){
		if(err){
			req.flash("error",err.message);
			return res.redirect("back");
		}

		var reservation = {
			tenant: req.params.tenant_id,
			from:	check_in,
			to:		check_out,
			guests:	guests
		};

		// Add new reservation
		foundApartment.reservations.push(reservation);

		// Update apartments availability dates
		var i = 0;
		for(var dates of foundApartment.availability){
			if(check_in.valueOf() >= dates.from.valueOf() && check_out.valueOf() <= dates.to.valueOf()){
				var temp, dd, mm, yyyy, date;
				var newDates = {};

				if(check_in.valueOf() > dates.from.valueOf()){
					temp = dates.to;

					// Get previous day from check in
					date = new Date(check_in);
					date.setDate(date.getDate()-1);

					// Convert it to a string
					dd = String(date.getDate()).padStart(2, '0');
					mm = String(date.getMonth() + 1).padStart(2, '0'); //January is 0!
					yyyy = date.getFullYear();
					dates.to = yyyy + '-' + mm + '-' + dd;

					if(check_out.valueOf() < temp.valueOf()){
						// Get next day from check out
						date = new Date(check_out);
						date.setDate(date.getDate()+1);

						// Convert it to a string
						dd = String(date.getDate()).padStart(2, '0');
						mm = String(date.getMonth() + 1).padStart(2, '0'); //January is 0!
						yyyy = date.getFullYear();

						newDates = {
							from: yyyy + '-' + mm + '-' + dd,
							to:   temp
						};

					}
				}else if(check_out.valueOf() < dates.to.valueOf()){
					// Get next day from check out
					date = new Date(check_out);
					date.setDate(date.getDate()+1);

					// Convert it to a string
					dd = String(date.getDate()).padStart(2, '0');
					mm = String(date.getMonth() + 1).padStart(2, '0'); //January is 0!
					yyyy = date.getFullYear();

					dates.from = yyyy + '-' + mm + '-' + dd;
				}else{
					var length = foundApartment.availability.length;

					foundApartment.availability = foundApartment.availability.slice(0,i)
													.concat(foundApartment.availability.slice(i+1,length));
				}

				if(Object.keys(newDates).length > 0){
					foundApartment.availability.push(newDates);
					foundApartment.availability.sort(function({ from: f1, to: t1 },{ from: f2, to: t2 }){
						return f1.valueOf() - f2.valueOf();
					});
				}

				break;
			}

			i += 1;
		};

		foundApartment.save();

		req.flash("success", "Your reservation was submitted successfully!");
		res.redirect(url.format({
			pathname: "/search/" + foundApartment._id,
			query: {
				"num_days":		req.query.num_days,
				"guests":		guests,
				"check_in":		check_in,
				"check_out":	check_out
			}
		}));
	});
});



module.exports = router;