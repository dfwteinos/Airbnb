const mongoose = require("mongoose");

var reviewSchema = mongoose.Schema({
	about: String,
	rating: Number,
	text: String,
	date: String,
	author: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User"
	}
});


module.exports = mongoose.model("Review", reviewSchema);