// Demarrage : charge en dernier, une fois tous les systemes abonnes au bus.
(function(){
  "use strict";
  TDP.start();
  // PWA : le service worker ne fonctionne qu'en http(s) (pas en ouvrant le fichier directement)
  if("serviceWorker" in navigator && /^https?:$/.test(location.protocol)){
    window.addEventListener("load", function(){
      navigator.serviceWorker.register("sw.js").catch(function(){});
    });
  }
})();
