'use strict';

!function(){
    var utils = {
        rgb2hsv: function(rgb) {
            var h, s, v;
            var max = Math.max(rgb.r, rgb.g, rgb.b);
            var min = Math.min(rgb.r, rgb.g, rgb.b);
            v = max;
            if (max == 0)
                s = 0;
            else
                s = (max - min) / max;
            switch (max) {
                case min: h = 0; break;
                case rgb.r: h = (rgb.g - rgb.b) / (max - min) * 60.0; break;
                case rgb.g: h = 120.0 + (rgb.b - rgb.r) / (max - min) * 60.0; break;
                case rgb.b: h = 240.0 + (rgb.r - rgb.g) / (max - min) * 60.0; break;
            }
            if (h < 0) h += 360;
            return {h: h, s: s, v: v};
        },
        hsv2rgb: function(hsv) {
            var r, g, b;
            var h;
            if (hsv.s === 0)
                r = g = b = hsv.v;
            else {
                h = hsv.h / 60.0;
                var i = Math.floor(h);
                var f = h - i;
                var _a = hsv.v * (1 - hsv.s);
                var _b = hsv.v * (1 - hsv.s * f);
                var _c = hsv.v * (1 - hsv.s * (1 - f));
                switch (i) {
                    case 0: r = hsv.v, g = _c, b = _a; break;
                    case 1: r = _b, g = hsv.v, b = _a; break;
                    case 2: r = _a, g = hsv.v, b = _c; break;
                    case 3: r = _a, g = _b, b = hsv.v; break;
                    case 4: r = _c, g = _a, b = hsv.v; break;
                    case 5: r = hsv.v, g = _a, b = _b; break;
                }
            }
            return {r: r, g: g, b: b};
        },
        txt2rgb: function(txt) {
            var r = 0, g = 0, b = 0;
            if (/^#[0-9a-f]{3}$/i.test(txt)) {
                r = parseInt(txt.substring(1, 2), 16) / 15.0;
                g = parseInt(txt.substring(2, 3), 16) / 15.0;
                b = parseInt(txt.substring(3, 4), 16) / 15.0;
            } else if (/^#[0-9a-f]{6}$/i.test(txt)) {
                r = parseInt(txt.substring(1, 3), 16) / 255.0;
                g = parseInt(txt.substring(3, 5), 16) / 255.0;
                b = parseInt(txt.substring(5, 7), 16) / 255.0;
            } else if (/rgb\(\d+,\s*\d+,\s*\d+\)/.test(txt)) {
                var rgb = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(txt)
                r = parseInt(rgb[1]) / 255.0;
                g = parseInt(rgb[2]) / 255.0;
                b = parseInt(rgb[3]) / 255.0;
            }
            return {r: r, g: g, b: b};
        },
        rgb2txt: function(rgb) {
            var r = Math.round(rgb.r * 255.0).toString(16);
            if (r.length === 1) r = '0' + r;
            var g = Math.round(rgb.g * 255.0).toString(16);
            if (g.length === 1) g = '0' + g;
            var b = Math.round(rgb.b * 255.0).toString(16);
            if (b.length === 1) b = '0' + b;
            return ('#' + r + g + b).toUpperCase();
        }
    };

    var flags = 0;
    var F_MOUSEDOWN = 1;
    var F_MOUSEDOWN_HUE = 1 << 1;
    var F_RENDER_HUE = 1 << 2;

    var setFlag = function(flag, value) {
        if (value === false)
            flags &= ~flag;
        else
            flags |= flag;
    }

    var getFlag = function(flag) {
        return !!(flags & flag);
    }

    var mainDom = null;
    var elements = {};
    var colorCtx = null;
    var maskCtx = null;

    var value = {h: 0, s: 0, v: 0};

    var cb;

    var renderID = -1;

    var init = function(dom) {

        // 初始化检查
        if (!dom || mainDom)
            return;
        
        // 创建Elements
        mainDom = dom;

        // Elements初始化
        mainDom.classList.add('colorSelector');

        mainDom.addEventListener('mousemove', onMouseMove);
        mainDom.addEventListener('mouseup', onMouseUp);
        mainDom.addEventListener('transitionend', onAnimEnd);

        var background = document.createElement('div'); {
            background.classList.add('bg');
            background.addEventListener('click', onCancel);
        }
        mainDom.appendChild(background);
        elements.background = background;

        var selector = document.createElement('div'); {
            selector.classList.add('selector');

            var colorPanel = document.createElement('canvas'); {
                colorPanel.width = 300;
                colorPanel.height = 300;
                colorCtx = colorPanel.getContext('2d');
                colorPanel.classList.add('colorCircle');

                // Draw Hue Ring
                var size = 300;
                colorCtx.fillStyle = 'black';
                colorCtx.fillRect(0, 0, size, size);
                colorCtx.beginPath();
                colorCtx.strokeStyle = 'white';
                colorCtx.lineWidth = 28;
                colorCtx.arc(size / 2, size / 2, 136, 0, Math.PI * 2);
                colorCtx.stroke();
                colorCtx.closePath();

                // Fill Color
                var imgData = colorCtx.getImageData(0, 0, size, size);
                for (var y = 0; y < size; y++) {
                    for (var x = 0; x < size; x++) {
                        var _y = y / (size - 1) - 0.5;
                        var _x = x / (size - 1) - 0.5;
                        var alpha = getColor(imgData, x, y).r;
                        var rgb = utils.hsv2rgb({h: getHue(Math.atan2(_y, _x)), s: 1, v: 1});
                        rgb.r = (rgb.r - 1) * alpha + 1;
                        rgb.g = (rgb.g - 1) * alpha + 1;
                        rgb.b = (rgb.b - 1) * alpha + 1;
                        setColor(imgData, x, y, rgb);
                    }
                }
                colorCtx.putImageData(imgData, 0, 0);
            }
            selector.appendChild(colorPanel);
            elements.colorPanel = colorPanel;

            var colorMask = document.createElement('canvas'); {
                colorMask.width = 300;
                colorMask.height = 300;
                maskCtx = colorMask.getContext('2d');
                colorMask.classList.add('colorCircle');
                colorMask.classList.add('mask');
                colorMask.addEventListener('contextmenu', function(e) {e.preventDefault();return false;});
                colorMask.addEventListener('mousedown', onMouseDown);
            }
            selector.appendChild(colorMask);
            elements.colorMask = colorMask;

            var previous = document.createElement('div'); {
                previous.classList.add('previous');
                previous.style.backgroundColor = '#000';
            }
            selector.appendChild(previous);
            elements.previous = previous;
            
            var preview = document.createElement('div'); {
                preview.classList.add('preview');
            }
            selector.appendChild(preview);
            elements.preview = preview;

            var colorText = document.createElement('input'); {
                colorText.classList.add('text');
                colorText.maxLength = 7;
                colorText.minLength = 0;
                colorText.addEventListener('input', onInput);
                colorText.spellcheck = false;
            }
            selector.appendChild(colorText);
            elements.colorText = colorText;

            var btnOK = document.createElement('input'); {
                btnOK.classList.add('btn');
                btnOK.classList.add('OK');
                btnOK.type = 'button';
                btnOK.value = '确认';
                btnOK.addEventListener('click', onOK);
            }
            selector.appendChild(btnOK);
            elements.btnOK = btnOK;

            var btnCancel = document.createElement('input'); {
                btnCancel.classList.add('btn');
                btnCancel.classList.add('CANCEL');
                btnCancel.type = 'button';
                btnCancel.value = '取消';
                btnCancel.addEventListener('click', onCancel);
            }
            selector.appendChild(btnCancel);
            elements.btnCancel = btnCancel;
        }
        mainDom.appendChild(selector);
        elements.selector = selector;

        setFlag(F_RENDER_HUE);
        requestRender();
    };

    var setColor = function(imgData, x, y, color) {
        imgData.data[y * imgData.width * 4 + x * 4] = Math.round(color.r * 255);
        imgData.data[y * imgData.width * 4 + x * 4 + 1] = Math.round(color.g * 255);
        imgData.data[y * imgData.width * 4 + x * 4 + 2] = Math.round(color.b * 255);
        imgData.data[y * imgData.width * 4 + x * 4 + 3] = 255;
    }

    var getColor = function(imgData, x, y) {
        return {
            r: imgData.data[y * imgData.width * 4 + x * 4] / 255.0,
            g: imgData.data[y * imgData.width * 4 + x * 4 + 1] / 255.0,
            b: imgData.data[y * imgData.width * 4 + x * 4 + 2] / 255.0
        }
    }

    var getHue = function(atan2) {
        var ang = -1.0 * atan2 / (2 * Math.PI) * 360.0;
        if (ang < 0.0) ang += 360.0;
        ang = 150.0 - ang;
        if (ang < 0.0) ang += 360.0;
        return ang;
    }

    var requestRender = function() {
        if (renderID === -1)
            renderID = requestAnimationFrame(render);
    }

    var render = function() {
        renderID = -1;

        // Redraw S&V Rect
        if (getFlag(F_RENDER_HUE)) {
            var imgData = colorCtx.getImageData(65, 65, 170, 170);
            for (var y = 0; y < 170; y++)
                for (var x = 0; x < 170; x++)
                    setColor(imgData, x, y, utils.hsv2rgb({h: value.h, s: x / 169, v: (169 - y) / 169}));
            colorCtx.putImageData(imgData, 65, 65);
        }

        maskCtx.clearRect(0, 0, 300, 300);

        // Draw Hue Pos
        var hueAng = (150 - value.h) / 360 * 2 * Math.PI;
        var x = 136 * Math.cos(hueAng) + 150;
        var y = -136 * Math.sin(hueAng) + 150;
        var rgb = utils.hsv2rgb({h: value.h, s: 1, v: 1});
        rgb.r = 1 - rgb.r;
        rgb.g = 1 - rgb.g;
        rgb.b = 1 - rgb.b;
        maskCtx.beginPath();
        maskCtx.strokeStyle = utils.rgb2txt(rgb);
        maskCtx.lineWidth = 4;
        maskCtx.arc(x, y, 5, 0, 2 * Math.PI);
        maskCtx.stroke();
        maskCtx.closePath();

        // Draw S&V Pos
        x = 170 * value.s + 65;
        y = 170 * (1 - value.v) + 65;
        rgb = utils.hsv2rgb(value);
        rgb.r = 1 - rgb.r;
        rgb.g = 1 - rgb.g;
        rgb.b = 1 - rgb.b;
        maskCtx.beginPath();
        maskCtx.strokeStyle = utils.rgb2txt(rgb);
        maskCtx.lineWidth = 4;
        maskCtx.arc(x, y, 5, 0, 2 * Math.PI);
        maskCtx.stroke();
        maskCtx.closePath();

        // Update Preview
        var rgbText = utils.rgb2txt(utils.hsv2rgb(value));
        elements.preview.style.backgroundColor = rgbText;
        if (document.activeElement !== elements.colorText)
            elements.colorText.value = rgbText;
    }

    var show = function(color, callback) {
        var text;
        if (typeof(color) === 'string')
            text = utils.rgb2txt(utils.txt2rgb(color));
        else
            text = utils.rgb2txt(color);
        elements.previous.style.backgroundColor = text;
        elements.colorText.value = text;
        value = utils.rgb2hsv(utils.txt2rgb(text));
        cb = callback;
        mainDom.style.display = 'block';
        setTimeout(function() {
            mainDom.style.opacity = 1;
        });
        requestRender();
    }

    var calcPos = function(x, y) {
        return {
            x: x - elements.colorMask.offsetLeft - elements.selector.offsetLeft, 
            y: y - elements.colorMask.offsetTop - elements.selector.offsetTop
        };
    }

    var onSelectColor = function(x, y) {
        if (getFlag(F_MOUSEDOWN_HUE)) {
            x -= 149.5;
            y -= 149.5;
            value.h = getHue(Math.atan2(y, x));
            setFlag(F_RENDER_HUE);
        } else {
            x -= 65;
            y -= 65;
            value.s = Math.min(Math.max(x, 0), 169) / 169;
            value.v = 1 - Math.min(Math.max(y, 0), 169) / 169;
            setFlag(F_RENDER_HUE, false);
        }
        requestRender();
    }

    var onMouseDown = function(e) {
        var pos = calcPos(e.clientX, e.clientY);
        // S&V Rect
        if (pos.x > 64 && pos.x < 235 && pos.y > 64 && pos.y < 235) {
            setFlag(F_MOUSEDOWN);
            setFlag(F_MOUSEDOWN_HUE, false);
        } else {
            // Hue Ring
            var x = pos.x - 149.5;
            var y = pos.y - 149.5;
            if (Math.abs(Math.sqrt(x * x + y * y) - 136) < 14) {
                setFlag(F_MOUSEDOWN);
                setFlag(F_MOUSEDOWN_HUE);
            }
        }
        if (getFlag(F_MOUSEDOWN)) {
            onSelectColor(pos.x, pos.y);
            // e.preventDefault();
        }
    }

    var onMouseMove = function(e){
        if (getFlag(F_MOUSEDOWN)) {
            var pos = calcPos(e.clientX, e.clientY);
            onSelectColor(pos.x, pos.y);
            e.preventDefault();
        }
    }

    var onMouseUp = function(e){
        if (getFlag(F_MOUSEDOWN)) {
            setFlag(F_MOUSEDOWN, false);
            e.preventDefault();
        }
    }

    var onInput = function(){
        if (/^#[0-9a-f]{6}$/i.test(elements.colorText.value) || /^#[0-9a-f]{3}$/i.test(elements.colorText.value)) {
            value = utils.rgb2hsv(utils.txt2rgb(elements.colorText.value));
            setFlag(F_RENDER_HUE);
            requestRender();
        }
    }

    var onOK = function(){
        if (cb instanceof Function)
            cb(utils.hsv2rgb(value));
        mainDom.style.opacity = 0;
    }

    var onCancel = function(){
        if (cb instanceof Function)
            cb(utils.txt2rgb(elements.previous.style.backgroundColor));
        mainDom.style.opacity = 0;
    }

    var onAnimEnd = function() {
        if (mainDom.style.opacity < 1)
            mainDom.style.display = 'none';
    }

    window.colorSelector = {
        color: {h: 0, s: 0, v: 0},
        utils: utils,
        init: init,
        show: show
    }
}();