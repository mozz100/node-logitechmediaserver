var util = require('util');
var EventEmitter = require('events').EventEmitter;

function SqueezePlayer(telnet) {
  this.telnet = telnet;
}
util.inherits(SqueezePlayer, EventEmitter);

SqueezePlayer.prototype.runTelnetCmd = function(cmdstring) {
    this.telnet.writeln(self.id + " " + cmdstring);
}

SqueezePlayer.prototype.handleServerData = function(params, raw_buffer) {
    this.emit(params[0], params.slice(1));
    this.emit("logitech_event", params);
}

SqueezePlayer.prototype.switchOff = function() {
    this.runTelnetCmd("power 0");
}

SqueezePlayer.prototype.switchOn = function() {
    this.runTelnetCmd("power 1");
}

SqueezePlayer.prototype.inspect = function() {
    // Convenience method for debugging/logging.
    // Return self but without certain lengthy sub-objects.
    var self = this;
    var x = {};
    Object.keys(self).forEach(function(k) {
        if (["telnet", "_events"].indexOf(k) == -1) {
            x[k] = self[k];
        }
    });
    return x;
}

module.exports = SqueezePlayer;

