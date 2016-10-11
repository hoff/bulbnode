/// <reference path="node_modules/@types/node/index.d.ts" />

var express = require('express')()
var http = require('http').Server(express)
var io = require('socket.io')(http)
var noble = require('noble')

// try bleno
var bleno = require('bleno')
var BlenoPrimaryService = bleno.PrimaryService;
var EchoCharacteristic = require('./characteristic');

bleno.on('stateChange', function(state) {
  console.log('on -> stateChange: ' + state);

  if (state === 'poweredOn') {
    bleno.startAdvertising('echo', ['ec00']);
  } else {
    bleno.stopAdvertising();
  }
});

bleno.on('advertisingStart', function(error) {
  console.log('on -> advertisingStart: ' + (error ? 'error ' + error : 'success'));
  if (!error) {
    bleno.setServices([
      new BlenoPrimaryService({
        uuid: 'ec00',
        characteristics: [
          new EchoCharacteristic()
        ]
      })
    ]);
  }
});

// end of bleno


/**
 * The Server
 */
http.listen(3000, () => {
    console.log('!!!started scanning and listening on port 3000')
    console.log('bleno?', bleno)
})

/**
 * Express Routes
 */
express.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html')
    noble.startScanning()
})

/**
 * Socket Connections
 */
io.on('connection', function (socket) {
    console.log('a user connected');
    socket.on('disconnect', function () {
        console.log('user disconnected');
    });
    socket.on('command', (command) => {
        if (command === 'setup') {
            rainbowSetup()
        } else if (command === 'start') {
            startRainbow()
        } else if (command === 'stop') {
            stopRainbow()
        } else if (command === 'step') {
            rainbowStep()
        }
    })
    socket.on('color', (options) => {
        let bulb = bulbs[options.position]
        let hsl = hexToRgb(options.hex)
        bulb.setHSL(hsl.r,hsl.g,hsl.g)
    })
})

// constants
const SERVICE_ID = 'ffe5'
const CHARACTERISTIC_ID = 'ffe9'

var bulbs = []


// RAINBOW SETTINGS 
// if the rainbow is running
let rainbowRunning: boolean = false
// how often each bulb is updated
let intervalMS: number = 50
// lightness and saturation
let defaultLightness: number = 0.08
let defaultSaturation: number = 1
// how far colors are apart
let hueDistance: number = 0.2
// how quickly a buld moves along hue
let hueChangeStep: number = 0.02



/**
 * Represents a lightbulb
 */
class Bulb {

    id: string = 'not set'
    busy: boolean = false

    red: number
    green: number
    blue: number

    hue: number
    sat: number
    light: number

    hex: string

    writeAttemptCount: number = 0
    writeSuccessCount: number = 0
    writeErrorCount: number = 0
    characteristic: any

    constructor(characteristic, id) {
        this.characteristic = characteristic
        this.id = id
    }

    setHSL(hue: number, sat: number, light: number):void {
        let rgb = hslToRgb(hue, sat, light)
        let color = new Buffer([0x56, rgb[0], rgb[1], rgb[2], 0x00, 0xf0, 0xaa])
        
        this.busy = true
        this.characteristic.write(color, true, (error) => {
            if (error) {
                console.error(error)
                this.writeErrorCount += 1
            } else {
                this.hue = hue, this.sat = sat, this.light = light
                this.writeSuccessCount += 1
                this.busy = false
            }
        })
    }
}

/**
 * Upon descovery a device, find its characteristic
 * make a bulb instance and add it to our array of bulbs
 */

noble.on('discover', (peripheral) => {
    // bulb
    peripheral.connect((error) => {
        console.log('device connected')
        // find services
        peripheral.discoverServices([SERVICE_ID], (error, services) => {
            if (services.length === 0) {
                console.log('no services were returned')
                return
            }
            let service = services[0]
            service.discoverCharacteristics([CHARACTERISTIC_ID], (error, characteristics) => {
                if (characteristics.length > 0) {
                    let bulb = new Bulb(characteristics[0], peripheral.id)
                    bulbs.push(bulb)
                    console.log('bulb instantiated')
                }
            })
        })
    })
})

// RAINBOW CONTROL //

/**
 * Called at interval: Increases the hue value for each bulb 
 * according to hueChangeStep setting.
 */
function rainbowStep(): void {
    bulbs.forEach((bulb:Bulb) => {
        let currentHue = bulb.hue
        let newHue = (bulb.hue += hueChangeStep) % 1
        bulb.setHSL(newHue, defaultSaturation, defaultLightness)
    })
}

/**
 * Starts the rainbow animation
 */
function startRainbow(): void {
    rainbowRunning = true
    runRainbow()
}

/**
 * Recursive loop to rainbow animate the bulbs.
 */
function runRainbow(): void {
    if (!rainbowRunning) { return }
    rainbowStep()
    setTimeout(() => runRainbow(), intervalMS)
}

/**
 * Stops the rainbox animation
 */
function stopRainbow(): void {
    rainbowRunning = false
}

/**
 * Sets the colors for our bulbs with hue distance
 * as specified in the hueDistance setting,
 * and lightness/saturation by their global settings
 */
function rainbowSetup(): void {
    let currentHue = 0
    bulbs.forEach((bulb: Bulb) => {
        bulb.setHSL(currentHue, defaultSaturation, defaultLightness)
        currentHue += hueDistance
    })
}

/**
 * Reset errors metrics to zero for all bulb
 */
function resetErrors(): void {
    bulbs.forEach((bulb) => {
        bulb.writeErrorCount = 0
        bulb.writeSuccessCount = 0
        bulb.writeAttemptCount = 0
    })
}





// COLOR UTILITY FUNCTIONS

function lightenDarkenColor(col, amt) {

    var usePound = false;

    if (col[0] == "#") {
        col = col.slice(1);
        usePound = true;
    }

    var num = parseInt(col, 16);

    var r = (num >> 16) + amt;

    if (r > 255) r = 255;
    else if (r < 0) r = 0;

    var b = ((num >> 8) & 0x00FF) + amt;

    if (b > 255) b = 255;
    else if (b < 0) b = 0;

    var g = (num & 0x0000FF) + amt;

    if (g > 255) g = 255;
    else if (g < 0) g = 0;

    return (usePound ? "#" : "") + (g | (b << 8) | (r << 16)).toString(16);

}

/**
 * Converts rbg numbers to a hex string
 * Assumes that r, b, and b are between 0 and 255
 * Return a hex value like #FFDD03
 * 
 * @param  {number} r  The red
 * @param  {number} g  The green
 * @param  {number} b  The blue
 * @return {string}    The hexadecimal representation
 */
function rgbToHex(r: number, g: number, b: number): string {
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b)
}

// helper function
function componentToHex(c: number): string {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}

/**
 * Converts an HSL color value to RGB. Conversion formula
 * Assumes h, s, and l are contained in the set [0, 1] and
 * returns r, g, and b in the set [0, 255].
 *
 * @param   {number}  h       The hue
 * @param   {number}  s       The saturation
 * @param   {number}  l       The lightness
 * @return  {Array}           The RGB representation
 */
function hslToRgb(h, s, l) {
    var r, g, b;

    if (s == 0) {
        r = g = b = l; // achromatic
    } else {
        var hue2rgb = function hue2rgb(p, q, t) {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        }

        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * Converts an RGB color value to HSL. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes r, g, and b are contained in the set [0, 255] and
 * returns h, s, and l in the set [0, 1].
 *
 * @param   {number}  r       The red color value
 * @param   {number}  g       The green color value
 * @param   {number}  b       The blue color value
 * @return  {Array}           The HSL representation
 */
function rgbToHsl(r, g, b) {
    r /= 255, g /= 255, b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;

    if (max == min) {
        h = s = 0; // achromatic
    } else {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [h, s, l];
}

/**
 * Converts hex string to rgb object with r, g, and b as properties
 * 
 * @param {string} hex   The hex string you wish to convert
 */
function hexToRgb(hex: string) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}