

var __idx = 0;
var __decay_fac = 0.233;

class SilenceDetector extends AudioWorkletProcessor {
    constructor() {
        super();
        
        this.__data = {
            "is_loud": false,
            "confidence": 0.0
        }
    }

 
    process(inputs, outputs, params) {
        // this method gets automatically called with a buffer of 128 frames
        // audio process goes here
        // if you don't return true, webaudio will stop calling your process 

        //$('#__is_loud').attr('class', true);
        var samples = inputs[0][0];
        var avg = 0.0;
        var interval = 3;
        for (var i = 0; i < samples.length; i += interval) {
            avg += Math.atan(samples[i] * samples[i]);
        }
        avg = avg / (samples.length / interval);

        //console.log(this);
        this.__data["is_loud"] = avg > 0.1;
        this.__data["confidence"] *= Math.pow(__decay_fac, samples.length / 44100.0);
        if (this.__data["is_loud"]) {
            this.__data["confidence"] += 0.9;
        }

        this.port.postMessage(this.__data);

        __idx += 1;
        return true;
    }
}
 
registerProcessor('silence-detector', SilenceDetector)

