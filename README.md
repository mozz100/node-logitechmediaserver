Just some code I wrote for my [home automation system](http://www.rmorrison.net/homenode). Connects javascript to a Logitech Media Server (formerly Squeezebox Server).  It provides a "telnet server" which I just connect to using `net.createConnection`.

See example.js for how to use.

Collects information about known players and then allows:
* monitoring of volume, wifi signal strength, power status (on/off)
* switch on/off by calling simple functions
* play/pause/stop
* sending arbitrary commands through the telnet interface

I used this together with my [xBee] module to play sounds when my back door opened, and so on.


Licence
-------

<a rel="license" href="http://creativecommons.org/licenses/by-sa/2.0/uk/">
<img alt="Creative Commons License" style="border-width:0" src="http://i.creativecommons.org/l/by-sa/2.0/uk/88x31.png" />
</a><br />
This work by <span xmlns:cc="http://creativecommons.org/ns#" property="cc:attributionName">Richard Morrison</span>
is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by-sa/2.0/uk/">Creative Commons Attribution-ShareAlike 2.0 UK: England &amp; Wales License</a>.
<br />
Based on a work at <a xmlns:dct="http://purl.org/dc/terms/" href="https://github.com/mozz100/node-logitechmediaserver" rel="dct:source">github.com</a>.
