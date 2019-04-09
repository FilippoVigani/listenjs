class Listener {
    constructor(endpoint) {
        this.socket = new WebSocket(endpoint);
    }

    set onupdate(callback){
        this.socket.onmessage = function(event){
            callback(event.data);
        }
    }

    set onconnected(callback){
        this.socket.onopen = function(event){
            callback();
        }
    }

    set onerror(callback){
        this.socket.onerror = function(error){
            callback(error);
        }
    }

    set ondisconnected(callback){
        this.socket.onclose = function(event){
            callback();
        }
    }

    dispose(){
        this.socket.close();
    }
}

const listen = function (endpoint) {
    if (typeof endpoint !== "string") throw new TypeError("Endpoint must be a string");
    return new Listener(endpoint);
};

module.exports.listen = listen