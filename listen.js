import io from 'socket.io-client'

const Status = {
	IDLE: 'idle',
	CONNECTED: 'connected',
	CONNECTION_ERROR: 'connection_error',
	CONNECTION_TIMEOUT: 'connection_timeout',
	ERROR: 'error',
	RECONNECTING: 'reconnecting',
	DISCONNECTED: 'disconnected'
}

class Listener {
	constructor(endpoint, action, onStatusChange) {
		this.endpoint = endpoint
		this.actions = [action]
		this.onStatusChange = onStatusChange

		this._initSocket()
	}

	_initSocket(){
		this.status = Status.IDLE
		this.socket = io({
			query: {
				path: this.endpoint
			},
			autoConnect: false
		})
		this.socket.on('connect', () => this._setStatus(Status.CONNECTED))
		this.socket.on('connect_error', (error) => this._setStatus(Status.CONNECTION_ERROR, {error: error}))
		this.socket.on('connect_timeout', (timeout) => this._setStatus(Status.CONNECTION_TIMEOUT, {timeout: timeout}))
		this.socket.on('error', (error) => this._setStatus(Status.ERROR, {error: error}))
		this.socket.on('reconnecting', (attempts) => this._setStatus(Status.RECONNECTING, {attempts: attempts}))
		this.socket.on('disconnect', (reason) => this._setStatus(Status.DISCONNECTED, {reason: reason}))

		this.socket.on('update', payload => this.actions.forEach(callback => callback(payload)))
		this.socket.on('delete', () => this.actions.forEach(callback => callback(null)))
	}

	start(){
		if (this.endpoint)
			this.socket.open()
		else
			throw new Error("No endpoint specified for this listener")
	}

	stop(){
		this.socket.close()
	}

	switchTo(endpoint){
		this.endpoint = endpoint
		this.stop()
		this._initSocket()
		this.start()
	}

	addAction(action){
		this.actions = [...this.actions, action]
	}

	_setStatus(status, data){
		this.status = {
			status: status,
			...(data || {})
		}
		if (this.onStatusChange)
			this.onStatusChange(this.status)
	}
}

const _listen = function (endpoint, action, onStatusChange) {
	if (typeof endpoint !== "string") throw new TypeError("Endpoint must be a string")
	const listener = new Listener(endpoint, action, onStatusChange)

	listener.start()

	return listener
}

const _prepare = function(action, onStatusChange){
	return new Listener(null, action, onStatusChange)
}

export const listen = _listen
export const prepare = _prepare