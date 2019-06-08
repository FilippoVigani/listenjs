class Observer {
	constructor(id, path) {
		this.id = id
		this.path = path
		this._status = Observer.Status.WAITING_HANDSHAKE
		this.callbacks = []
	}

	get status(){
		return this._status
	}

	set status(status){
		console.log(`Observer ${this.id} status: ${status}`)
		this._status = status
	}

	addCallback(callback){
		this.callbacks.push(callback)
	}

	clearCallbacks(){
		this.callbacks = []
	}

	notify(data){
		console.log(`Notified on new data on ${this.path}: ${data}`)
		this.callbacks.forEach(callback => callback(data))
	}
}

Observer.Status = {
	WAITING_HANDSHAKE: "waiting_for_handshake",
	SUBSCRIBING: "subscribing",
	UNSUBSCRIBING: "unsubscribing",
	LISTENING: "listening",
	ERROR: "error"
}

module.exports = Observer