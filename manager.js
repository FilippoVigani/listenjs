const Observer = require('./observer')
const Backoff = require('backo')

class Manager {
	constructor(opts) {
		this.opts = opts
		this.observers = []
		this.clientId = null
		this._status = Manager.Status.IDLE
		//TODO: Make backoff params customizable
		this.backoff = new Backoff({
			min: 1000,
			max: 5000,
			jitter: 0.5
		})
		this.onStatusChange = () => {}
	}

	get socket() {
		if (!this._socket) {
			this.status = Manager.Status.CONNECTING
			this._socket = new WebSocket(this.opts.id)
			this._setupListeners()
		}
		return this._socket
	}

	set socket(socket){
		this._socket = socket
	}

	set status(status){
		this.onStatusChange(status)
		console.log(`Manager ${this.opts.href} status: ${status}`)
		this._status = status
	}

	get status(){
		return this._status
	}

	_setupListeners() {
		this.socket.addEventListener('open', () => {
			this.backoff.reset()
			this.status = Manager.Status.HANDSHAKING
			const handshake = {
				action: Manager.Event.HANDSHAKE
			}
			this._sendPayload(handshake)
		})
		this.socket.addEventListener('message', event => {
			console.log("Received message")
			console.log(event)
			this._handleMessage(JSON.parse(event.data))
		})
		this.socket.addEventListener('error', event => {
			console.log(`WebSocket disconnected with error`)
			console.log(event)
			this.status = Manager.Status.ERROR
			this.socket = null
			if (this.observers.length > 0){
				const delay = this.backoff.duration()
				this.status = Manager.Status.RECONNECTING
				setTimeout(() => {
					this.socket
				}, delay)
			}
		})
		this.socket.addEventListener('close', event => {
			console.log(`WebSocket disconnected gracefully`)
			console.log(event)
			this.status = Manager.Status.DISCONNECTED
			this.socket = null
			if (this.observers.length > 0){
				const delay = this.backoff.duration()
				this.status = Manager.Status.RECONNECTING
				setTimeout(() => {
					this.socket
				}, delay)
			}
		})
	}

	_handleMessage(payload) {
		if (payload.action === Manager.Event.HANDSHAKE_ACK) {
			if (payload.clientId !== this.clientId) {
				this.clientId = payload.clientId
				this.status = Manager.Status.CONNECTED
				console.log(`New client ID received: ${payload.clientId}, subscribing all observers`)
				this.observers.forEach(observer => {
					observer.status = Observer.Status.SUBSCRIBING
					const subscribe = {
						action: Manager.Event.SUBSCRIBE,
						observerId: observer.id,
						path: observer.path
					}
					this._sendPayload(subscribe)
				})
			} else {
				console.log(`Using same client ID: ${this.clientId}, subscribing new observers`)
				this.observers
					.filter(obs => obs.status === Observer.Status.WAITING_HANDSHAKE)
					.forEach(observer => {
						observer.status = Observer.Status.SUBSCRIBING
						const subscribe = {
							action: Manager.Event.SUBSCRIBE,
							path: observer.path
						}
						this._sendPayload(subscribe)
					})
			}
		}

		if (payload.action === Manager.Event.SUBSCRIBE_ACK) {
			if (payload.observerId){
				const observer = this.observers.find(obs => obs.id === payload.observerId)
				if (observer){
					observer.status = Observer.Status.LISTENING
				}
			}
		}

		if (payload.action === Manager.Event.UPDATE) {
			const observer = this.observers.find(obs => obs.path === payload.path)
			if (observer){
				observer.notify(payload.body)
			}
		}
	}

	_sendPayload(payload){
		console.log("Sending payload")
		console.log(payload)
		this.socket.send(JSON.stringify({
			...payload,
			clientId: this.clientId
		}))
	}

	provideObserver(path) {
		let observer = this.observers.find(obs => obs.path === path)

		if (!observer){
			observer = new Observer(this._generateObserverId(), path)
			this.observers.push(observer)
			if (this.status === Manager.Status.CONNECTED){
				observer.status = Observer.Status.SUBSCRIBING
				const subscribe = {
					action: Manager.Event.SUBSCRIBE,
					clientId: this.clientId,
					path: observer.path
				}
				this.socket.send(JSON.stringify(subscribe))
			} else if(this.status === Manager.Status.IDLE){
				this.socket
			}
		}

		return observer
	}

	stopListening(path){
		const index = this.observers.findIndex(obs => obs.path === path)
		if (index >= 0){
			const observer = this.observers[index]
			observer.clearCallbacks()
			if (this.status === Manager.Status.CONNECTED){
				observer.status = Observer.Status.UNSUBSCRIBING
				const subscribe = {
					action: Manager.Event.UNSUBSCRIBE,
					clientId: this.clientId,
					path: observer.path
				}
				this.socket.send(JSON.stringify(subscribe))
			}
			this.observers.splice(index, 1)
		}
		if (!this.observers){
			this.socket.close(1000, "No more active observers.")
		}
	}

	listen(path, callback){
		const observer = this.provideObserver(path)

		observer.addCallback(callback)
	}

	_generateObserverId() {
		let d = new Date().getTime()
		if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
			d += performance.now()
		}
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
			const r = (d + Math.random() * 16) % 16 | 0
			d = Math.floor(d / 16)
			return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
		})
	}
}

Manager.Status = {
	IDLE: 'idle',
	CONNECTED: 'connected',
	HANDSHAKING: 'handshaking',
	DISCONNECTED: 'disconnected',
	ERROR: 'error',
	CONNECTING: 'connecting',
	RECONNECTING: 'reconnecting'
}

Manager.Event = {
	HANDSHAKE: "handshake",
	HANDSHAKE_ACK: "handshake_ack",
	SUBSCRIBE: "subscribe",
	SUBSCRIBE_ACK: "subscribe_ack",
	UNSUBSCRIBE: "unsubscribe",
	UNSUBSCRIBE_ACK: "unsubscribe_ack",
	UPDATE: "update",
	HEARTBEAT: "heartbeat",
	HEARTBEAT_ACK: "heartbeat_ack",
}

module.exports = Manager