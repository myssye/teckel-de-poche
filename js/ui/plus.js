// =====================================================================
// MENU "PLUS" : fiche du chien (renommer, complicite, personnalite) + sauvegarde (export/import)
// Vues : #view-plus, #view-fiche, #view-sauvegarde (markup dans index.html).
// =====================================================================
(function(){
  "use strict";
  var D = TDP.data, BUS = TDP.bus;
  function api(){ return TDP.api; }
  function S(){ return TDP.api.state; }
  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]; }); }

  function renderFiche(){
    if(!$("ficheName") || !S()) return;
    var s = S(), c = s.complicite, need = TDP.complicite.xpNeeded();
    $("ficheTitle").textContent = s.dogName;
    if(document.activeElement !== $("ficheName")) $("ficheName").value = s.dogName;
    $("ficheLevel").textContent = "Niveau " + c.level + (c.level >= D.COMPLICITE.maxLevel ? " (max)" : "");
    $("ficheXp").style.width = (c.level >= D.COMPLICITE.maxLevel ? 100 : Math.round(100 * c.xp / need)) + "%";
    $("ficheXpText").textContent = c.level >= D.COMPLICITE.maxLevel ? "Complicité au maximum" : c.xp + " / " + need;
    var tr = TDP.complicite.dominantTrait();
    $("ficheTrait").innerHTML = tr ? "<b>" + D.TRAITS[tr].label + "</b> · " + D.TRAITS[tr].desc
                                   : "Sa personnalité se dessine au fil de vos journées ensemble.";
    var total = 0; Object.keys(s.traits).forEach(function(k){ total += s.traits[k]; });
    var html = "";
    Object.keys(D.TRAITS).forEach(function(k){
      var v = s.traits[k] || 0, pct = total ? Math.round(100 * v / total) : 0;
      html += '<div class="trait-row"><span>' + D.TRAITS[k].label + '</span><div class="trait-track"><div style="width:' + pct + '%"></div></div></div>';
    });
    $("ficheTraits").innerHTML = html;
    $("ficheStats").textContent = s.daysPlayed + " jour" + (s.daysPlayed > 1 ? "s" : "") + " ensemble · " +
      ((s.hugs.day === TDP.util.dayKey()) ? s.hugs.count : 0) + "/" + D.COMPLICITE.hugsPerDay + " câlins comptés aujourd'hui";
  }

  function rename(){
    var v = $("ficheName").value.replace(/\s+/g, " ").trim().slice(0, D.DOG_NAME_MAX);
    if(!v){ $("ficheName").value = S().dogName; return; }
    S().dogName = v;
    api().save(); api().render();
    api().toast("Il s'appelle maintenant " + v + " !");
  }

  function openSave(){
    $("exportCode").value = TDP.save.exportCode(S());
    $("importCode").value = "";
    $("importError").textContent = "";
    api().showView("sauvegarde");
  }
  function copyExport(){
    var t = $("exportCode");
    t.select(); t.setSelectionRange(0, t.value.length);
    var done = function(){ api().toast("Code copié"); };
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(t.value).then(done, function(){ document.execCommand("copy"); done(); });
    } else { document.execCommand("copy"); done(); }
  }
  function doImport(){
    try{
      var s = TDP.save.importCode($("importCode").value);
      if(!confirm("Remplacer la partie actuelle par celle de ce code ? La partie actuelle sera perdue.")) return;
      api().setState(s);
    }catch(e){ $("importError").textContent = e.message; }
  }

  BUS.on("start", function(){
    $("plusFiche").addEventListener("click", function(){ renderFiche(); api().showView("fiche"); });
    $("plusSave").addEventListener("click", openSave);
    document.querySelectorAll("[data-back]").forEach(function(b){
      b.addEventListener("click", function(){ api().showView(b.getAttribute("data-back")); });
    });
    $("ficheRename").addEventListener("click", rename);
    $("ficheName").addEventListener("keydown", function(e){ if(e.key === "Enter"){ e.preventDefault(); rename(); $("ficheName").blur(); } });
    $("ficheName").setAttribute("maxlength", D.DOG_NAME_MAX);
    $("exportCopy").addEventListener("click", copyExport);
    $("importBtn").addEventListener("click", doImport);
  });
  BUS.on("render", function(){
    renderFiche();
    var n = $("plusFicheName"); if(n) n.textContent = "Fiche de " + S().dogName;
  });
})();
