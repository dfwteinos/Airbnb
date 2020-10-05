const mongoose = require("mongoose");

var messageSchema = mongoose.Schema({
	subject: String,
	content: String,
	date: String,
	sender: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User"
	},
	recipient: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User"
	}
});


module.exports = mongoose.model("Message", messageSchema);