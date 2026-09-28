// =====================================================================
// COMPLICITE (niveau du lien avec le chien) + PERSONNALITE (traits)
// Gains : calins (limites par jour), premier passage de la journee, mini-jeux (a venir).
// Negligence : chaque jour sans venir retire des points DANS le niveau en cours (on ne perd
// jamais un niveau). Reglages : TDP.data.COMPLICITE / TRAITS / LEVEL_THOUGHTS.
// =====================================================================
(function(){
  "use strict";
  var D = TDP.data, U = TDP.util, BUS = TDP.bus, C = D.COMPLICITE;
  function api(){ return TDP.api; }
  function S(){ return TDP.api.state; }

  function addXp(amount, reason){
    var s = S(), c = s.complicite;
    if(c.level >= C.maxLevel) return;
    c.xp += amount;
    while(c.level < C.maxLevel && c.xp >= C.xpForLevel(c.level)){
      c.xp -= C.xpForLevel(c.level);
      c.level++;
      var coins = C.levelCoins(c.level);
      s.coins += coins;
      var msg = "Complicité niveau " + c.level + " ! +" + coins + " pièces";
      if(c.level % 2 === 0) msg += " · nouvelle pensée débloquée";
      if(c.level % C.outfitEvery === 0) msg += " · tenue surprise (bientôt)";
      api().toast(api().txt(msg), 4200);
      BUS.emit("level", c.level);
    }
    if(c.level >= C.maxLevel) c.xp = 0;
  }

  // changement de jour (appele a chaque tick) : premier passage + negligence
  function onTick(){
    var s = S(), today = U.dayKey();
    if(s.lastPlayDay === today) return;
    var missed = s.lastPlayDay ? U.daysBetween(s.lastPlayDay, today) - 1 : 0;
    if(missed > 0){
      s.complicite.xp = Math.max(0, s.complicite.xp - missed * C.neglectXpPerDay);
      api().toast(api().txt("{nom} t'a attendu" + (missed > 1 ? " " + missed + " jours" : "") + "... il est si content de te revoir !"), 4200);
    }
    s.lastPlayDay = today;
    s.daysPlayed = (s.daysPlayed || 0) + 1;
    addXp(C.firstVisitXp, "visit");
    api().save();
  }

  function onHug(){
    var s = S(), today = U.dayKey();
    if(s.hugs.day !== today){ s.hugs.day = today; s.hugs.count = 0; }
    s.traits.calin = (s.traits.calin || 0) + 1;
    if(s.hugs.count < C.hugsPerDay){
      s.hugs.count++;
      addXp(C.hugXp, "hug");
    }
  }

  // personnalite : chaque evenement nourrit le trait correspondant
  Object.keys(D.TRAITS).forEach(function(key){
    var from = D.TRAITS[key].from;
    if(from === "hug") return; // compte dans onHug
    BUS.on(from, function(){ S().traits[key] = (S().traits[key] || 0) + 1; });
  });

  function dominantTrait(){
    var t = S().traits, best = null, bestV = 2; // il faut au moins 3 actions pour qu'un trait ressorte
    Object.keys(t).forEach(function(k){ if(t[k] > bestV){ best = k; bestV = t[k]; } });
    return best;
  }

  BUS.on("tick", onTick);
  BUS.on("hug", onHug);
  BUS.on("start", function(){
    // bulles en plus quand tout va bien : pensees debloquees par niveau + trait dominant
    api().addThoughts(function(){
      var lvl = S().complicite.level, out = D.LEVEL_THOUGHTS.slice(0, Math.floor(lvl / 2));
      var tr = dominantTrait();
      if(tr) out = out.concat(D.TRAITS[tr].thoughts);
      return out;
    });
  });

  TDP.complicite = {
    addXp: addXp,               // pour les futurs mini-jeux
    dominantTrait: dominantTrait,
    xpNeeded: function(){ return C.xpForLevel(S().complicite.level); }
  };
})();
