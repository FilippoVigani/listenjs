const url = require('./url')
const Manager = require('./manager')

class Multiplexer {
	constructor(){
		this.cache = []
		this.onConnected = () => {}
		this.onDisconnected = () => {}
		this.onConnecting = () => {}
		this.onReconnecting = () => {}
		this.onError = () => {}
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
			const manager = new Manager(opts)
			this.cache[opts.id] = manager
			manager.onStatusChange = status => {
				this.handleStatusChange(status, manager.clientId)
			}
		} else {
			console.log(`Recycling manager for ${opts.id}`)
		}
		return this.cache[opts.id]
	}

	handleStatusChange(status, clientId){
		if (status === Manager.Status.CONNECTING || status === Manager.Status.HANDSHAKING)
			this.onConnecting(clientId)
		else if (status === Manager.Status.CONNECTED)
			this.onConnected(clientId)
		else if (status === Manager.Status.DISCONNECTED)
			this.onDisconnected(clientId)
		else if (status === Manager.Status.RECONNECTING)
			this.onReconnecting(clientId)
		else if (status === Manager.Status.ERROR)
			this.onError(clientId)
	}
}

module.exports = Multiplexer