require("dotenv").config();

const express		 = require("express"),
	  app			 = express(),
	  bodyParser	 = require("body-parser"),
	  mongoose		 = require("mongoose"),
	  flash			 = require("connect-flash"),
	  passport		 = require("passport"),
	  localStradegy  = require("passport-local"),
	  methodOverride = require("method-override"),
	  fs			 = require("fs"),
	  https			 = require("https"),
	  rl	 	 	 = require('readline-sync'),
	  User			 = require("./models/user"),
	  Message		 = require("./models/message"),
	  Apartment		 = require("./models/apartment"),
	  Review		 = require("./models/review");

var userRoutes		  = require("./routes/users"),
	messageRoutes	  = require("./routes/messages"),
	apartmentRoutes   = require("./routes/apartments"),
	indexRoutes		  = require("./routes/index"),
	searchRoutes	  = require("./routes/search"),
	reservationRoutes = require("./routes/reservations"),
	reviewsRoutes	  = require("./routes/reviews");

var port = process.env.PORT || 3000,
	db_url = process.env.DATABASEURL || "mongodb://localhost/airbnb";

const startMongodb = function() {
		mongoose.connect(db_url, {
		useNewUrlParser: true,
		useUnifiedTopology: true,
		useFindAndModify: false,
		useCreateIndex: true
	})
	.then(() => {console.log("Connected to Airbnb db");})
	.catch(error => console.log(error.message));
}


app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static(__dirname + "/public"));		//__dirname is the directory name where the script runs
app.use(methodOverride("_method"));
app.use(flash());


// PASSPORT CONFIGURATION
app.use(require("express-session")({
	secret: "Renting App",
	resave: false,
	saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new localStradegy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(function(req, res, next){
	// req.user is object with info about the currently logged in user (if there is one)
	res.locals.currentUser = req.user;
	// If there's anything in the flash, we'll have access to it in any template under var message
	res.locals.error = req.flash("error");
	res.locals.success = req.flash("success");
	res.locals.warning = req.flash("warning");
	next();
});

app.use("/users", userRoutes);
app.use("/messages", messageRoutes);
app.use("/apartments", apartmentRoutes);
app.use("/", indexRoutes);
app.use("/search", searchRoutes);
app.use("/reservations", reservationRoutes);
app.use("/reviews",reviewsRoutes);

https.createServer({
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.cert')
}, app);

const startServer = function() {
	app.listen(port, function(){
		console.log("Airbnb server has started");
	});
};


var adminUsername, adminPassword, adminNext;

const getAdmin = function(){
	adminUsername = rl.question("Give an admin Username: ");
	adminPassword = rl.question("Give an admin Password: ", {
		hideEchoBack: true
	});

	var answer = rl.question("Do you want to add another admin user? (yes/no):");	
	if (answer !='no' && answer!='yes' ){
		adminNext = 'other';
	}
	else {
		adminNext = answer;
	}

	while(adminNext == 'other'){
		answer = rl.question("Do you want to add another admin user? (yes/no):");	
		if (answer !='no' && answer!='yes' ){
			adminNext = 'other';
		}
		else {
			adminNext = answer;
		}
	}

	if(adminNext == 'yes'){
		// Save last added admin user
		var user = new User({
			username: adminUsername,
			password: adminPassword,
			firstname: "",
			lastname: "",
			email: "",
			phone_number: "",
			app_role: [ "admin" ],
			messages: [],
			apartments: [],
			reviews: []
		});

		User.register(user, adminPassword, function(err, admin){
			if(err){
				req.flash("error", err.message);
				return res.redirect("/register");
			}
		});

		// Get the next admin user
		getAdmin();
	}else{
		// Save last added admin user
		var user = new User({
			username: adminUsername,
			password: adminPassword,
			firstname: "",
			lastname: "",
			email: "",
			phone_number: "",
			app_role: [ "admin" ],
			messages: [],
			apartments: [],
			reviews: []
		});

		User.register(user, adminPassword, function(err, admin){
			if(err){
				console.log(err.mess);
			}
		});
	}
};

const main = async function(){
	await startServer();
	await startMongodb();

	User.find({ "app_role": ["admin"] }, function(err,users){
		if(users.length == 0){
			getAdmin();
		}
	});
}

main();
