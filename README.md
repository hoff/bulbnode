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
