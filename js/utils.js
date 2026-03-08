(function(){
  const App = window.App || (window.App = {});

  App.clone = function(obj){
    return JSON.parse(JSON.stringify(obj));
  };

  App.uid = function(){
    return "p_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
  };

  App.escapeHtml = function(str){
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  };

  App.safeParse = function(json, fallback){
    try { return JSON.parse(json); }
    catch(e){ return fallback; }
  };

  App.formatDateTime = function(iso){
    if(!iso) return "-";
    const d = new Date(iso);
    if (isNaN(d)) return "-";
    return d.toLocaleString("sv-SE");
  };

  App.sanitizeFileName = function(name){
    return String(name || "")
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, " ")
      .trim();
  };

  App.setStatus = function(text){
    const el = document.getElementById("statusBox");
    if(el) el.textContent = "Status: " + text;
  };

  App.isStartScreenVisible = function(){
    return !document.getElementById("startScreen").classList.contains("hidden");
  };
})();
