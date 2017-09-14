var express = require('express'),
    openid  = require('openid'),
    Promise = require('bluebird/js/main/promise')(),
    request = require('request-promise');

var relyingParty, apiKey, useSession = true;

module.exports.init = function(opts)
{
    relyingParty = new openid.RelyingParty(
		opts.verify,
		opts.realm,
		true,
		true,
		[]
	);

    apiKey = opts.apiKey;
}

module.exports.enforceLogin = function(redirect)
{
	return function(req, res, next) {
		if(!req.user)
			return res.redirect(redirect);
		next();
	};
}

module.exports.verify = function(req, callback)
{
	relyingParty.verifyAssertion(req, function(err, result) {
		if(err)
            return callback({error: err.message}, null);
		if(!result || !result.authenticated)
			return callback({error: 'Failed to authenticate user.'}, null);
		if(!/^https?:\/\/steamcommunity\.com\/openid\/id\/\d+$/.test(result.claimedIdentifier))
			return callback({error: 'Claimed identity is not valid.'}, null);

		fetchIdentifier(result.claimedIdentifier)
			.then(function(user) {
                callback(false, user);
			})
			.catch(function(err)
			{
				callback(err, null);
			}
        );

	});
}

module.exports.authenticate = function(callback)
{
	relyingParty.authenticate('http://steamcommunity.com/openid', false, function(err, authURL) {
		if(err) {
			console.log(err);
            callback({error: "Authentication failed: " + err}, null);
			return;
		}
		if(!authURL) {
            console.log('Steam auth url not found.')
            callback({error: "Authentication failed."}, null);
            return;
        }

		callback(false, authURL);
	});
}

function fetchIdentifier(steamID)
{
	// our url is http://steamcommunity.com/openid/id/<steamid>
	steamID = steamID.replace('http://steamcommunity.com/openid/id/', '');
	return request('http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key='+apiKey+'&steamids=' + steamID)
		.then(function(res) {
			var players = JSON.parse(res).response.players;
			if(players.length == 0)
				throw new Error('No players found for the given steam ID.');
			var player = players[0];
			return Promise.resolve({
				_json: player,
				steamid: steamID,
				username: player.personaname,
				name: player.realname,
				profile: player.profileurl,
				avatar: {
					small: player.avatar,
					medium: player.avatarmedium,
					large: player.avatarfull
				}
			});
		});
}
