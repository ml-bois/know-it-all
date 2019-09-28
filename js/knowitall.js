window.onload = function () {
    "use strict";
    var canvas_div = $('#renderer_div');
    var canvas = $('#renderer')[0];

    var background = new Image();
    background.src = "/know-it-all/favicon.png";
    //background.src = "/favicon.png";

    var bkg_enabled = false;
    var audioCtx;

    var arc_color = "rgb(0, 0, 205)";

    background.onload = function() {
        bkg_enabled = true;
    }

    var ctx = canvas.getContext('2d');
    var bars = 120;
    var r_inner, r_outer;
    var x_c, y_c;

    var transform_val = function (v) {
        return Math.sign(v) * Math.pow(Math.abs(v), 1.2);
    }

    var draw_bar = function(idx, amount) {
        var lineColor = "rgb(" + 0 + ", " + 0 + ", " + 205 + ")";
        
        var rads = 2 * Math.PI * idx / bars + Math.PI / 2;

        var cosr = Math.cos(rads), sinr = Math.sin(rads);
        var scale = transform_val(amount / 255);

        if (idx < bars * 0.12) scale = 0.5 * scale + 0.5 * scale * idx / (bars * 0.12);

        scale = (r_inner + (r_outer - r_inner) * scale);

        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x_c + r_inner * cosr, y_c + r_inner * sinr);
        ctx.lineTo(x_c + scale * cosr, y_c + scale * sinr);
        ctx.stroke();
    }

    var soundAllowed = function (stream) {
        //Audio stops listening in FF without // window.persistAudioStream = stream;
        //https://bugzilla.mozilla.org/show_bug.cgi?id=965483
        //https://support.mozilla.org/en-US/questions/984179
        window.persistAudioStream = stream;

        audioCtx = new AudioContext();
        var audioStream = audioCtx.createMediaStreamSource( stream );
        var analyser = audioCtx.createAnalyser();
        audioStream.connect(analyser);
        analyser.fftSize = 512;

        var frequencyArray = new Uint8Array(analyser.frequencyBinCount);
        //visualizer.setAttribute('viewBox', '0 0 255 255');
      
		//Through the frequencyArray has a length longer than 255, there seems to be no
        //significant data after this point. Not worth visualizing.
        //for (var i = 0 ; i < 255; i++) {
        //    path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        //    path.setAttribute('stroke-dasharray', '4,1');
        //    mask.appendChild(path);
        //}

        var doDraw = function () {
            requestAnimationFrame(doDraw);

            analyser.getByteFrequencyData(frequencyArray);

            canvas.width = canvas_div.innerWidth();
            canvas.height = canvas_div.innerHeight();
        
            r_inner = 160 * canvas.width / 500;
            r_outer = 400 * canvas.width / 500;
        
            x_c = canvas.width / 2, y_c = canvas.height / 2;

            // clear then draw
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            var adj_width = 2 * r_inner;

            if (bkg_enabled) ctx.drawImage(background, canvas.width / 2 - adj_width / 2, canvas.height / 2- adj_width / 2, adj_width, adj_width);


            ctx.strokeStyle = arc_color;

            // inner circle
            ctx.beginPath();
            ctx.arc(x_c, y_c, r_inner, 0, 2*Math.PI);
            ctx.stroke();
            
            for (var i = 0; i < bars; i++) {
                draw_bar(i, frequencyArray[i]);
            }

        }
        doDraw();
    }

    var soundNotAllowed = function (error) {
        h.innerHTML = "You must allow your microphone.";
        console.log(error);
    }

    //navigator.mediaDevices.getUserMedia({audio:true}, soundAllowed, soundNotAllowed);
    navigator.getUserMedia({audio:true}, soundAllowed, soundNotAllowed);

};