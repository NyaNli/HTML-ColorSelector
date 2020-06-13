window.addEventListener('load', function(){
    var selector = document.getElementById('selector');
    colorSelector.init(selector);

    var color = document.getElementById('color');
    color.addEventListener('click', function(){
        colorSelector.show(color.style.backgroundColor, callback);
    });

    var callback = function(rgb) {
        color.style.backgroundColor = colorSelector.utils.rgb2txt(rgb);
    }
});