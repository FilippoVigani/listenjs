const Observer = require('./observer')
const Backoff = require('backo')
const url = require('./url')

class Manager {
	constructor(opts) {
		this.opts = opts
		this.destination = opts.id
		this.pingInterval = opts.pingInterval || null
		this.pingTimeout = opts.pingTimeout || null
		this.observers = []
		this.clientId = null
		this._status = Manager.Status.IDLE
		this.backoff = new Backoff({
			min: opts.reconnectionDelay || 1000,
			max: opts.reconnectionMaxDelay || 5000,
			jitter: opts.reconnectionJitter || 0.5
		})
		this.onStatusChange = () => {}
	}

	get socket() {
		if (!this._socket) {
			this.status = Manager.Status.CONNECTING
			this._socket = new WebSocket(this.destination)
			this._setupListeners()
		}
		return this._socket
	}

	set socket(socket){
		this._socket = socket
	}

	set status(status){
		this.onStatusChange(status)
		console.log(`Manager ${this.destination} status: ${status}`)
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
				action: Manager.Event.HANDSHAKE,
				pingInterval: this.pingInterval,
				pingTimeout: this.pingTimeout
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
			this._handleShutdown()
		})
		this.socket.addEventListener('close', event => {
			console.log(`WebSocket disconnected gracefully`)
			console.log(event)
			this.status = Manager.Status.DISCONNECTED
			this._handleShutdown()
		})
	}

	_handleMessage(payload) {
		if (payload.action === Manager.Event.HANDSHAKE_ACK) {
			this.pingInterval = payload.pingInterval
			this.pingTimeout = payload.pingTimeout
			this._setPing()
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

		if (payload.action === Manager.Event.HEARTBEAT_ACK) {
			clearTimeout(this.pingTimeoutTimer)
			this._setPing()
		}
	}

	_handleShutdown(){
		this.socket = null
		clearTimeout(this.pingIntervalTimer)
		clearTimeout(this.pingTimeoutTimer)
		if (this.observers.length > 0){
			const delay = this.backoff.duration()
			this.status = Manager.Status.RECONNECTING
			setTimeout(() => {
				this.socket
			}, delay)
		}
	}

	_setPongTimeout(){
		clearTimeout(this.pingTimeoutTimer)
		this.pingTimeoutTimer = setTimeout(() => {
			this.socket.close()
		}, this.pingTimeout)
	}

	_setPing(){
		clearTimeout(this.pingIntervalTimer)
		this.pingIntervalTimer = setTimeout(() => {
			if (this.status === Manager.Status.CONNECTED){
				this._sendPayload({
					action: Manager.Event.HEARTBEAT
				})
				this._setPongTimeout()
			}
		}, this.pingInterval)
	}

	_sendPayload(payload){
		payload.clientId = this.clientId
		console.log("Sending payload")
		console.log(payload)
		this.socket.send(JSON.stringify(payload))
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
		const relPath = url(path).path
		const index = this.observers.findIndex(obs => obs.path === relPath)
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
		const relPath = url(path).path
		const observer = this.provideObserver(relPath)

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