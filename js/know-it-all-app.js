
/* know-it-all-app.js - Drives the `know-it-all` application via source code.

Handles audio input, vizualization, and interface with our backend in Google Cloud.


@author Cade Brown <cade@cade.site>

*/



// global variables
var canvas, canvas_div, ctx;

// global parameters
var params = {
    "bars": 120,
    "background": undefined,

    "arc_color":     "rgb(  0,     0, 205)",
    "user_color":    "rgb(  0,   205,   0)",
    "machine_color": "rgb(205,     0,   0)"
}


// radii of circles
var radii = {
    // main ring where the user and machine meet
    "main": 0,

    // maximum of the user audio peak (more than main)
    "user": 0,

    // maximum of the inward peak (less than main)
    "machine": 0
};


// audio objects
var audio_objs = {
    "context": undefined,
    "stream_handle": undefined,
    "stream_source": undefined,

    // can be undefined at runtime if there's not a chunk of audio!
    "response_audio": undefined
};

// current recording envelope
var envelope = 0.0;

// audio analyzers
var analyzers = {
    "user": undefined,
    "machine": undefined
};

var freq_data = {
    // size of FFT
    "N": 512,
    "user": undefined,
    "machine": undefined
}



// utility functions
function clamp(v, mi, ma) {
    return v < mi ? mi : (v > ma ? ma : v);
}

// transforms it for "prettier" vizualization
function transformVal (val) {
    return Math.sign(val) * Math.pow(Math.abs(val), 1.2);
}


// draws single bar with a circular center, index (out of params.bars), min radius, to max radius, value (from 0 to 1) and a color
function drawBar(center, idx, start_rad, end_rad, val, line_color) {
    var lineColor = "rgb(0, 0, 205)";
    
    var rads = 2 * Math.PI * (0.25 + idx / params["bars"]);

    var cosr = Math.cos(rads), sinr = Math.sin(rads);

    val = transformVal(val);

    //val = start_rad + (end_rad - start_rad) * transformVal(val);

    // difference
    var d_rad = start_rad + (end_rad - start_rad) * val;

    ctx.strokeStyle = line_color;
    ctx.lineWidth = 2;

    ctx.beginPath();
    //start
    ctx.moveTo(center[0] + start_rad * cosr, center[1] + start_rad * sinr);
    //end
    ctx.lineTo(center[0] + d_rad * cosr,   center[1] +  d_rad * sinr  );
    ctx.stroke();
}


// draws a single frame
function drawFrame() {
    // sets us up for the next frame
    requestAnimationFrame(drawFrame);

    //console.log("drawing frame...");

    analyzers["user"].getByteFrequencyData(freq_data["user"]);
    analyzers["machine"].getByteFrequencyData(freq_data["machine"]);

    // reclalculate full width/height
    canvas.width = canvas_div.innerWidth();
    canvas.height = canvas_div.innerHeight();

    // recalculate radii
    radii["main"] = clamp(.30 * canvas.width, 150, 0.325 * canvas.height);
    radii["user"] = radii["main"] * 1.7;
    radii["machine"] = radii["main"] * 0.5;

    var c_x = canvas.width / 2, c_y = canvas.height / 2;

    // clear then draw
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    var adj_width = 1.75 * radii["main"];

    // only if the background imgae is loaded
    if (params["background"]) {
        // pixelated
        ctx.imageSmoothingEnabled = false;
        ctx.mozImageSmoothingEnabled = false;
        ctx.webkitImageSmoothingEnabled = false;
        ctx.msImageSmoothingEnabled = false;
        ctx.imageSmoothingEnabled = false;

        ctx.drawImage(params["background"], canvas.width / 2 - adj_width / 2, canvas.height / 2- adj_width / 2, adj_width, adj_width);
    }


    // draw radial frequency bars
    for (var i = 0; i < params["bars"]; ++i) {
        // draw user
        drawBar([c_x, c_y], i, radii["main"], radii["user"], freq_data["user"][i] / 255.0, params["user_color"]);

        // draw machine
        drawBar([c_x, c_y], i, radii["main"], radii["machine"], freq_data["machine"][i] / 255.0, params["machine_color"]);
    }


    // draw the arc/inner circle
    ctx.strokeStyle = params["arc_color"];
    ctx.lineWidth  = 4;

    ctx.beginPath();
    ctx.arc(c_x, c_y, radii["main"], 0, 2 * Math.PI);
    ctx.stroke();

}



window.onload = function () {

    canvas_div = $('#renderer_div');
    canvas = $('#renderer')[0];
    
    var bkg_img = new Image();
    //background.src = "/know-it-all/favicon.png";  
    bkg_img.src = $('#__baseurl').attr('class') + "/favicon.png";

    bkg_img.onload = function() {
        // only do background once loaded
        params["background"] = bkg_img;
    }

    // global var
    ctx = canvas.getContext('2d');

    var soundAllowed = function (stream_handle) {

        audio_objs["stream_handle"] = stream_handle;

        // required for FireFox support
        window.persistAudioStream = audio_objs["stream_handle"];

        audio_objs["context"] = new AudioContext();
        audio_objs["stream_source"] = audio_objs["context"].createMediaStreamSource(audio_objs["stream_handle"]);

        analyzers["user"] = audio_objs["context"].createAnalyser();
        analyzers["user"].fftSize = freq_data["N"];

        analyzers["machine"] = audio_objs["context"].createAnalyser();
        analyzers["machine"].fftSize = freq_data["N"];

        audio_objs["stream_source"].connect(analyzers["user"]);

        // set up frequency bins
        freq_data["user"] = new Uint8Array(analyzers["user"].frequencyBinCount);
        freq_data["machine"] = new Uint8Array(analyzers["machine"].frequencyBinCount);

        // for base64 var snd = new Audio("data:audio/wav;base64," + base64string);
        //audio_objs["response_audio"] = new Audio("data:audio/mp3;base64," + base64string);
        audio_objs["response_audio"] = new Audio("/example.wav");
        audio_objs["response_audio"].play();

        //media element source
        audio_objs["respones_MES"] = audio_objs["context"].createMediaElementSource(audio_objs["response_audio"]);

        // connect to analyzer and output
        audio_objs["respones_MES"].connect(analyzers["machine"]);
        audio_objs["respones_MES"].connect(audio_objs["context"].destination);

        drawFrame();
    }

    var soundNotAllowed = function (error) {
        console.log(error);
    }

    console.log("on load");

    navigator.mediaDevices.getUserMedia({ audio:true }).then(soundAllowed).catch(soundNotAllowed);
    //navigator.getUserMedia({ audio:true }, soundAllowed, soundNotAllowed);
};

