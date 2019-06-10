/**
 * Module dependencies.
 */

const parseuri = require('parseuri')

/**
 * Module exports.
 */

module.exports = url

/**
 * URL parser.
 *
 * @param {String} url
 * @param {Object} An object meant to mimic window.location.
 *                 Defaults to window.location.
 * @api public
 */

function url (uri, loc) {
	let obj = uri

	// default to window.location
	loc = loc || global.location
	if (null == uri) uri = 'ws://' + loc.host

	// relative path support
	if ('string' === typeof uri) {
		if (uri.charAt(0) === '/') {
			if (uri.charAt(1) === '/') {
				uri = 'ws://' + uri
			} else {
				uri = loc.host + uri
			}
		}

		if (!/^(https?|wss?):\/\//.test(uri)) {
			uri = 'ws://' + uri
		}

		console.log(`Parsing ${uri}`)
		obj = parseuri(uri)
	}

	// make sure we treat `localhost:80` and `localhost` equally
	if (!obj.port) {
		if (/^(http|ws)$/.test(obj.protocol)) {
			obj.port = '80'
		} else if (/^(http|ws)s$/.test(obj.protocol)) {
			obj.port = '443'
		}
	}

	obj.path = obj.path || '/'

	const ipv6 = obj.host.indexOf(':') !== -1
	const host = ipv6 ? '[' + obj.host + ']' : obj.host

	// define unique id
	obj.id = obj.protocol + '://' + host + ':' + obj.port
	// define href
	obj.href = obj.protocol + '://' + host + (loc && loc.port === obj.port ? '' : (':' + obj.port))
	//define ws id
	obj.wsid = 'ws://' + host + ':' + obj.port

	return obj
}