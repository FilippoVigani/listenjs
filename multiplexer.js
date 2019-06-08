const url = require('./url')
const Manager = require('./manager')

class Multiplexer {
	constructor(){
		this.cache = []
	}

	provideManager(optsOrUri) {
		let opts = {}
		if (typeof optsOrUri === 'string') {
			opts.uri = optsOrUri
		}

		const parsed = url(opts.uri)
		opts.source = parsed.source
		opts.id = parsed.id
		opts.href = parsed.href


		if (!this.cache[opts.id]) {
			console.log(`New manager for ${opts.id}`)
			this.cache[opts.id] = new Manager(opts)
		} else {
			console.log(`Recycling manager for ${opts.id}`)
		}
		return this.cache[opts.id]
	}
}

module.exports = Multiplexer