var util = require('util');
var EventEmitter = require('events').EventEmitter;

function startsWith(search, s) {
    return s.substr(0,search.length) == search;
}

function SqueezePlayer(telnet) {
  var self = this;
  this.telnet = telnet;
  this.volume = 0;
  // periodically check this player's parameters
  setInterval(function() {
    self.runTelnetCmd("mixer volume ?");
    self.runTelnetCmd("signalstrength ?");
    self.runTelnetCmd("power ?");    
  }, 30 * 1000);
}
util.inherits(SqueezePlayer, EventEmitter);

SqueezePlayer.prototype.runTelnetCmd = function(cmdstring) {
    this.telnet.writeln(this.id + " " + cmdstring);
}

SqueezePlayer.prototype.handleServerData = function(strEvent, raw_buffer) {
    var self = this;
    if (startsWith("mixer volume", strEvent)) {
        var v = strEvent.match(/^mixer volume\s(.*?)$/)[1];
        // incremental change
        if (startsWith("+", v) || startsWith("-", v)) {
            self.volume += parseInt(v);
        }
        // explicit value
        else {
            self.volume = parseInt(v);
        }
    } else {
        this.emit("logitech_event", strEvent);
    }
}

SqueezePlayer.prototype.switchOff = function() {
    this.runTelnetCmd("power 0");
}

SqueezePlayer.prototype.switchOn = function() {
    this.runTelnetCmd("power 1");
}

SqueezePlayer.prototype.setProperty = function(property, state) {
    this[property] = state;
    this.emit(property, state);
}

SqueezePlayer.prototype.getNoiseLevel = function() {
    var nl = this.volume;
    if (this.mode == "stop" || this.mode == "pause" || this.mode == "off" || this.power == 0) {
        nl = 0;
    }
    return nl;
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
    x.noise_level = self.getNoiseLevel();
    return x;
}

module.exports = SqueezePlayer;

