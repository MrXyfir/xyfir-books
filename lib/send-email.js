const config = require("config");

const mailgun = require("mailgun-js")({
	apiKey: config.keys.mailgun,
	domain: config.addresses.mailgun.domain
});

module.exports = function(to, subject, text) {

	mailgun.messages().send({
		from: "Libyq <libyq@xyfir.com>",
		to, subject, text
	}, (err, body) => { return; });

}