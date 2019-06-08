const Multiplexer = require('./multiplexer')
const multiplexer = new Multiplexer()

module.exports.listen = function(path, callback){
	multiplexer.provideManager(path).listen(path, callback)
}
module.exports.stopListening = function(path){
	multiplexer.provideManager(path).stopListening(path)
}
module.exports.onConnected = function(callback){
	multiplexer.onConnected = callback
}
module.exports.onDisconnected = function(callback){
	multiplexer.onDisconnected = callback
}
module.exports.onReconnecting = function(callback){
	multiplexer.onReconnecting = callback
}
module.exports.onConnecting = function(callback){
	multiplexer.onConnecting = callback
}
module.exports.onError = function(callback){
	multiplexer.onError = callback
}