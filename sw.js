// =====================================================================
// Service worker (PWA) : le jeu fonctionne hors ligne.
// Strategie "reseau d'abord" : en ligne on recoit toujours la derniere version, hors ligne on
// sert la copie en cache. A CHAQUE MISE A JOUR des fichiers : incrementer CACHE_VERSION.
// =====================================================================
var CACHE_VERSION = "tdp-v4.0.0";
var CORE = [
  "./", "index.html", "manifest.webmanifest", "css/game.css",
  "js/data.js", "js/save.js", "js/game.js", "js/features/complicite.js", "js/features/dailies.js",
  "js/ui/plus.js", "js/main.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-180.png"
];
var ROOMS = ["cuisine", "chambre", "salon", "sdb"];
ROOMS.forEach(function(r){ CORE.push("assets/rooms/" + r + "_jour.jpg", "assets/rooms/" + r + "_nuit.jpg"); });
var SPRITES = {
  neutre: ["debout", "assis", "allonge", "endormi", "marche", "joyeux", "triste", "etonne"],
  mariniere: ["debout", "assis", "allonge", "endormi", "marche", "triste", "etonne"],
  pull_rose: ["assis", "allonge", "endormi", "marche", "joyeux"]
};
Object.keys(SPRITES).forEach(function(o){ SPRITES[o].forEach(function(p){ CORE.push("assets/" + o + "_" + p + ".png"); }); });
CORE.push("assets/dog_bain.png");

self.addEventListener("install", function(e){
  e.waitUntil(caches.open(CACHE_VERSION).then(function(c){ return c.addAll(CORE); }).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k !== CACHE_VERSION; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener("fetch", function(e){
  if(e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).then(function(res){
      // on garde une copie (y compris les polices Google) pour le hors ligne
      if(res && (res.ok || res.type === "opaque")){
        var copy = res.clone();
        caches.open(CACHE_VERSION).then(function(c){ c.put(e.request, copy); });
      }
      return res;
    }).catch(function(){
      return caches.match(e.request, { ignoreSearch:true }).then(function(hit){
        return hit || (e.request.mode === "navigate" ? caches.match("index.html") : Response.error());
      });
    })
  );
});
