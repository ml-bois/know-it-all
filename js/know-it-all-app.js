
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

    "audio_bsize": 16384,

    // output samplerate
    "out_hz": 16000,

    "prop": 1.0,

    "arc_color":     "rgb(  0,     0, 205)",
    "user_color":    "rgb(  0,   205,   0)",
    "machine_color": "rgb(205,     0,   0)",
    "inactive_color":"rgb(70, 70, 70)"
}

// backend information
var BACKEND_IP = "35.203.146.203";
var BACKEND_PORT = "7878";

var started_recording = new Date();

var mem = {
    "recording": false,
    "waiting_response": false,
    "playing_response": false
};

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

    "silence_detector": undefined,

    "recorder": undefined,
    "recorded_chunks": [],

    // can be undefined at runtime if there's not a chunk of audio!
    "response_audio": undefined,
    "response_MES": undefined

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


function drawLine(p0, p1, thickness, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;

    ctx.beginPath();
    //start
    ctx.moveTo(p0[0], p0[1]);
    //end
    ctx.lineTo(p1[0], p1[1]);
    ctx.stroke();
}

// calculates line from bar
function calcBar(center, idx, start_rad, end_rad, val) {
    var rads = 2 * Math.PI * (0.25 + idx / params["bars"]);

    var cosr = Math.cos(rads), sinr = Math.sin(rads);

    val = transformVal(val);

    // difference
    var d_rad = start_rad + (end_rad - start_rad) * val;

    return [
        [center[0]+start_rad*cosr, center[1]+start_rad*sinr], 
        [center[0]+d_rad*cosr, center[1]+d_rad*sinr]
    ];
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

    drawLine(
        [center[0]+start_rad*cosr, center[1]+start_rad*sinr], 
        [center[0]+d_rad*cosr, center[1]+d_rad*sinr], 
        2, line_color
    );

    /*
    ctx.strokeStyle = line_color;
    ctx.lineWidth = 2;

    ctx.beginPath();
    //start
    ctx.moveTo(center[0] + start_rad * cosr, center[1] + start_rad * sinr);
    //end
    ctx.lineTo(center[0] + d_rad * cosr,   center[1] +  d_rad * sinr  );
    ctx.stroke();

    */
}


// draws a single frame
function drawFrame() {
    // sets us up for the next frame
    requestAnimationFrame(drawFrame);

    //console.log(audio_objs["silence_detector"].is_loud);

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

    user_bars = []
    machine_bars = []

    var offset = 8;

    // draw radial frequency bars
    for (var i = offset; i < params["bars"] + offset; ++i) {
        // draw user
        //drawBar([c_x, c_y], i, radii["main"], radii["user"], freq_data["user"][i] / 255.0, params["user_color"]);
        user_bars.push(calcBar([c_x, c_y], i - offset, radii["main"], radii["user"], (0.5 + 0.5 * params["prop"]) * freq_data["user"][i] / 255.0));

        // draw machine
        //drawBar([c_x, c_y], i, radii["main"], radii["machine"], freq_data["machine"][i] / 255.0, params["machine_color"]);
        machine_bars.push(calcBar([c_x, c_y], i - offset, radii["main"], radii["machine"], freq_data["machine"][i] / 255.0));

    }

    var is_act = !mem["playing_response"] && !mem["waiting_response"];

    for (var i = 0; i < params["bars"]; ++i) {
        drawLine(user_bars[i][0], user_bars[i][1], 2, params[is_act ? "user_color" : "inactive_color"]);
        drawLine(machine_bars[i][0], machine_bars[i][1], 2, params["machine_color"]);

        var ni = (i + 1) % params["bars"];

        drawLine(user_bars[i][1], user_bars[ni][1], 1, params["user_color"]);
    }

    // draw the arc/inner circle
    ctx.strokeStyle = params["arc_color"];
    ctx.lineWidth  = 4;

    ctx.beginPath();
    ctx.arc(c_x, c_y, radii["main"], 0, 2 * Math.PI);
    ctx.stroke();
}


function sendNotif(msg, color, dur) {

    $('#maincode').html(msg);
    $('#maincode').css('color', color);
    if (dur < 0) {
        $('#maincode').fadeIn(300);
    } else {
        $('#maincode').fadeIn(300).delay(dur * 1000).fadeOut(1000);
    }
}

window.onload = function () {

    canvas_div = $('#renderer_div');
    canvas = $('#renderer')[0];
    
    var baseurl = $('#__baseurl').attr('class');

  //  $('#maincode').fadeTo(0, 0);

    var bkg_img = new Image();
    //background.src = "/know-it-all/favicon.png";  
    bkg_img.src = baseurl + "/favicon.png";

    bkg_img.onload = function() {
        // only do background once loaded
        params["background"] = bkg_img;
    }

    sendNotif("online", "green", 2.0);

    // global var
    ctx = canvas.getContext('2d');

    var soundAllowed = function (stream_handle) {

        audio_objs["stream_handle"] = stream_handle;

        // required for FireFox support
        window.persistAudioStream = audio_objs["stream_handle"];

        audio_objs["context"] = new (AudioContext || webkitAudioContext)();
        audio_objs["stream_source"] = audio_objs["context"].createMediaStreamSource(audio_objs["stream_handle"]);

        analyzers["user"] = audio_objs["context"].createAnalyser();
        analyzers["user"].fftSize = freq_data["N"];

        analyzers["machine"] = audio_objs["context"].createAnalyser();
        analyzers["machine"].fftSize = freq_data["N"];

        var _ss = audio_objs["stream_source"];
        audio_objs["stream_source"] = audio_objs["context"].createGain();
        _ss.connect(audio_objs["stream_source"]);
        audio_objs["stream_source"].connect(analyzers["user"]);

        audio_objs["stream_source"].gain.setValueAtTime(1, audio_objs["context"].currentTime);

        audio_objs["context"].audioWorklet.addModule(baseurl + '/js/silence-detector.js').then(function() { 
            
            audio_objs["silence_detector"] = new AudioWorkletNode(audio_objs["context"], 'silence-detector', {
                outputChannelCount:[1],
                samples: params["audio_bsize"]
            });
            
            audio_objs["machine_silence_detector"] = new AudioWorkletNode(audio_objs["context"], 'silence-detector', {
                outputChannelCount:[1],
                samples: params["audio_bsize"]
            });

            // this data will tell us whether or not to record or stop
            audio_objs["silence_detector"].port.onmessage = function (e) {
                var goal = (mem["playing_response"] || mem["waiting_response"]) ? 0.0 : 1.0;//e.data["is_loud"] ? 0.0 : 1.0;
                var amt = 0.015;
                params["prop"] = goal * amt + params["prop"] * (1 - amt);
                if (audio_objs["recorder"].state == "inactive") {
                    if (e.data["is_loud"] && !mem["waiting_response"] && !mem["playing_response"]) {
                        audio_objs["recorder"].start();
                    } else {
                        return;
                    }
                } else if (!e.data["is_loud"] && e.data["confidence"] < 0.5) {
                    audio_objs["recorder"].stop();
                } 
            };

            // this data will tell us whether or not to record or stop
            audio_objs["machine_silence_detector"].port.onmessage = function (e) {
                console.log(e.data["confidence"]);
            };

            audio_objs["stream_source"].connect(audio_objs["silence_detector"]);
            audio_objs["silence_detector"].connect(audio_objs["context"].destination);

            audio_objs[""]

            audio_objs["recorder"] = new MediaRecorder(audio_objs["stream_handle"], {
                'audioBitsPerSecond': 128000,
                'sampleRate': 16000,
                'desiredSampleRate': 16000,
                'mimeType': 'audio/webm\;codecs=opus'
            });
    
            // add function for when it is stopped
            audio_objs["recorder"].addEventListener("start", () => {
                audio_objs["recorded_chunks"] = []
                started_recording = new Date();

                console.log("started recording");

                setTimeout(function() {
                    if (audio_objs["recorder"].state != 'inactive') {
                        audio_objs["recorder"].stop();
                    }
                }, 12000);
            });
    
            // add function for when new data comes in
            audio_objs["recorder"].addEventListener("dataavailable", event => {
                audio_objs["recorded_chunks"].push(event.data);
            });
    
            // add function for when it is stopped
            audio_objs["recorder"].addEventListener("stop", () => {
                var time_elapsed = new Date() - started_recording;
                
                console.log("stopped recording");
                // at least 1 second
                if (time_elapsed < 1000) return;

                if (audio_objs["recorded_chunks"].length < 1) return;

                if (audio_objs["recorded_chunks"].length == 1 && audio_objs["recorded_chunks"][0].size < 10000) return;

                const _blob = new Blob(audio_objs["recorded_chunks"]);
                const _audio_url = URL.createObjectURL(_blob);

                //saveAs(_blob, 'out.ogg');

                var reader = new FileReader();
                reader.readAsDataURL(_blob); 

                reader.onloadend = function() {
                    //console.log("decoded...");
                    var base64data = reader.result;                
                    //console.log(base64data);

                    mem["waiting_response"] = true;
                    console.log("send request to backend...");


                    var c_dots = 3;

                    function dop() {
                        c_dots = (c_dots + 1) % 3;
                        if (!mem["waiting_response"]) return;

                        if (c_dots == 0) {
                            sendNotif("Thinking .    ", 'gray', -1.0);
                        } else if (c_dots == 1) {
                            sendNotif("Thinking . .  ", 'gray', -1.0);
                        } else {
                            sendNotif("Thinking . . .", 'gray', -1.0);
                        }

                        setTimeout(dop, 1500);
                    }

                    dop();


                    // REQUEST
                    $.post(
                        "http://" + BACKEND_IP + ":" + BACKEND_PORT + "/data/speech2speech", 
                        base64data, 
                        function(data){
                            //console.log(data);
                            //var decoded_result = data["b64"];   
                            sendNotif("Speaking...", 'green', 6);
                            mem["waiting_response"] = false;
                            console.log("received from backend! now playing response...");


                            var res = "data:audio/ogg;base64," + data;

                            //audio_objs["response_audio"] = new Audio("/example.wav");
                            audio_objs["response_audio"] = new Audio(res);
                            audio_objs["response_audio"].play();

                            mem["playing_response"] = true;

                            audio_objs["response_audio"].onended = function() {
                                console.log("done playing response (was " + audio_objs["response_audio"].duration + "s)");
                                mem["playing_response"] = false;
                            }
                   
                            //media element source
                            audio_objs["response_MES"] = audio_objs["context"].createMediaElementSource(audio_objs["response_audio"]);
                    
                            // connect to analyzer and output
                            audio_objs["response_MES"].connect(analyzers["machine"]);
                            audio_objs["response_MES"].connect(audio_objs["machine_silence_detector"]);
                            audio_objs["response_MES"].connect(audio_objs["context"].destination);
                        }
                    ).fail(function(xhr, status, error) {
                        console.error("While doing backend request: " + xhr["responseText"]);
                        mem["waiting_response"] = false;
                        sendNotif("Error From Backend" + xhr["responseText"] , 'red', 4.0);
                    });
                }
            });
    
            // start recording
            audio_objs["recorder"].start();
    
            // set up frequency bins
            freq_data["user"] = new Uint8Array(analyzers["user"].frequencyBinCount);
            freq_data["machine"] = new Uint8Array(analyzers["machine"].frequencyBinCount);
    
            drawFrame();
        });
    }

    var soundNotAllowed = function (error) {
        console.log(error);
    }

    console.log("on load");

    navigator.mediaDevices.getUserMedia({ audio: true }).then(soundAllowed).catch(soundNotAllowed);
    //navigator.getUserMedia({ audio:true }, soundAllowed, soundNotAllowed);
};

