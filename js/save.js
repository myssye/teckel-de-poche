// =====================================================================
// Teckel de Poche - SAUVEGARDE (versionnee) + petits utilitaires partages
// Cle localStorage : teckel_state_v4. L'ancienne cle v3 est lue une fois, migree, et
// gardee intacte en secours (teckel_state_v3). Toute evolution du format => nouvelle
// migration dans MIGRATIONS + SAVE_VERSION + 1 (ne jamais casser une ancienne partie).
// =====================================================================
(function(){
  "use strict";
  var D = TDP.data;
  var SAVE_KEY = "teckel_state_v4", OLD_KEY = "teckel_state_v3";
  var SAVE_VERSION = 4;

  function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }
  function pad(n){ return (n < 10 ? "0" : "") + n; }
  // jour local, ex. "2026-09-27" (sert au coffre, aux quotidiennes, a la complicite)
  function dayKey(d){ d = d || new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  // nombre de jours calendaires entre deux cles de jour
  function daysBetween(a, b){
    if(!a || !b) return 0;
    var pa = a.split("-"), pb = b.split("-");
    var da = new Date(+pa[0], +pa[1] - 1, +pa[2]), db = new Date(+pb[0], +pb[1] - 1, +pb[2]);
    return Math.round((db - da) / 86400000);
  }

  function defaultState(){
    var traits = {};
    Object.keys(D.TRAITS).forEach(function(k){ traits[k] = 0; });
    return {
      version: SAVE_VERSION,
      coins: D.START_COINS,
      sagesse: 100,
      needs: { faim:80, sommeil:80, jeu:80, proprete:80 },
      outfit: "neutre",
      owned: { outfits: ["neutre", "mariniere", "pull_rose"] },
      lastTick: Date.now(),
      lastCoffreDay: null,
      repairMissionActive: false,
      dogName: "Saucisse",
      room: "cuisine",
      timeOfDay: "jour",
      complicite: { level:1, xp:0 },
      hugs: { day:null, count:0 },
      lastPlayDay: null,
      daysPlayed: 0,
      dailies: { day:null, list:[], bonusClaimed:false },
      traits: traits,
      album: []
    };
  }

  // v3 -> v4 : on garde tout ce qui existe, on ajoute les nouveaux champs.
  var MIGRATIONS = {
    3: function(old){
      var s = defaultState();
      ["coins", "sagesse", "outfit", "lastTick", "lastCoffreDay", "repairMissionActive", "dogName", "room", "timeOfDay"]
        .forEach(function(k){ if(old[k] !== undefined) s[k] = old[k]; });
      if(old.needs) Object.assign(s.needs, old.needs);
      // l'ancien format de date du coffre ("2026-9-7") -> nouveau ("2026-09-07")
      if(typeof s.lastCoffreDay === "string"){
        var p = s.lastCoffreDay.split("-");
        if(p.length === 3) s.lastCoffreDay = p[0] + "-" + pad(+p[1]) + "-" + pad(+p[2]);
      }
      s.version = 4;
      return s;
    }
  };

  // complete un etat (valeurs manquantes) sans ecraser l'existant
  function normalize(s){
    var def = defaultState();
    Object.keys(def).forEach(function(k){ if(s[k] === undefined) s[k] = def[k]; });
    s.needs = Object.assign(def.needs, s.needs || {});
    s.traits = Object.assign(def.traits, s.traits || {});
    if(!s.owned || !s.owned.outfits) s.owned = def.owned;
    return s;
  }

  function migrate(s, fromVersion){
    var v = fromVersion;
    while(v < SAVE_VERSION){
      if(!MIGRATIONS[v]) break;
      s = MIGRATIONS[v](s);
      v = s.version;
    }
    return normalize(s);
  }

  function load(){
    try{
      var raw = localStorage.getItem(SAVE_KEY);
      if(raw){
        var s = JSON.parse(raw);
        return migrate(s, s.version || SAVE_VERSION);
      }
      var old = localStorage.getItem(OLD_KEY);
      if(old){
        // premiere ouverture apres la mise a jour : migration, l'ancienne cle reste en secours
        var migrated = migrate(JSON.parse(old), 3);
        localStorage.setItem(SAVE_KEY, JSON.stringify(migrated));
        return migrated;
      }
    }catch(e){}
    return defaultState();
  }
  function save(state){
    try{ localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }catch(e){}
  }

  // ---------- export / import (code de sauvegarde a copier-coller) ----------
  function exportCode(state){
    var json = JSON.stringify(state);
    return "TDP4-" + btoa(unescape(encodeURIComponent(json)));
  }
  // renvoie l'etat importe (migre) ou lance une erreur lisible
  function importCode(code){
    code = String(code || "").trim();
    var m = code.match(/^TDP(\d+)-(.+)$/);
    if(!m) throw new Error("Ce code ne ressemble pas à une sauvegarde de Teckel de Poche.");
    var s;
    try{ s = JSON.parse(decodeURIComponent(escape(atob(m[2])))); }
    catch(e){ throw new Error("Le code est incomplet ou abîmé."); }
    if(!s || typeof s !== "object" || !s.needs) throw new Error("Le code ne contient pas de partie valide.");
    return migrate(s, s.version || +m[1]);
  }

  // ---------- petit bus d'evenements (les systemes s'ecoutent sans se connaitre) ----------
  var handlers = {};
  function on(name, fn){ (handlers[name] = handlers[name] || []).push(fn); }
  function emit(name, payload){
    (handlers[name] || []).forEach(function(fn){ try{ fn(payload); }catch(e){ console.error(e); } });
  }

  TDP.util = { clamp:clamp, dayKey:dayKey, daysBetween:daysBetween,
               pick:function(a){ return a[Math.floor(Math.random() * a.length)]; },
               randInt:function(a, b){ return a + Math.floor(Math.random() * (b - a + 1)); } };
  TDP.save = { load:load, save:save, defaultState:defaultState, exportCode:exportCode, importCode:importCode,
               KEY:SAVE_KEY, VERSION:SAVE_VERSION };
  TDP.bus = { on:on, emit:emit };
})();
