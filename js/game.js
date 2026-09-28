// =====================================================================
// Teckel de Poche - MOTEUR (piece, chien, missions, boucle de jeu)
// Les donnees/reglages sont dans js/data.js, la sauvegarde dans js/save.js.
// Les systemes (complicite, quotidiennes, menu Plus...) se branchent via TDP.api / TDP.bus.
// =====================================================================
(function(){
  "use strict";
  var D = TDP.data, U = TDP.util, BUS = TDP.bus;
  var ASSETS = D.ASSETS, OUTFIT_LABEL = D.OUTFIT_LABEL, ROOMS = D.ROOMS;
  var ROOM_KEY_FOR_NEED = D.ROOM_KEY_FOR_NEED, ROOM_IMG_KEY = D.ROOM_IMG_KEY;
  var FURNITURE_Y = D.FURNITURE_Y, INTERACTIONS = D.INTERACTIONS;
  var THOUGHTS = D.THOUGHTS, MISSION_DEFS = D.MISSION_DEFS, MISDEEDS = D.MISDEEDS;
  var SUN_PATH = D.SUN_PATH, MOON_PATH = D.MOON_PATH;
  var clamp = U.clamp, pick = U.pick;

  function assetSrc(outfit, pose){
    var poses = ASSETS[outfit] || ASSETS.neutre;
    var p = poses[pose] ? pose : "assis";
    return "assets/" + outfit + "_" + p + ".png";
  }
  // remplace {nom} par le nom du chien dans les textes
  function txt(s){ return String(s).replace(/\{nom\}/g, state.dogName || "Saucisse"); }

  function roomBgSrc(roomKey, timeOfDay){
    var imgKey = ROOM_IMG_KEY[roomKey] || roomKey;
    return "assets/rooms/" + imgKey + "_" + (timeOfDay === "nuit" ? "nuit" : "jour") + ".jpg";
  }
  function roomFloorY(room){
    var fy = room.floorY;
    if(fy && typeof fy === "object") return (state.timeOfDay === "nuit" ? fy.nuit : fy.jour);
    return fy;
  }
  // ================= ECHELLE (regle de perspective, voir CLAUDE.md) =================
  // scale = (depthY - HORIZON_Y) / (REF_Y - HORIZON_Y) ; depthY = contact avec le SOL.
  function scaleAt(depthY){ return clamp((depthY - D.HORIZON_Y) / (D.REF_Y - D.HORIZON_Y), 0.3, 1.4); }
  function furnitureY(name){ return FURNITURE_Y[name] || null; }

  var state = null;
  function saveState(){ TDP.save.save(state); }
  function todayKey(){ return U.dayKey(); }

  var posX = 45;
  var facing = 1;
  var walkDir = 0;
  var lastFrame = null;
  var currentAnimPose = "assis";
  var autoSeq = null;

  var el = {
    dogSprite: document.getElementById("dogSprite"),
    dogImg: document.getElementById("dogImg"),
    thought: document.getElementById("thoughtBubble"),
    coinCount: document.getElementById("coinCount"),
    fillSagesse: document.getElementById("fillSagesse"),
    fillFaim: document.getElementById("fillFaim"),
    fillSommeil: document.getElementById("fillSommeil"),
    fillJeu: document.getElementById("fillJeu"),
    fillProprete: document.getElementById("fillProprete"),
    missionList: document.getElementById("missionList"),
    missionDot: document.getElementById("missionDot"),
    coffreDot: document.getElementById("coffreDot"),
    outfitGrid: document.getElementById("outfitGrid"),
    dressingImg: document.getElementById("dressingImg"),
    coffreBtn: document.getElementById("coffreBtn"),
    coffreNote: document.getElementById("coffreNote"),
    rewardFlash: document.getElementById("rewardFlash"),
    toast: document.getElementById("toast"),
    hintToast: document.getElementById("hintToast"),
    topbar: document.getElementById("topbar"),
    roomFrame: document.getElementById("roomFrame"),
    roomBg: document.getElementById("roomBg"),
    roomShade: document.getElementById("roomShade"),
    roomLabel: document.getElementById("roomLabel"),
    roomSwitcher: document.getElementById("roomSwitcher"),
    daynightBtn: document.getElementById("daynightBtn"),
    daynightIcon: document.getElementById("daynightIcon"),
    zoneLeft: document.getElementById("zoneLeft"),
    zoneRight: document.getElementById("zoneRight"),
    bathDog: document.getElementById("bathDog"),
    hotspots: document.getElementById("hotspots"),
    missionsDrawer: document.getElementById("missionsDrawer"),
    missionsBackdrop: document.getElementById("missionsBackdrop"),
    missionsCloseBtn: document.getElementById("missionsCloseBtn")
  };

  function syncTopbarHeight(){
    try{
      // bas de la barre (elle flotte avec une marge) mesure depuis le haut du cadre
      var h = el.topbar.offsetTop + el.topbar.getBoundingClientRect().height;
      if(h > 0) document.documentElement.style.setProperty("--topbar-h", h + "px");
    }catch(e){}
  }


  function moodKey(){
    var n = state.needs;
    if(state.sagesse < 30) return "sagesse";
    var lowest = Math.min(n.faim,n.sommeil,n.jeu,n.proprete);
    if(lowest < 25){
      if(n.faim===lowest) return "faim";
      if(n.sommeil===lowest) return "sommeil";
      if(n.jeu===lowest) return "jeu";
      return "proprete";
    }
    var avg=(n.faim+n.sommeil+n.jeu+n.proprete)/4;
    if(avg>75) return "happy";
    return "neutral";
  }
  var thoughtProviders = [];
  // pose au repos : triste si un besoin est tres bas (regle 3.3)
  function idlePose(){
    var low = D.NEED_KEYS.some(function(k){ return state.needs[k] < D.LOW_NEED; });
    return low ? D.LOW_NEED_POSE : "assis";
  }
  var lastThoughtAt = 0;
  function refreshThought(force){
    var now = Date.now();
    if(!force && now-lastThoughtAt < 4000) return;
    lastThoughtAt = now;
    var mood = moodKey(), pool = THOUGHTS[mood] || THOUGHTS.neutral;
    // quand tout va bien, les systemes (complicite, personnalite) peuvent proposer d'autres bulles
    if((mood === "happy" || mood === "neutral") && Math.random() < 0.4){
      var extra = [];
      thoughtProviders.forEach(function(fn){ try{ extra = extra.concat(fn() || []); }catch(e){} });
      if(extra.length) pool = extra;
    }
    el.thought.textContent = txt(pick(pool));
  }

  function currentRoom(){ return ROOMS[state.room]; }

  // floorOverride : quand le chien est pose sur un meuble (canape, lit, gamelle), {seat, depth}
  // remplace le sol de la piece. null = il est par terre.
  var floorOverride = null;
  // largeur du chien en % du cadre a la profondeur REF_Y (hauteur deduite par aspect-ratio 500/281)
  var DOG_W = 48;
  var SPRITE_AR = 281 / 500;
  // vide transparent SOUS les pattes, en fraction de la hauteur du PNG (mesure sur les sprites) :
  // compense pour que les pattes touchent vraiment la ligne de sol / l'assise.
  var POSE_FOOT = { debout:0.037, assis:0.025, allonge:0.036, endormi:0.142, marche:0.064,
                    joyeux:0.02, triste:0, etonne:0.012 };
  // vide transparent sur les COTES (min de tous les sprites, 74px/500) : sert a la marge de securite.
  var SPRITE_INSET = 0.148;
  // "fond perdu" : le chien visible reste toujours a au moins BLEED_PX du bord du cadre.
  var BLEED_PX = 3;
  var dogW = DOG_W;
  function dogPlace(){
    if(floorOverride) return floorOverride;
    var fy = roomFloorY(currentRoom());
    return { seat:fy, depth:fy };
  }
  // bornes de posX (en %) pour que le chien reste dans le cadre, avec la marge BLEED_PX
  function clampX(x){
    var W = el.roomBg.clientWidth;
    if(!W) return x;
    var half = dogW * (0.5 - SPRITE_INSET) + BLEED_PX / W * 100;
    return clamp(x, half, 100 - half);
  }
  function updateSpritePosition(){
    var place = dogPlace();
    dogW = DOG_W * scaleAt(place.depth);
    posX = clampX(posX);
    // ancrage par les PATTES : le bas du sprite est cale sur la ligne d'assise (seat), en % depuis
    // le haut, moins le vide transparent de la pose (converti en % de la hauteur du cadre).
    var W = el.roomBg.clientWidth, H = el.roomBg.clientHeight;
    var hPct = (W && H) ? dogW * SPRITE_AR * W / H : 0;
    var foot = (POSE_FOOT[currentAnimPose] || 0) * hPct;
    el.dogSprite.style.left = posX + "%";
    el.dogSprite.style.width = dogW + "%";
    el.dogSprite.style.bottom = (100 - place.seat - foot) + "%";
    el.dogSprite.style.top = "auto";
    el.dogSprite.classList.toggle("face-left", facing < 0);
    el.thought.style.left = posX + "%";
    el.thought.style.bottom = (100 - place.seat + hPct) + "%";
    el.thought.style.top = "auto";
    // camera : le decor coulisse horizontalement pour suivre le chien et reveler les bords caches
    el.roomBg.style.objectPosition = clamp(posX, 0, 100) + "% 30%";
    positionHotspots();
  }

  function setPose(pose){
    if(pose === currentAnimPose) return;
    currentAnimPose = pose;
    el.dogImg.src = assetSrc(state.outfit, pose);
  }

  function renderRoomChrome(){
    var room = currentRoom();
    el.roomLabel.textContent = room.label;
    document.querySelectorAll(".room-tab").forEach(function(b){
      b.classList.toggle("active", b.getAttribute("data-room") === state.room);
    });
    el.daynightIcon.innerHTML = state.timeOfDay === "nuit" ? MOON_PATH : SUN_PATH;
  }

  function switchRoom(roomKey, keepPos){
    if(!ROOMS[roomKey]) return;
    state.room = roomKey;
    if(!keepPos) posX = 45;
    el.roomBg.classList.add("fading");
    setTimeout(function(){
      el.roomBg.src = roomBgSrc(state.room, state.timeOfDay);
      renderRoomChrome();
      renderHotspots();
      updateSpritePosition();
      setTimeout(function(){ el.roomBg.classList.remove("fading"); }, 20);
    }, 150);
    saveState();
  }
  // jour / nuit selon l'heure reelle du telephone (nuit de NIGHT_FROM_HOUR a NIGHT_TO_HOUR).
  // Pour tester : ajouter ?nuit ou ?jour a l'adresse de la page.
  function currentTimeOfDay(){
    var q = location.search;
    if(/[?&]nuit\b/.test(q)) return "nuit";
    if(/[?&]jour\b/.test(q)) return "jour";
    var h = new Date().getHours();
    return (h >= D.NIGHT_FROM_HOUR || h < D.NIGHT_TO_HOUR) ? "nuit" : "jour";
  }
  function applyTimeOfDay(){
    var t = currentTimeOfDay();
    if(t === state.timeOfDay) return;
    state.timeOfDay = t;
    el.roomBg.classList.add("fading");
    setTimeout(function(){
      el.roomBg.src = roomBgSrc(state.room, state.timeOfDay);
      renderRoomChrome();
      updateSpritePosition();
      setTimeout(function(){ el.roomBg.classList.remove("fading"); }, 20);
    }, 150);
    saveState();
  }

  function render(){
    el.coinCount.textContent = state.coins;
    el.fillSagesse.style.width = state.sagesse + "%";
    el.fillSagesse.style.background = state.sagesse < 30 ? "var(--danger)" : (state.sagesse < 60 ? "var(--amber)" : "var(--mint)");
    el.fillFaim.style.width = state.needs.faim + "%";
    el.fillSommeil.style.width = state.needs.sommeil + "%";
    el.fillJeu.style.width = state.needs.jeu + "%";
    el.fillProprete.style.width = state.needs.proprete + "%";

    if(currentAnimPose !== "marche" && !autoSeq){
      el.dogImg.src = assetSrc(state.outfit, currentAnimPose);
    }

    renderMissions();
    renderDressing();

    el.missionDot.hidden = countUrgentMissions() === 0;
    var canOpenCoffre = state.lastCoffreDay !== todayKey();
    el.coffreDot.hidden = !canOpenCoffre;
    el.coffreBtn.disabled = !canOpenCoffre;
    el.coffreBtn.textContent = canOpenCoffre ? "Ouvrir le coffre" : "Déjà ouvert aujourd'hui";
    el.coffreNote.textContent = canOpenCoffre ? "Reviens chaque jour pour une récompense surprise." : "Reviens demain pour la prochaine surprise\u00a0!";
    BUS.emit("render");
  }

  function countUrgentMissions(){
    var c=0;
    ["faim","sommeil","jeu","proprete"].forEach(function(k){ if(state.needs[k]<45) c++; });
    if(state.repairMissionActive) c++;
    return c;
  }

  function renderMissions(){
    var html = "", any=false;
    if(state.repairMissionActive){
      any=true;
      html += '<div class="mission-card urgent">'+
        '<div class="mission-icon" style="background:var(--mint-soft);color:var(--mint);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8c0 5-6 9-6 9s-6-4-6-9a4 4 0 0 1 6-3.5A4 4 0 0 1 18 8Z"/></svg></div>'+
        '<div class="mission-body"><div class="mission-title">Réparer une bêtise</div><div class="mission-sub">Rassure-le pour retrouver sa sagesse</div></div>'+
        '<button class="mission-btn repair" data-repair="1">Câliner</button></div>';
    }
    MISSION_DEFS.forEach(function(m){
      var val = state.needs[m.key], urgent = val<45, full = val>=98;
      any=true;
      html += '<div class="mission-card'+(urgent?" urgent":"")+'">'+
        '<div class="mission-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'+m.icon+'</svg></div>'+
        '<div class="mission-body"><div class="mission-title">'+m.title+'</div><div class="mission-sub">'+m.room+' · '+Math.round(val)+'% '+(urgent?"· il en a besoin":"")+'</div></div>'+
        '<button class="mission-btn" data-need="'+m.key+'" '+(full?"disabled":"")+'>'+(full?"Comblé":"Faire")+'</button></div>';
    });
    if(!any) html = '<div class="empty-note">Aucune mission pour l\'instant.</div>';
    el.missionList.innerHTML = html;
  }

  function renderDressing(){
    el.dressingImg.src = assetSrc(state.outfit, "assis");
    var html = "";
    Object.keys(OUTFIT_LABEL).forEach(function(key){
      if(state.owned.outfits.indexOf(key) < 0) return;
      html += '<div class="outfit-card'+(state.outfit===key?" selected":"")+'" data-outfit="'+key+'">'+
        '<img src="'+assetSrc(key,"assis")+'" alt="'+OUTFIT_LABEL[key]+'">'+
        '<span>'+OUTFIT_LABEL[key]+'</span></div>';
    });
    el.outfitGrid.innerHTML = html;
  }

  // ---------- messages : file d'attente (un message ne coupe plus le precedent) ----------
  var toastQueue = [], toastBusy = false;
  function showToast(msg, ms){
    if(toastQueue.length && toastQueue[toastQueue.length - 1].msg === msg) return; // pas de doublon
    toastQueue.push({ msg:msg, ms:ms || 2600 });
    if(!toastBusy) nextToast();
  }
  function nextToast(){
    var t = toastQueue.shift();
    if(!t){ toastBusy = false; return; }
    toastBusy = true;
    el.toast.textContent = t.msg;
    el.toast.classList.add("show");
    setTimeout(function(){
      el.toast.classList.remove("show");
      setTimeout(nextToast, 280); // laisse la sortie s'animer
    }, t.ms);
  }

  // gain de pieces d'une mission : plein si le besoin etait sous MISSION_FULL_BELOW, sinon reduit ;
  // divise par 2 si un besoin est tres bas (regle 3.3).
  function missionCoins(base, needBefore){
    var f = needBefore < D.MISSION_FULL_BELOW ? 1 : D.MISSION_REDUCED_FACTOR;
    if(D.NEED_KEYS.some(function(k){ return state.needs[k] < D.LOW_NEED; })) f *= D.LOW_NEED_COIN_FACTOR;
    return Math.max(1, Math.round(base * f));
  }
  function boostNeed(key, amount, reward){
    var before = state.needs[key];
    var coins = reward ? missionCoins(reward, before) : 0;
    state.needs[key] = clamp(state.needs[key]+amount, 0, 100);
    if(coins){ state.coins += coins; showToast("+"+coins+" pièces !"); }
    BUS.emit("mission:" + key);
    saveState(); render();
  }
  function doRepair(){
    state.repairMissionActive = false;
    state.sagesse = clamp(state.sagesse+10, 0, 100);
    state.coins += 5;
    showToast("Tout est rangé · +10 sagesse · +5 pièces");
    BUS.emit("repair");
    saveState(); render();
  }
  function equipOutfit(key){
    if(state.owned.outfits.indexOf(key) < 0) return;
    state.outfit = key;
    el.dogImg.src = assetSrc(state.outfit, currentAnimPose);
    saveState(); render();
  }
  function openCoffre(){
    if(state.lastCoffreDay === todayKey()) return;
    state.lastCoffreDay = todayKey();
    var roll = Math.random(), reward;
    if(roll<0.6){ reward=10+Math.floor(Math.random()*25); state.coins+=reward; el.rewardFlash.textContent="+"+reward+" pièces !"; }
    else if(roll<0.85){ reward=30+Math.floor(Math.random()*30); state.coins+=reward; el.rewardFlash.textContent="Jackpot ! +"+reward+" pièces"; }
    else { state.sagesse=clamp(state.sagesse+15,0,100); el.rewardFlash.textContent="+15 sagesse"; }
    BUS.emit("coffre");
    saveState(); render();
  }

  // ---------- mission -> emmène le teckel dans la bonne pièce ----------
  function goDoMission(key){
    var roomKey = ROOM_KEY_FOR_NEED[key];
    var room = ROOMS[roomKey];
    var def = MISSION_DEFS.find(function(m){ return m.key===key; });
    var startX = posX;
    if(state.room !== roomKey){
      switchRoom(roomKey, false);
      startX = 45;
    }
    showView("home");
    var target = (def.spotX != null) ? def.spotX : room.spotX;
    var pose = def.pose || room.pose;
    autoSeq = { kind:"mission", targetX: target, pose: pose, need:key, actMs: def.actMs, actClass: def.actClass, scene: def.scene, phase:"walk", startX:startX };
    posX = startX;
  }

  // ---------- scene du bain ----------
  // bas de la tete + mousse, en % depuis le bas du cadre (bord de la baignoire)
  var BATH_BOTTOM = 50;
  // la baignoire touche le sol a depthY 59.5 -> regle d'echelle. La tete occupe ~94% de dog_bain.png
  // contre ~40% du sprite normal (d'ou 0.43) pour garder la meme taille de tete.
  var BATH_DEPTH = 59.5;
  function enterBath(){
    el.bathDog.style.bottom = BATH_BOTTOM + "%";
    el.bathDog.style.width = (DOG_W * scaleAt(BATH_DEPTH) * 0.43) + "%";
    el.bathDog.classList.add("on");
    el.dogSprite.style.visibility = "hidden";
    el.thought.textContent = "Un bon bain moussant !";
  }
  function exitBath(){
    el.bathDog.classList.remove("on");
    el.dogSprite.style.visibility = "";
  }

  // ---------- objets tactiles du decor ----------
  function renderHotspots(){
    var list = INTERACTIONS[state.room] || [];
    var html = "";
    list.forEach(function(s, i){
      html += '<div class="hotspot" data-i="'+i+'"></div>';
    });
    el.hotspots.innerHTML = html;
    positionHotspots();
  }
  function spotAt(s){ return s.at.jour ? (state.timeOfDay === "nuit" ? s.at.nuit : s.at.jour) : s.at; }
  // convertit les coords image -> cadre selon le rendu object-fit:cover + object-position courant
  function positionHotspots(){
    var nodes = el.hotspots.children;
    if(!nodes.length) return;
    var iw = el.roomBg.naturalWidth, ih = el.roomBg.naturalHeight;
    var W = el.roomBg.clientWidth, H = el.roomBg.clientHeight;
    if(!iw || !ih || !W || !H) return;
    var scale = Math.max(W / iw, H / ih), dw = iw * scale, dh = ih * scale;
    var offX = (W - dw) * clamp(posX, 0, 100) / 100, offY = (H - dh) * 0.30;
    var list = INTERACTIONS[state.room] || [];
    for(var i = 0; i < nodes.length; i++){
      var a = list[i] && spotAt(list[i]);
      if(!a) continue;
      var st = nodes[i].style;
      st.left   = (offX + a.x / 100 * dw) / W * 100 + "%";
      st.top    = (offY + a.y / 100 * dh) / H * 100 + "%";
      st.width  = a.w / 100 * dw / W * 100 + "%";
      st.height = a.h / 100 * dh / H * 100 + "%";
    }
  }
  function interact(spot){
    if(autoSeq) return; // ne pas couper une action en cours
    showView("home");
    autoSeq = { kind:"interact", targetX: spotAt(spot).targetX, pose: spot.pose || "joyeux",
                act: spot.act, raise: spot.raise, thought: spot.thought, toast: spot.toast,
                actMs: spot.actMs || 2600, phase:"walk", startX: posX };
  }
  el.hotspots.addEventListener("click", function(e){
    var h = e.target.closest("[data-i]");
    if(!h) return;
    var list = INTERACTIONS[state.room] || [];
    var s = list[+h.getAttribute("data-i")];
    if(s) interact(s);
  });

  // ---------- tiroir missions ----------
  function openMissionsDrawer(){
    el.missionsDrawer.classList.add("open");
    el.missionsBackdrop.classList.add("on");
    document.querySelector('.nav-btn[data-view="missions"]').classList.add("active");
  }
  function closeMissionsDrawer(){
    el.missionsDrawer.classList.remove("open");
    el.missionsBackdrop.classList.remove("on");
    var activeView = document.querySelector(".view.active");
    var name = activeView ? activeView.id.replace("view-","") : "home";
    document.querySelector('.nav-btn[data-view="missions"]').classList.remove("active");
    var nb = document.querySelector('.nav-btn[data-view="'+(NAV_PARENT[name] || name)+'"]');
    if(nb) nb.classList.add("active");
  }
  function toggleMissionsDrawer(){
    if(el.missionsDrawer.classList.contains("open")) closeMissionsDrawer();
    else openMissionsDrawer();
  }
  el.missionsBackdrop.addEventListener("click", closeMissionsDrawer);
  el.missionsCloseBtn.addEventListener("click", closeMissionsDrawer);

  el.missionList.addEventListener("click", function(e){
    var r = e.target.closest("[data-repair]");
    if(r){ closeMissionsDrawer(); doRepair(); return; }
    var b = e.target.closest("[data-need]");
    if(b && !b.disabled){ closeMissionsDrawer(); goDoMission(b.getAttribute("data-need")); }
  });
  el.outfitGrid.addEventListener("click", function(e){
    var c = e.target.closest("[data-outfit]");
    if(c) equipOutfit(c.getAttribute("data-outfit"));
  });
  el.coffreBtn.addEventListener("click", openCoffre);

  el.roomSwitcher.addEventListener("click", function(e){
    var b = e.target.closest("[data-room]");
    if(b) switchRoom(b.getAttribute("data-room"), false);
  });
  el.daynightBtn.style.display = "none"; // jour/nuit automatique (heure reelle)

  // ---------- nav ----------
  var NAV_PARENT = { fiche:"plus", sauvegarde:"plus" }; // sous-ecrans du menu Plus
  function showView(name){
    closeMissionsDrawer();
    document.querySelectorAll(".view").forEach(function(v){ v.classList.remove("active"); });
    document.getElementById("view-"+name).classList.add("active");
    var navName = NAV_PARENT[name] || name;
    document.querySelectorAll(".nav-btn").forEach(function(b){ b.classList.toggle("active", b.getAttribute("data-view")===navName); });
  }
  document.querySelectorAll(".nav-btn").forEach(function(btn){
    btn.addEventListener("click", function(){
      var name = btn.getAttribute("data-view");
      if(name === "missions"){ toggleMissionsDrawer(); return; }
      showView(name);
    });
  });

  // ---------- walk zones (hold to walk) ----------
  function bindWalk(zoneEl, dir){
    function down(e){ e.preventDefault(); walkDir = dir; zoneEl.classList.add("pressed"); el.hintToast.style.display="none"; }
    function up(){ if(walkDir===dir) walkDir = 0; zoneEl.classList.remove("pressed"); }
    zoneEl.addEventListener("pointerdown", down);
    zoneEl.addEventListener("pointerup", up);
    zoneEl.addEventListener("pointercancel", up);
    zoneEl.addEventListener("pointerleave", up);
  }
  bindWalk(el.zoneLeft, -1);
  bindWalk(el.zoneRight, 1);

  var keys = {};
  window.addEventListener("keydown", function(e){
    if(["ArrowLeft","ArrowRight","a","d"].includes(e.key)) keys[e.key]=true;
  });
  window.addEventListener("keyup", function(e){ keys[e.key]=false; });

  // ---------- bêtise autonome (version provisoire, la version visuelle arrive au lot 5) ----------
  // une bêtise toutes les MISDEED_MIN..MAX minutes de jeu actif ; le joueur peut toucher le chien
  // pendant qu'il y va pour l'interrompre (voir onDogTap).
  var MISDEED_MIN_MS = 4 * 60000, MISDEED_MAX_MS = 8 * 60000;
  var nextMisdeedAt = 0;
  function scheduleMisdeed(){ nextMisdeedAt = Date.now() + U.randInt(MISDEED_MIN_MS, MISDEED_MAX_MS); }
  function maybeMisdeed(){
    if(document.hidden || Date.now() < nextMisdeedAt) return;
    if(state.repairMissionActive || autoSeq || state.sagesse <= 15){ scheduleMisdeed(); return; }
    scheduleMisdeed();
    var misdeed = pick(MISDEEDS);
    var startX = posX;
    if(state.room !== misdeed.room){
      showView("home");
      switchRoom(misdeed.room, false);
      startX = 45;
    }
    posX = startX;
    autoSeq = { kind:"misdeed", targetX: misdeed.spotX, pose: misdeed.pose, misdeed: misdeed, phase:"walk", startX:startX };
  }

  // ---------- temps : baisse des besoins ----------
  // chaque besoin baisse a sa vitesse (NEED_DECAY_PER_HOUR). Jeu ferme / telephone en veille
  // (ecart > OFFLINE_AFTER_MS) : jamais sous OFFLINE_FLOOR, sauf si le besoin y etait deja.
  function applyDecay(elapsedMs, offline){
    var hours = elapsedMs / 3600000;
    D.NEED_KEYS.forEach(function(k){
      var v = state.needs[k];
      var nv = v - D.NEED_DECAY_PER_HOUR[k] * hours;
      if(offline) nv = Math.max(nv, Math.min(v, D.OFFLINE_FLOOR));
      state.needs[k] = clamp(nv, 0, 100);
    });
  }
  function tick(){
    var now = Date.now(), elapsed = Math.max(0, now - state.lastTick);
    state.lastTick = now;
    applyDecay(elapsed, elapsed > D.OFFLINE_AFTER_MS);
    applyTimeOfDay();
    BUS.emit("tick");            // les systemes gerent ici le changement de jour (minuit local)
    if(!autoSeq && currentAnimPose !== "marche") setPose(idlePose());
    saveState(); render(); refreshThought(false);
  }
  document.addEventListener("visibilitychange", function(){ if(!document.hidden && state) tick(); });

  // ---------- toucher le chien : câlin, ou interrompre une bêtise ----------
  function spawnHearts(){
    var r = el.dogSprite.getBoundingClientRect(), f = el.roomFrame.getBoundingClientRect();
    for(var i = 0; i < 4; i++){
      var h = document.createElement("span");
      h.className = "hug-heart";
      h.textContent = "♥";
      h.style.left = (r.left - f.left + r.width * (0.35 + Math.random() * 0.3)) + "px";
      h.style.top = (r.top - f.top + r.height * 0.3) + "px";
      h.style.animationDelay = (i * 0.12) + "s";
      el.roomFrame.appendChild(h);
      setTimeout(function(n){ return function(){ n.remove(); }; }(h), 1600);
    }
  }
  function onDogTap(e){
    e.stopPropagation();
    if(autoSeq){
      // attrape en flagrant delit : la betise est evitee, petit bonus
      if(autoSeq.kind === "misdeed" && autoSeq.phase === "walk"){
        autoSeq = null;
        setPose("etonne");
        el.thought.textContent = pick(THOUGHTS.caught);
        state.sagesse = clamp(state.sagesse + 3, 0, 100);
        state.coins += 5;
        showToast("Attrapé à temps ! +3 sagesse · +5 pièces");
        BUS.emit("misdeed:caught");
        saveState(); render();
        setTimeout(function(){ if(!autoSeq) setPose(idlePose()); }, 1600);
      }
      return;
    }
    setPose("joyeux");
    spawnHearts();
    el.thought.textContent = pick(THOUGHTS.hug);
    lastThoughtAt = Date.now();
    BUS.emit("hug");
    saveState(); render();
    setTimeout(function(){ if(!autoSeq) setPose(idlePose()); }, 1400);
  }
  el.dogImg.addEventListener("click", onDogTap);

  // ---------- game loop ----------
  var SPEED = 26; // % of room width per second

  function frame(ts){
    if(lastFrame===null) lastFrame = ts;
    var dt = Math.min((ts-lastFrame)/1000, 0.05);
    lastFrame = ts;

    if(autoSeq){
      if(autoSeq.phase === "walk"){
        var dx = clampX(autoSeq.targetX) - posX;
        if(Math.abs(dx) < 1.2){
          posX = clampX(autoSeq.targetX);
          setPose(autoSeq.pose);
          autoSeq.phase = "act";
          if(autoSeq.kind === "mission"){
            autoSeq.until = ts + autoSeq.actMs;
            if(autoSeq.actClass) el.dogSprite.classList.add(autoSeq.actClass);
            if(autoSeq.scene === "bain") enterBath();
            else if(autoSeq.scene) floorOverride = furnitureY(autoSeq.scene); // canape, gamelle
          } else if(autoSeq.kind === "interact"){
            autoSeq.until = ts + (autoSeq.actMs || 2600);
            if(autoSeq.raise) floorOverride = furnitureY(autoSeq.raise);
            if(autoSeq.act === "bite") el.dogSprite.classList.add("acting-bite");
            el.thought.textContent = txt(autoSeq.thought);
            showToast(txt(autoSeq.toast), 4200);
            BUS.emit("interact");
          } else {
            autoSeq.until = ts + 1800;
            state.sagesse = clamp(state.sagesse - 10, 0, 100);
            state.repairMissionActive = true;
            el.thought.textContent = txt(autoSeq.misdeed.thought);
            showToast(txt(autoSeq.misdeed.toast), 5500);
            BUS.emit("misdeed");
            saveState(); render();
          }
        } else {
          var dir = dx > 0 ? 1 : -1;
          facing = dir;
          posX = clampX(posX + dir*SPEED*dt);
          setPose("marche");
        }
      } else if(autoSeq.phase === "act"){
        if(ts >= autoSeq.until){
          if(autoSeq.actClass) el.dogSprite.classList.remove(autoSeq.actClass);
          el.dogSprite.classList.remove("acting-bite");
          if(autoSeq.scene === "bain") exitBath();
          floorOverride = null;
          if(autoSeq.kind === "mission"){
            var def = MISSION_DEFS.find(function(m){ return m.key===autoSeq.need; });
            var reward = def.reward[0] + Math.floor(Math.random()*(def.reward[1]-def.reward[0]+1));
            boostNeed(autoSeq.need, 100, reward);
          }
          setPose(idlePose());
          autoSeq = null;
        }
      }
    } else {
      var d = walkDir;
      if(keys.ArrowLeft||keys.a) d = -1;
      if(keys.ArrowRight||keys.d) d = 1;
      if(d !== 0){
        facing = d;
        posX = clampX(posX + d*SPEED*dt);
        setPose("marche");
      } else if(currentAnimPose === "marche"){
        setPose(idlePose());
      }
    }

    updateSpritePosition();

    requestAnimationFrame(frame);
  }

  // ---------- boot ----------
  function start(){
    state = TDP.save.load();
    state.timeOfDay = currentTimeOfDay();
    posX = 45;
    el.roomBg.src = roomBgSrc(state.room, state.timeOfDay);
    renderRoomChrome();
    renderHotspots();
    el.dogImg.src = assetSrc(state.outfit, "assis");
    syncTopbarHeight();
    updateSpritePosition();
    window.addEventListener("resize", syncTopbarHeight);
    setTimeout(syncTopbarHeight, 300);
    BUS.emit("start");
    tick();
    refreshThought(true);
    scheduleMisdeed();
    setTimeout(function(){ el.hintToast.style.display = "none"; }, 4500);
    setInterval(tick, 8000);
    setInterval(maybeMisdeed, 5000);
    setInterval(function(){ refreshThought(false); }, 6000);
    requestAnimationFrame(frame);
  }

  // ---------- API pour les systemes (js/features, js/ui) ----------
  TDP.start = start;
  TDP.api = {
    get state(){ return state; },
    setState: function(s){ state = s; saveState(); location.reload(); }, // import d'une sauvegarde
    save: saveState,
    render: render,
    toast: showToast,
    showView: showView,
    txt: txt,
    el: el,
    addThoughts: function(fn){ thoughtProviders.push(fn); },
    setThought: function(t){ el.thought.textContent = txt(t); lastThoughtAt = Date.now(); }
  };
})();
