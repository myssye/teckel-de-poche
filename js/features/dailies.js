// =====================================================================
// MISSIONS QUOTIDIENNES : DAILY_COUNT defis tires dans DAILY_POOL, renouveles a minuit
// (heure locale). Progression via les evenements du bus ; recompense a recuperer a la main,
// bonus quand tous sont recuperes. Affichage : #dailyList dans le tiroir des missions.
// =====================================================================
(function(){
  "use strict";
  var D = TDP.data, U = TDP.util, BUS = TDP.bus;
  function api(){ return TDP.api; }
  function S(){ return TDP.api.state; }

  function def(id){ return D.DAILY_POOL.filter(function(d){ return d.id === id; })[0]; }

  function roll(){
    var pool = D.DAILY_POOL.slice(), list = [];
    while(list.length < D.DAILY_COUNT && pool.length){
      var d = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      list.push({ id:d.id, progress:0, claimed:false });
    }
    S().dailies = { day:U.dayKey(), list:list, bonusClaimed:false };
  }
  function ensureToday(){
    if(S().dailies.day !== U.dayKey()){ roll(); api().save(); api().render(); }
  }

  function progress(eventName){
    var changed = false;
    S().dailies.list.forEach(function(q){
      var d = def(q.id);
      if(d && d.event === eventName && q.progress < d.target){
        q.progress++; changed = true;
        if(q.progress === d.target) api().toast(api().txt("Défi du jour réussi : " + d.text), 3000);
      }
    });
    if(changed){ api().save(); api().render(); }
  }

  function claim(i){
    var s = S(), q = s.dailies.list[i], d = q && def(q.id);
    if(!d || q.claimed || q.progress < d.target) return;
    q.claimed = true;
    s.coins += d.reward;
    var msg = "+" + d.reward + " pièces";
    if(!s.dailies.bonusClaimed && s.dailies.list.every(function(x){ return x.claimed; })){
      s.dailies.bonusClaimed = true;
      s.coins += D.DAILY_BONUS;
      msg += " · bonus des 3 défis : +" + D.DAILY_BONUS;
    }
    api().toast(msg);
    api().save(); api().render();
  }

  function render(){
    var box = document.getElementById("dailyList");
    if(!box || !S()) return;
    var claimable = false, html = "";
    S().dailies.list.forEach(function(q, i){
      var d = def(q.id); if(!d) return;
      var done = q.progress >= d.target;
      if(done && !q.claimed) claimable = true;
      var btn = q.claimed ? '<button class="mission-btn" disabled>Reçu</button>'
              : done ? '<button class="mission-btn daily-claim" data-claim="' + i + '">+' + d.reward + '</button>'
              : '<span class="daily-count">' + q.progress + '/' + d.target + '</span>';
      html += '<div class="mission-card daily' + (q.claimed ? " claimed" : "") + '">' +
        '<div class="mission-body"><div class="mission-title">' + api().txt(d.text) + '</div>' +
        '<div class="daily-bar"><div style="width:' + Math.round(100 * Math.min(q.progress, d.target) / d.target) + '%"></div></div></div>' +
        btn + '</div>';
    });
    box.innerHTML = html;
    var bonus = document.getElementById("dailyBonus");
    if(bonus) bonus.textContent = S().dailies.bonusClaimed ? "Bonus du jour reçu" : "Les 3 défis : +" + D.DAILY_BONUS + " pièces bonus";
    if(claimable) api().el.missionDot.hidden = false;
  }

  BUS.on("start", function(){
    ensureToday();
    document.getElementById("dailyList").addEventListener("click", function(e){
      var b = e.target.closest("[data-claim]");
      if(b) claim(+b.getAttribute("data-claim"));
    });
  });
  BUS.on("tick", ensureToday);        // minuit pendant qu'on joue
  BUS.on("render", render);
  // un seul abonnement par evenement, meme si plusieurs defis l'ecoutent
  var events = {};
  D.DAILY_POOL.forEach(function(d){ events[d.event] = true; });
  Object.keys(events).forEach(function(ev){ BUS.on(ev, function(){ progress(ev); }); });
})();
