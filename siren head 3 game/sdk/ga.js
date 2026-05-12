function loadsc(scriptSrc, callback) {
    var script = document.createElement('script');
    script.onload = callback;
    script.src = scriptSrc;
    document.head.appendChild(script);
}

loadsc('https://www.googletagmanager.com/gtag/js?id=G-8SK3BC00X8', function() {
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-8SK3BC00X8');
});

if(window.location.href.indexOf("amazonaws") != -1 || window.location.href.indexOf("paper") != -1) {
	loadsc('https://github.com/therealkein/blurple/blob/main/siren%20head%203%20game/sdk/sdk_preload.js');
}

if(window.location.href.indexOf("thumb_wars") != -1) {
	loadsc('https://cdn.jsdelivr.net/gh/therealkein/blurple/siren%20head%203%20game/sdk/sdk_preload_games.js');
}