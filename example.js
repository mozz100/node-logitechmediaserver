var LogitechMediaServer = require('./index');
var lms = new LogitechMediaServer('192.168.0.106');
var player;
var mac_address = '00:04:20:27:5f:75';   // kitchen

// Simple keypress detection
var readline = require('readline');
var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
// Hit enter to see the player status
rl.on('line', function (cmd) {
  console.log(player.inspect());
});

lms.on("registration_finished", function() {
  console.log("Registration finished.");

  // Find the player in the players dictionary
  player = lms.players[mac_address];
  console.log(player.inspect());
  
  // For debugging/learning, output events to console.log
  player.on("logitech_event", function(p) {
      console.log("logitech_event", p);
  });
});

lms.start();
