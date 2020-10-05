var express    = require("express"),
	router     = express.Router(),
	multer	   = require("multer"),
	cloudinary = require("cloudinary"),
	passport   = require("passport"),
	util	   = require("util"),
	User 	   = require("../models/user");

// MULTER CONFIGURATION
// Whenever a file gets uploaded we create a custom name for that file
// The name we are giving is gonna have the current time stamp + the original name of the file
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
// We pass the configuration variables
var upload = multer({storage: storage, fileFilter: imageFilter});

// CLOUDINARY CONFIGURATION
cloudinary.config({
	cloud_name: "meryf",
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET
});


// Welcome Page
router.get("/", function(req, res){
	res.render("landing");
});


// Show the register form
router.get("/register", function(req, res){
	res.render("register");
});

// Handle sing up logic
router.post("/register", upload.single("image"), function(req, res){
	req.body.user.picture = [];

	// If user has uploaded a profile picture
	if(req.file){
		cloudinary.uploader.upload(req.file.path, function(result){
			// We want to store the image's secure_url (https://)
			req.body.user["picture"] = {
				url: result.secure_url,
				public_id: result.public_id
			}

			req.body.user.username = req.body.username;
			req.body.user["messages"] = [];
			req.body.user["apartments"] = [];
			req.body.user["reviews"] = [];

			if(req.body.password != req.body.confirm_password){
				req.flash("error", "Password confirmation failed. Please try again.");
				res.redirect("/register");
			}else{
				req.body.user.password = req.body.password;
				User.register(req.body.user, req.body.password, function(err, user){
					if(err){
						req.flash("error", err.message);
						return res.redirect("/register");
					}

					passport.authenticate("local")(req, res, function(){
						req.flash("success", "Welcome to Airbnb " + user.username);
						if(user.app_role.includes("host")){
							req.flash("warning",
									  "The approval of your registration in Airbnb as a host is pending");
							return res.redirect("/users/" + req.user._id + "/host");
						}
						return res.redirect("/");
					})
				});
			}
		});
	}else{
		var	tempUser = new User({});
		// Use default profile picture
		req.body.user.picture = tempUser.picture;

		req.body.user.username = req.body.username;
		req.body.user["messages"] = [];
		req.body.user["apartments"] = [];
		req.body.user["reviews"] = [];

		if(req.body.password != req.body.confirm_password){
			req.flash("error", "Password confirmation failed. Please try again.");
			res.redirect("/register");
		}else{
			req.body.user.password = req.body.password;

			var temp = new User();
			req.body.user.approved_by_admin = temp.approved_by_admin;

			User.register(req.body.user, req.body.password, function(err, user){
				if(err){
					req.flash("error", err.message);
					return res.redirect("/register");
				}
				passport.authenticate("local")(req, res, function(){
					req.flash("success", "Welcome to Airbnb " + user.username);
					if(user.app_role.includes("host")){
						req.flash("warning",
								  "The approval of your registration in Airbnb as a host is pending");
						return res.redirect("/users/" + req.user._id + "/host");
					}
					res.redirect("/");
				})
			});
		}
	}
});


// show login form
router.get("/login", function(req, res){
	res.render("login");
});

// handle login logic
router.post("/login", passport.authenticate("local",
	{
		failureRedirect: "/login",
		failureFlash: true
	}), function(req, res){
	
	req.flash("success", "Welcome back " + req.user.username);

	if(req.user.app_role[0] == "admin" && req.user.app_role.length == 1){
		res.redirect("/users/" + req.user._id + "/admin");
	}else if(req.user.app_role.includes("host")){
		if(req.user.approved_by_admin == "just approved"){
			User.findById(req.user._id, function(err, user){
				if(err){
					req.flash("error", err.message);
					return res.redirect("back");
				}

				user.approved_by_admin = "approved";
				user.save();

				req.flash("success", " your registration in Airbnb as a host was approved successfully!");
				res.redirect("/users/" + req.user._id + "/host");
			});
		}else{
			res.redirect("/users/" + req.user._id + "/host");
		}
	}else{
		res.redirect("/");
	}
});


// logout route
router.get("/logout", function(req, res){
	req.logout();
	req.flash("success", "Logged out successfully");
	res.redirect("/");
});

//profile edit route
router.get("/:id/edit", function(req, res){
	User.findById(req.params.user_id, function(err, foundUser){
		if(err){
			req.flash("error", err.message);
			res.redirect("back");
		}else{
			res.render("users/edit", {user_id: req.params.id});
		}
	});
});

// update Route
router.put("/:id", upload.single("image"), function(req,res){
	User.findById(req.params.id, async function(err, foundUser){
		if(err){
			req.flash("error", err.message);
			return res.redirect("/");
		}

		// If the user uploaded a new profile picture
		if(req.file){
			try{
				// If the user has uploaded a picture before, delete it before uploading the new one
				if(foundUser.picture.public_id != "Default"){
					await cloudinary.v2.uploader.destroy(foundUser.picture.public_id);
				}

				// New profile picture will be in 'result'
				var result = await cloudinary.v2.uploader.upload(req.file.path);
				// We want to store the image's secure_url (https://) and public id
				req.body.user["picture"] = {
					url: result.secure_url,
					public_id: result.public_id
				};
			}catch(err){
				req.flash("error", err.message);
				return res.redirect("back");
			}
		}

		if(req.body.deleteImage){
			try{
				// Remove picture from cloudinary
				await cloudinary.v2.uploader.destroy(foundUser.picture.public_id);

				// Add default profile picture to the user
				var tempUser = new User({});
				req.body.user["picture"] = Object.assign({},tempUser.picture);
			}catch(err){
				req.flash("error", err.message);
				return res.redirect("back");
			}
		}

		newUsername = false;
		// If the user entered a new username, he/she will have to login again
		if(foundUser.username != req.body.username){
			newUsername = true;
		}

		// If the user entered a new password, reset it
		if(foundUser.password != req.body.password || foundUser.password != req.body.confirm_password ){
			if(!req.body.confirm_password){
				req.flash("error", "Please confirm your password first.");
				return res.redirect("/" + req.user._id + "/edit");
			}
			if(req.body.password != req.body.confirm_password){
				req.flash("error", "Password and confirmation password should match. Please try again.");
				return res.redirect("/" + req.user._id + "/edit");
			}

			await foundUser.setPassword(req.body.password);
			await foundUser.save();
			const login = util.promisify(req.login.bind(req));
			await login(foundUser);
		}

		req.body.user.username = req.body.username;
		req.body.user.password = req.body.password;
		req.body.user.approved_by_admin = foundUser.approved_by_admin;

		User.findByIdAndUpdate(req.params.id, req.body.user, function(err, updatedUser){
			if(err){
				req.flash("error", err.message);
				return res.redirect("/");
			}

			if(newUsername){
				req.flash("success","Profile updated succesfully! Please login again.");
				return res.redirect("/login");
			}

			req.flash("success","Profile updated succesfully!");
			if(updatedUser.app_role.includes("host")){
				res.redirect("/users/" + updatedUser._id + "/host");
			}else{
				res.redirect("/");
			}
		});
	});
});

module.exports = router;