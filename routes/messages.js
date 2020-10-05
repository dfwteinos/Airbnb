const express	 = require("express"),
	  router	 = express.Router(),
	  User	  	 = require("../models/user"),
	  Apartment	 = require("../models/apartment"),
	  Message 	 = require("../models/message"),
	  middleware = require("../middleware"),
	  url		 = require("url");

// Pagination for tenant
router.get("/tenant/page/:pageNum", function(req,res){

	var apartment = JSON.parse(req.query.str_apartment);
	var conversation = JSON.parse(req.query.str_conversation);
	
	var results_per_page = 10,
		start			 = (req.params.pageNum - 1) * results_per_page;
	
	var paginated = conversation.slice(start,start + results_per_page);

	res.render("messages/tenant/show", { conversation: paginated, all_messages: conversation,
										 apartment: apartment, host: apartment.host,
										 results_per_page: results_per_page, pageNum: req.params.pageNum,
										 num_days: req.query.num_days, check_in: req.query.check_in,
										 guests: req.query.guests, check_out: req.query.check_out });
});


// Show Route for tenant
router.get("/tenant/:tenant_id/:apartment", middleware.isTenant, function(req,res){
	User.findById(req.params.tenant_id).populate("messages.apartment")
	.populate({ path:"messages.conversation", populate: { path: "sender recipient" }})
	.exec(function(err, tenant){
		if(err){
			req.flash("error", err.message);
			return res.redirect("back");
		}

		Apartment.findById(req.params.apartment).populate("host").exec(function(err, apartment){
			if(err){
				req.flash("error", err.message);
				return res.redirect("back");
			}

			var conversation = [];
			for(var mail of tenant.messages){
				if(mail.apartment._id.equals(apartment._id)){
					conversation = mail.conversation.concat([]);
					break;
				}
			}

			var str_apartment = JSON.stringify(apartment);
			var str_conversation = JSON.stringify(conversation);

			res.redirect(url.format({
				pathname: "/messages/tenant/page/1",
				query: {
					"str_apartment": str_apartment,
					"str_conversation": str_conversation,
					"num_days": req.query.num_days,
					"check_in": req.query.check_in,
					"guests": req.query.guests,
					"check_out": req.query.check_out
				}
			}));
		});
	});
});


// Index Route for host
router.get("/host/:host_id/:id", middleware.checkApartmentOwnership, function(req,res){
	User.findById(req.params.host_id).populate("apartments").populate("messages.apartment")
	.populate({ path:"messages.conversation", populate: { path: "sender recipient" }})
	.exec(function(err, host){
		if(err){
			req.flash("error", err.message);
			return res.redirect("back");
		}

		var apartment = {};
		for(apartment of host.apartments){
			if(apartment._id.equals(req.params.id)){	
				break;
			}
		}

		if(Object.keys(apartment).length == 0){
			req.flash("error", "Could not find apartment.");
			return res.redirect("back");
		}

		var inbox = [];
		var sent = [];
		
		// console.log(host.messages);
		
		for(var mail of host.messages){
			if(mail.apartment._id.equals(apartment._id)){
				for(var message of mail.conversation){

					if(message.sender._id.equals(host._id)){
						sent.push(message);
					}else{
						inbox.push(message);
					}
				}
				break;
			}
		}

		var str_apartment = JSON.stringify(apartment);
		var str_inbox = JSON.stringify(inbox);
		var str_sent = JSON.stringify(sent);

		res.redirect(url.format({
			pathname: "/messages/host/pages/1/1",
			query: {
				"apartment": str_apartment,
				"inbox": str_inbox,
				"sent": str_sent
			}
		}));
	});
});

// Pagination
router.get("/host/pages/:inboxPage/:sentPage", function(req,res){
	
	var apartment = JSON.parse(req.query.apartment);
	var inbox = JSON.parse(req.query.inbox);
	var sent = JSON.parse(req.query.sent);

	var results_per_page = 10,
		inbox_start			 = (req.params.inboxPage - 1) * results_per_page,
		sent_start			 = (req.params.sentPage - 1) * results_per_page;

	var inbox_paginated = inbox.slice(inbox_start,inbox_start + results_per_page);
	var sent_paginated = sent.slice(sent_start,sent_start + results_per_page);
	
	res.render("messages/host/index", { inbox: inbox_paginated, sent: sent_paginated,
										all_inbox: inbox, all_sent: sent,
										inboxPage: req.params.inboxPage, sentPage: req.params.sentPage,
										apartment: apartment, results_per_page: results_per_page });
});



// Show Route for host
router.get("/host/:host_id/:id/:message_id", middleware.checkApartmentOwnership, function(req,res){
	Message.findById(req.params.message_id).populate("sender").populate("recipient")
	.exec(function(err, message){
		if(err){
			req.flash("error", err.message);
			return res.redirect("back");
		}

		res.render("messages/host/show", { message: message, apartment: req.params.id });
	});
});

// New Route
router.get("/:user/:apartment/new", middleware.isLoggedIn, function(req,res){
	User.findById(req.params.user, function(err, user){
		if(err){
			req.flash("error", err.message);
			return res.redirect("back");
		}

		Apartment.findById(req.params.apartment).populate("host").exec(function(err, apartment){
			if(err){
				req.flash("error", err.message);
				return res.redirect("back");
			}

			var recipient = JSON.parse(req.query.recipient);

			res.render("messages/new", { sender: user, recipient: recipient,
										 apartment: apartment, num_days: req.query.num_days,
										 check_in: req.query.check_in, guests: req.query.guests,
										 check_out: req.query.check_out });
		});
	});
});


// Create Route
router.post("/:user/:apartment", middleware.isLoggedIn, function(req,res){
	User.findById(req.params.user).populate("messages.apartment").populate("messages.conversation")
	.exec(function(err, user){
		if(err){
			req.flash("error", err.message);
			return res.redirect("back");
		}

		Apartment.findById(req.params.apartment)
		.populate({ path: "host",
				   	populate: { path: "messages", populate: { path: "apartment conversation" } } })
		.exec(function(err, apartment){
			if(err){
				req.flash("error", err.message);
				return res.redirect("back");
			}

			var sender = user._id;
			var recipient = req.query.recipient;

			var today = new Date();
			var dd = String(today.getDate()).padStart(2, '0');
			var mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
			var yyyy = today.getFullYear();
			today = dd + '-' + mm + '-' + yyyy;

			var message = {
				subject:	req.body.subject,
				content:	req.body.content,
				date:		today,
				sender:		sender,
				recipient:	recipient
			};

			Message.create(message, function(err, newMessage){
				if(err){
					req.flash("error", err.message);
					return res.redirect("back");
				}

				newMessage.save();


				var updated = false;

				// Add new message in user's mail
				for(var mail of user.messages){
					if(mail.apartment._id.equals(apartment._id)){
						mail.conversation.push(newMessage);
						user.save();
						updated = true;
						break;
					}
				}

				if(updated == false){
					var conversation = [];
					conversation.push(newMessage);

					var mail = {
						apartment: apartment._id,
						conversation: conversation
					};

					user.messages.push(mail);
					user.save();
				}

				// If 'user' is the tenant
				if(user._id.equals(apartment.host._id) == false){
					updated = false;

					// Add new massage in host's mail
					for(var mail of apartment.host.messages){
						if(mail.apartment._id.equals(apartment._id)){
							mail.conversation.push(newMessage);
							apartment.host.save();
							updated = true;
							break;
						}
					}

					if(updated == false){
						var conversation = [];
						conversation.push(newMessage);

						var mail = {
							apartment: apartment._id,
							conversation: conversation
						};

						apartment.host.messages.push(mail);
						apartment.host.save();
					}

					req.flash("success", "Your message was sent successfully.");
					if(user._id.equals(apartment.host._id)){
						res.redirect("/messages/host/" + user._id + "/" + apartment._id);
					}else{
						res.redirect(url.format({
							pathname: "/messages/tenant/" + user._id + "/" + apartment._id,
							query: {
								"num_days": req.query.num_days,
								"check_in": req.query.check_in,
								"guests": req.query.guests,
								"check_out": req.query.check_out
							}
						}));
					}
				}else{										// Host is the user and tenant the recipient

					User.findById(recipient).populate("messages.apartment")
					.populate("messages.conversation").exec(function(err, recipient){
						if(err){
							req.flash("error", err.message);
							return res.redirect("back");
						}

						updated = false;

						// Add new message in recipient's mail
						for(var mail of recipient.messages){
							if(mail.apartment._id.equals(apartment._id)){
								mail.conversation.push(newMessage);
								recipient.save();
								updated = true;
								break;
							}
						}

						if(updated == false){
							var conversation = [];
							conversation.push(newMessage);

							var mail = {
								apartment: apartment._id,
								conversation: conversation
							};

							recipient.messages.push(mail);
							recipient.save();
						}

						req.flash("success", "Your message was sent successfully.");
						if(user._id.equals(apartment.host._id)){
							res.redirect("/messages/host/" + user._id + "/" + apartment._id);
						}else{
							res.redirect(url.format({
								pathname: "/messages/tenant/" + user._id + "/" + apartment._id,
								query: {
									"num_days": req.query.num_days,
									"check_in": req.query.check_in,
									"guests": req.query.guests,
									"check_out": req.query.check_out
								}
							}));
						}
					});
				}
			});
		});
	});
});


// Delete Route
router.delete("/:user/:apartment/:message", middleware.checkMessageOwnership, function(req,res){
	User.findById(req.params.user).populate("messages.apartment").populate("messages.conversation")
	.exec(function(err, foundUser){
		if(err){
			req.flash("error", err.message);
			return res.redirect("back");
		}

		Apartment.findById(req.params.apartment, function(err, apartment){
			if(err){
				req.flash("error", err.message);
				return res.redirect("back");
			}

			for(var mail of foundUser.messages){
				if(mail.apartment._id.equals(apartment._id)){
					var i = 0;
					for(var message of mail.conversation){
						if(message._id.equals(req.params.message)){
							var length = mail.conversation.length;

							// Remove message from user's conversation
							var part1 = mail.conversation.slice(0,i);
							var part2 = mail.conversation.slice(i+1,length);
							mail.conversation = part1.concat(part2);
							foundUser.save();

							var otherUser;
							if(message.sender.equals(foundUser._id)){
								otherUser = message.recipient._id;
							}else{
								otherUser = message.sender._id;
							}

							User.findById(otherUser).populate("messages.apartment")
							.populate("messages.conversation").exec(function(err, otherUser){
								if(err){
									req.flash("error", err.message);
									return res.redirect("back");
								}

								// Check if the other user has deleted this message as well
								var found = false;
								for(var mail of otherUser.messages){
									if(mail.apartment._id.equals(apartment._id)){
										for(var message of mail.conversation){
											if(message._id.equals(req.params.message)){
												found = true;
												break;
											}
										}
										break;
									}
								}

								// If both users have deleted this message,
								// it should be removed from the db as well
								if(found == false){
									Message.findByIdAndRemove(req.params.message, function(err){
										if(err){
											req.flash("error", err.message);
											return res.redirect("back");
										}

										req.flash("success", "Message was deleted successfully.");
										if(foundUser._id.equals(apartment.host)){
											return res.redirect("/messages/host/" + foundUser._id + "/"
														 + apartment._id);
										}else{
											return res.redirect(url.format({
												pathname: "/messages/tenant/" + foundUser._id + "/"
													+ apartment._id,
												query: {
													"num_days": req.query.num_days,
													"check_in": req.query.check_in,
													"guests": req.query.guests,
													"check_out": req.query.check_out
												}
											}));
										}
									});
								}else{
									req.flash("success", "Message was deleted successfully.");
									if(foundUser._id.equals(apartment.host)){
										return res.redirect("/messages/host/" + foundUser._id + "/"
												+ apartment._id);
									}else{
										return res.redirect(url.format({
											pathname: "/messages/tenant/" + foundUser._id + "/"
												+ apartment._id,
											query: {
												"num_days": req.query.num_days,
												"check_in": req.query.check_in,
												"guests": req.query.guests,
												"check_out": req.query.check_out
											}
										}));
									}
								}
							});
							break;
						}
						i += 1;
					}
					break;
				}
			}
		});
	});
});

module.exports = router;