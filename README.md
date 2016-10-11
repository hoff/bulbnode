# bulbnode
a node server capable of connection to Bluetooth LE light bulbs, and controlling their color

Dependencies:
- express
- socket.io
- noble

Noble has different requirements per platform, follow the instrucations here:

https://www.npmjs.com/package/noble

## Ubuntu/Debian/Raspbian
sudo apt-get install bluetooth bluez libbluetooth-dev libudev-dev

# Do this once
In order to be able to use bluetooth as a non-root user, do this:

sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)
This grants the node binary cap_net_raw privileges, so it can start/stop BLE advertising.

Note: The above command requires setcap to be installed, it can be installed using the following:
apt: sudo apt-get install libcap2-bin

# install node and nvm on raspbian
it's pretty straight forward:
https://github.com/blobsmith/raspberryTestNode/wiki/Node.js-installation-with-nvm-on-Raspberry-pi
