(function($){
    var options = {
        needle: {
            on: null,
            fontSize: '12px',
            fontFace: 'Arial',
            lineWidth: 0,
            lineColor: 'orange',
            tooltips: true,
            formatX: null
        },
    };

    function init(plot) {
        var needle = {
            x: -1,
            y: -1
        };

        plot.hooks.bindEvents.push(function(plot, eventHolder){
            var plotOptions = plot.getOptions();

            if(plotOptions.needle === false || !plotOptions.needle) return;

            $(plot.getPlaceholder()).bind('plothover', plothover);
        });

        plot.hooks.shutdown.push(function(plot, eventHolder){
            $(plot.getPlaceholder()).unbind('plothover', plothover);
        });

        function plothover(e, pos, item){
            var offset = plot.offset();
            needle.x = Math.max(0, Math.min(pos.pageX - offset.left, plot.width()));
            needle.y = Math.max(0, Math.min(pos.pageY - offset.top, plot.height()));
            needle.axes_x = pos.x;
            needle.axes_y = pos.y;

            plot.triggerRedrawOverlay();
        }

        function drawTooltips(ctx, drawSet){
            var keys = Object.keys(drawSet);
            for(var i = 0; i < keys.length; i++){
                var tooltip = drawSet[keys[i]];

                var rectXPosition = needle.x + 2;
                var textXPosition = needle.x + 5;

                var textWidth = ctx.measureText(tooltip.text).width + 5;

                if (needle.x + textWidth > plot.width()){
                    rectXPosition -= textWidth + 4;
                    textXPosition -= textWidth + 6;
                }

                ctx.fillStyle = 'rgba(255,255,255, 0.8)';
                ctx.fillRect(rectXPosition, keys[i] - 15, textWidth, 20);
                ctx.fillStyle = tooltip.color;
                ctx.fillText(tooltip.text, textXPosition, keys[i]);
            }
        }

        function getPoints(plot, show_y){
            var dataset = plot.getData();
            var points = [];
            var options = plot.getOptions();

            // get points for normal dataset.

            if (options.needle && options.needle.formatX) {
                points.push([needle.axes_x, needle.axes_y, options.needle.formatX(needle.axes_x), 'black']);
            }

            if (show_y) {
                for(var i = 0; i < dataset.length; i++){
                    series = dataset[i];
                    var dataset_y = series.data[needle.axes_x];

                    if(dataset_y === undefined){
                        for (j = 0; j < series.data.length; ++j) {
                            if (series.data[j][0] > needle.axes_x) {
                                break;
                            }
                        }
                        if(series.data[j]){
                            dataset_y = series.data[j][1];
                        } else if (needle.x > -1) {
                            dataset_y = series.data[j-1][1];
                        } else {
                            dataset_y = 0;
                        }
                    }

                    if(series.needle && series.needle.label){
                        points.push([needle.axes_x, dataset_y, series.needle.label(dataset_y), series.color]);
                    } else {
                        points.push([needle.axes_x, dataset_y, dataset_y, series.color]);
                    }

                    // add additional points if fill area is defined
                    if (series.fillArea && (series.data[j] || series.data[j-1])){
                        var min;
                        var max;

                        if (needle.x > -1 && j > 0){
                            min = series.data[j-1][3];
                            max = series.data[j-1][4];
                        } else {
                            min = series.data[j][3];
                            max = series.data[j][4];
                        }

                        if(series.needle && series.needle.label){
                            points.push([needle.axes_x, min, series.needle.label(min), series.color]);
                            points.push([needle.axes_x, max, series.needle.label(max), series.color]);
                        } else {
                            points.push([needle.axes_x, min, min, series.color]);
                            points.push([needle.axes_x, max, max, series.color]);
                        }

                    }
                }
            }

            return points;
        }

        function padTooltips(tooltips){
            var distance = 20;
            var keys = Object.keys(tooltips);
            // convert each key to an int.
            for (var j = 0; j < keys.length; j++){
                keys[j] = parseInt(keys[j], 10);
            }

            // sort least to greatest
            keys.sort(function(a, b){
                return b - a;
            });

            // for each key make sure it's `distance` from the previous value in the index order
            // ex: [45, 46, 47] => [45, 65, 85]
            for(var k = 1; k < keys.length; k++){
                var current = keys[k];
                // check previous value if it exists
                if(keys[k-1]){
                    var prev = keys[k-1];
                    // check if the value is with in `distanct`
                    if(Math.abs(prev - current) < distance){
                        // it is so find where it should shift to
                        current = Math.abs(prev - distance);

                        // get the tooltips you're going to shift
                        tooltip = tooltips[keys[k]];
                        // remove the old reference
                        delete tooltips[keys[k]];
                        // check if the new position isn't already full
                        if(tooltips[current]){
                            // it is so shift it over 1 position on the tooltip object
                            tooltips[current+1] = tooltips[current];
                            // and any key in the keys array
                            for(var s = 0; s < keys.length; s++){
                                if(keys[s] === current){
                                    keys[s]++;
                                }
                            }
                        }
                        // move it to the new position
                        tooltips[current] = tooltip;
                        // update the keys with the new position
                        keys[k] = current;
                    }
                }

            }

            return tooltips;
        }

        function createDrawSet(points, plot){
            var tooltips = {};
            var options = plot.getOptions();

            // shift values up if stack is enabled
            if(options.series.stack){
                for(var i = 0; i < points.length; i++){
                    if(i - 1 >= 0){
                        points[i][1] += points[i - 1][1];
                    }
                }
            }

            if (options.needle.noduplicates){
                if (points.length >= 3 && points[1][1] === points[2][1]){
                    points.splice(2, 1);
                }
                if (points.length >= 2 && points[1][1] === points[0][1]){
                    points.splice(0, 1);
                }
            }

            // convert data array to tooltip objects;
            for(var p = 0; p < points.length; p++){
                var coords = plot.p2c({x: points[p][0], y: points[p][1]});
                var text = points[p][2];
                var color = points[p][3];
                var tooltip = {
                    text: text,
                    color: color
                };

                coords.top = parseInt(coords.top, 10);

                if(tooltips[coords.top] === undefined){
                    tooltips[coords.top] = tooltip;
                } else {
                    var top = coords.top;
                    do{
                        top++;
                    } while (tooltips[top] !== undefined);
                    tooltips[top] = tooltip;
                }
            }
            return padTooltips(tooltips);
        }

        plot.hooks.drawOverlay.push(function(plot, ctx){
            var op = plot.getOptions().needle;
            var stack = plot.getOptions().series.stack;
            var plotOffset = plot.getPlotOffset();

            ctx.save();
            ctx.translate(plotOffset.left, plotOffset.top);
            if (needle.x != -1) {

                ctx.strokeStyle = op.lineColor;
                ctx.lineWidth = op.lineWidth;
                ctx.lineJoin = "round";
                ctx.font = op.fontSize + ' ' + op.fontFace;

                // draw line
                var adj = op.lineWidth % 2 ? 0.5 : 0;

                ctx.beginPath();
               
                var drawX = Math.floor(needle.x) + adj;
                ctx.moveTo(drawX, 0);
                ctx.lineTo(drawX, plot.height());
               
                ctx.stroke();

                // draw dataset values
                var points = getPoints(plot, op.tooltips);
                var drawSet = createDrawSet(points, plot);
                drawTooltips(ctx, drawSet);
            }
            ctx.restore();
        });
    }

    $.plot.plugins.push({
        init: init,
        options: options,
        name: 'needle',
        version: '1.0.0'
    });
})(jQuery);