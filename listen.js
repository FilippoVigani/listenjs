const Multiplexer = require('./multiplexer')
const multiplexer = new Multiplexer()

module.exports.listen = function(path, callback){
	multiplexer.provideManager(path).listen(path, callback)
}
module.exports.stopListening = function(path){
	multiplexer.provideManager(path).stopListening(path)
}