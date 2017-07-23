var util = require('util');
var net = require('net');
var EventEmitter = require('events').EventEmitter;
var SqueezePlayer = require('./squeezeplayer');

// Add a trivial method to the net.Stream prototype object to
// enable debugging during development.  It just appends \n and writes to the stream.
net.Stream.prototype.writeln = function(s) {
    // Uncomment the next line to see data as it's written to telnet
    // console.log("> " + s);
    this.write(s + "\n");
}

// The LogitechMediaServer object is an event emitter with a few properties.
// After creating it, call .start() and wait for the "registration_finished" event.
// The port number is optional, if not provided, the default value of 9090 is used.
function LogitechMediaServer(address, port) {
  var self = this;
  self.address = address;
  self.port = port || 9090;
}
util.inherits(LogitechMediaServer, EventEmitter);


// Start listening to the telnet server provided by Logitech Media Server.
// Username/password are optional, if both are provided we will log in using those credentials.
LogitechMediaServer.prototype.start = function(username, password) {
    var self = this;
    
    // Listen on self.port to self.address
    self.telnet = net.createConnection(self.port, self.address);
    self.line_parser = new LineParser(self.telnet);

    // The LineParser just emits a "line" event for each line of data
    // that the LMS telnet connection emits
    self.line_parser.on("line", function(data) {
        // Uncomment the next line to see text lines coming back from telnet
        // console.log("< " + data.toString().replace(/\n/g,"\\n"));
        self.handleLine(data);
    });
    
    if (username && password) {
        // Start things off by logging in.
        self.telnet.writeln("login " + username + " " + password);
    }
    else {
        // Start things off by asking how many players are connected.
        // See .handle() - the response to 'player count ?' is how the code
        // discovers info about all the known players.
        self.telnet.writeln("player count ?");
    }
}

LogitechMediaServer.prototype.handle = function(buffer, keyword, callback) {
    // If data starts with keyword, call the callback with the remainder, and return true.
    // Otherwise just return false.
    // e.g. "player count 3\n", "player count" would call the callback with "3"
    
    // seems as if the telnet server URL encodes things
    var data = decodeURIComponent(buffer.toString());

    // Look for (start of string)(keyword) (data)(end of string)
    var m = data.match("^" + keyword + "\\s(.*?)$");

    if (m) {
        // call the callback with the remainder of the string
        callback(m[1], buffer);
        return true;
    }
    return false;
}

LogitechMediaServer.prototype.handle_with_id = function(buffer, keyword, callback) {
    // Similar to .handle, but look for a MAC address:
    // EITHER xx:xx:xx:xx:xx:xx followed by keyword, follwed by data
    // OR     xx:xx:xx:xx:xx:xx followed by data (keyword should be set to null for this)
    var self = this;

    // seems as if the telnet server URL encodes things
    var data = decodeURIComponent(buffer.toString());

    // step through the known players
    for (mac in self.players) {
        var player = self.players[mac];

        if (keyword) {
            // look for (start)(mac) (keyword) (data)(end)
            var m = data.match("^" + player.id + "\\s" + keyword + "\\s(.*?)$");
            if (m) {
                callback(player, m[1], buffer);
                return true;
            }
            // perhaps it's just a line like "00:00:00:00:00:00 stop".  i.e. data is nonexistent
            // look for (start)(mac) (keyword)(end)
            var m = data.match("^" + player.id + "\\s" + keyword + "$");
            if (m) {
                callback(player, null, buffer);
                return true;
            }
        } else {
            // look for (start)(mac) (data)(end)
            var m = data.match("^" + player.id + "\\s(.*?)$");
            if (m) {
                callback(player, m[1], buffer);
                return true;
            }
        }
    };
    return false;

}

// Passed a player index and a player MAC address, add to in-memory dictionary of players
LogitechMediaServer.prototype.registerPlayer = function(pnum, pid) {
    var self = this;

    self.players[pid]        = new SqueezePlayer(self.telnet);
    self.players[pid].id     = pid;
    self.players[pid].index  = pnum;

    // Check whether this is the last player we're waiting for, if so emit "registration_finished"
    if (Object.keys(self.players).length == self.numPlayers) {
        self.emit("registration_finished");
        // Can now start listening for all sorts of things!
        self.telnet.writeln("listen 1");
    }
}


// Parse incoming data stream splitting on \n and emitting "line" events
function LineParser(stream) {
    var self = this;
    self.stream = stream;
    self.buffer = "";
    self.stream.on("data", function(d) { self.parse(d) });
}
util.inherits(LineParser, EventEmitter);

LineParser.prototype.parse = function(data) {
    this.buffer += data;
    var split = this.buffer.indexOf("\n");
    while (split > -1) {
      this.emit('line', this.buffer.slice(0,split));
      this.buffer = this.buffer.slice(split+1);
      split = this.buffer.indexOf("\n");
    }
}

// Called with each line received from the telnet connection, this function looks for
// various commands and acts on them.  Anything unhandled falls out at the bottom
// (currently gets logged to console), except for unhandled stuff that relates to a player.
// Those lines get passed to the player object for handling.
LogitechMediaServer.prototype.handleLine = function(buffer) {
    var self = this;
    var handled = false;

    // Guts of this function is pretty much a list of commands and callbacks.
    // Could definitely be made more efficient, or a bit DRYer, but it's just a bunch of string comparisons.
    
    // "login username ********" response is what kicks things off if we are using password protection (see .start())
    if (self.handle(buffer, "login", function (params, buffer) {
        // Start things off by asking how many players are connected.
        self.telnet.writeln("player count ?");
    })) { handled = true } ;
    
    // "player count" response is what kicks things off in the first place (see .start() or above)
    if (self.handle(buffer, "player count", function(params, buffer) {
        // reset in-memory knowledge of players
        self.numPlayers = parseInt(params[0]);
        self.players = {};

        // Now issue a "player id" request for each player
        for (var p=0; p<self.numPlayers; p++) {
            self.telnet.writeln("player id " + p + " ?");
        }
    })) { handled=true } ;

    // This response is received for each player, so store 'em in memory as a dic
    if (self.handle(buffer, "player id", function(params, b) {
        params = params.split(" ");
        var pnum = parseInt(params[0]);
        var pid  = params[1];

        self.registerPlayer(pnum, pid);

        // Now that we know the id & mac, ask for more info.  name and signalstrength, also power state
        self.telnet.writeln(pid + " signalstrength ?");
        self.telnet.writeln(pid + " name ?");
        self.telnet.writeln(pid + " power ?");
        self.telnet.writeln(pid + " mixer volume ?");
    })) { handled = true } ;

    // Just handle the "listen" response (LMS should just respond with 'listen 1' at the beginning)
    if (self.handle(buffer, "listen", function() {})) { handled = true };

    // ~~~~~~~~~~~~~~ keywords below here are those which are associated with an individual player ~~~~~~~~~~~~~~~~~~

    if (self.handle_with_id(buffer, "signalstrength", function(player, params, b) {
        player.setProperty("signalstrength", parseInt(params));
    })) { handled = true } ;

    if (self.handle_with_id(buffer, "power", function(player, params, b) {
        player.setProperty("power", parseInt(params));

        if (player.power == 1) {
            // Wait a tiny bit while player is powering up and then ask what state the player is in
            setTimeout(function() { player.runTelnetCmd("mode ?") }, 1500);
        } else {
            player.setProperty("mode", "off");
        }
    })) { handled = true } ;

    if (self.handle_with_id(buffer, "name", function(player, params, b) {
        player.setProperty("name", params);
    })) { handled = true };

    if (self.handle_with_id(buffer, "current_title", function(player, params, b) {
        player.setProperty("current_title", params);
    })) { handled = true };

    if (self.handle_with_id(buffer, "mode", function(player, params, b) {
        player.setProperty("mode", params);  // "play", "stop" or "pause"
    })) { handled = true };

    if (self.handle_with_id(buffer, "play", function(player, params, b) {
        player.setProperty("mode", "play");
        // player has started playing something.  Let's find out what!
        player.runTelnetCmd("current_title ?");
    })) { handled = true };

    if (self.handle_with_id(buffer, "stop", function(player, params, b) {
        player.setProperty("mode", "stop");
    })) { handled = true };

    if (self.handle_with_id(buffer, "pause", function(player, params, b) {
        player.setProperty("mode", "pause");
    })) { handled = true };

    if (!handled) {
        // handle any string received that starts with an id and isn't handled yet by passing events
        // to the player objects.
        if (!self.handle_with_id(buffer, null, function(player, params, b) {
            player.handleServerData(params, b);
        })) {
            // anything else, just log to console for now.  Could be an event of its own.
            console.log("unhandled line", decodeURIComponent(buffer.toString()));
        }
    }
}

module.exports = LogitechMediaServer;