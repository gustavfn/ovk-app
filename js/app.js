(function(){
  const App = window.App || (window.App = {});

  App.templates = {
    "självdrag": {
      title: "Självdrag",
      groups: [
        { key: "kok", label: "Kök", type: "quick", count: 1 },
        { key: "bad", label: "Badrum", type: "quick", count: 1 },
        { key: "wc", label: "WC", type: "quick", count: 1 },
        { key: "klad", label: "Klädkammare", type: "quick", count: 1 },
        { key: "rum", label: "Rum", type: "quick", count: 1 }
      ]
    },
    "frånluft": {
      title: "Frånluft",
      groups: [
        { key: "kok", label: "Kök", type: "double", count: 1 },
        { key: "bad", label: "Badrum", type: "double", count: 1 },
        { key: "wc", label: "WC", type: "double", count: 1 },
        { key: "klad", label: "Klädkammare", type: "double", count: 1 },
        { key: "rum", label: "Rum", type: "double", count: 1 }
      ]
    },
    "ftx": {
      title: "FTX",
      groups: [
        { key: "kok", label: "Kök", type: "double", count: 1 },
        { key: "bad", label: "Badrum", type: "double", count: 1 },
        { key: "wc", label: "WC", type: "double", count: 1 },
        { key: "klad", label: "Klädkammare", type: "double", count: 1 },
        { key: "vard", label: "Vardagsrum", type: "double", count: 1 },
        { key: "sov", label: "Sovrum", type: "double", count: 1 }
      ]
    },
    "ft": {
      title: "FT",
      groups: [
        { key: "kok", label: "Kök", type: "double", count: 1 },
        { key: "bad", label: "Badrum", type: "double", count: 1 },
        { key: "wc", label: "WC", type: "double", count: 1 },
        { key: "klad", label: "Klädkammare", type: "double", count: 1 },
        { key: "vard", label: "Vardagsrum", type: "double", count: 1 },
        { key: "sov", label: "Sovrum", type: "double", count: 1 }
      ]
    }
  };

  App.selectedSystem = "";
  App.currentProject = null;
  App.currentNoteRowIndex = null;
  App.currentNoteLevel = 0;

  window.addExecutor = function(value = ""){
    const list = document.getElementById("executorsList");
    const row = document.createElement("div");
    row.className = "executor-row";
    row.innerHTML = `
      <input value="${App.escapeHtml(value)}" placeholder="Namn på utförare">
      <button class="small-btn" type="button">Ta bort</button>
      <button class="small-btn" type="button">Kopiera</button>
    `;
    const buttons = row.querySelectorAll("button");
    buttons[0].onclick = () => {
      row.remove();
      if(!document.querySelectorAll("#executorsList .executor-row").length) addExecutor();
    };
    buttons[1].onclick = () => addExecutor(row.querySelector("input").value);
    list.appendChild(row);
  };

  window.selectSystem = function(system, btn){
    App.selectedSystem = system;
    document.querySelectorAll(".sys-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  };

  App.bindTopFields = function(){
    ["projectTitle", "dateField", "methodField", "performedByField"].forEach(id => {
      const el = document.getElementById(id);
      if(!el) return;
      el.oninput = App.scheduleAutosave;
    });
  };

  App.renderSavedProjects = function(){
    const list = document.getElementById("savedProjectsList");
    const q = (document.getElementById("projectSearch").value || "").toLowerCase().trim();

    const projects = App.getProjects()
      .map(App.normalizeProject)
      .filter(Boolean)
      .sort((a,b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
      .filter(p => {
        const hay = `${p.projectName} ${p.documentTitle} ${p.system}`.toLowerCase();
        return !q || hay.includes(q);
      });

    if(!projects.length){
      list.innerHTML = `<div style="padding:12px;">Inga sparade projekt.</div>`;
      return;
    }

    list.innerHTML = projects.map(p => `
      <div class="project-item">
        <div>
          <div class="project-name">${App.escapeHtml(p.projectName)}</div>
          <div class="project-meta">${App.escapeHtml(p.documentTitle)} · ${App.escapeHtml(p.system)} · Senast ändrad ${App.formatDateTime(p.updatedAt)}</div>
        </div>
        <button class="btn" onclick="loadProject('${p.id}')">Öppna</button>
        <button class="btn-danger" onclick="deleteProject('${p.id}')">Ta bort</button>
      </div>
    `).join("");
  };
  window.renderSavedProjects = App.renderSavedProjects;

  window.createNewProject = function(){
    const projectName = document.getElementById("startProjectName").value.trim();
    const documentTitle = document.getElementById("startDocumentTitle").value.trim();
    const executors = [...document.querySelectorAll("#executorsList input")].map(i => i.value.trim()).filter(Boolean);

    if(!projectName){ alert("Fyll i projektnamn."); return; }
    if(!documentTitle){ alert("Fyll i dokumentrubrik."); return; }
    if(!App.selectedSystem){ alert("Välj systemtyp."); return; }

    App.currentProject = App.normalizeProject({
      id: App.uid(),
      projectName,
      documentTitle,
      system: App.selectedSystem,
      executors: executors.length ? executors : [""],
      date: new Date().toISOString().slice(0,10),
      method: "",
      performedBy: executors.join(", "),
      template: App.clone(App.templates[App.selectedSystem]),
      rows: App.buildInitialRows(App.clone(App.templates[App.selectedSystem]), 32),
      exportCount: 0,
      updatedAt: new Date().toISOString()
    });

    App.saveCurrentProject({ renderList: true });
    App.openCurrentProject();
  };

  window.loadProject = function(id){
    const projects = App.getProjects();
    const found = projects.find(p => p.id === id);
    if(!found) return;
    App.currentProject = App.normalizeProject(App.clone(found));
    App.setCurrentProjectId(App.currentProject.id);
    App.openCurrentProject();
  };

  window.deleteProject = function(id){
    if(!confirm("Ta bort projektet?")) return;
    const projects = App.getProjects().filter(p => p.id !== id);
    App.setProjects(projects);
    if(App.getCurrentProjectId() === id) App.setCurrentProjectId("");
    if(App.currentProject && App.currentProject.id === id) App.currentProject = null;
    App.renderSavedProjects();
  };

  App.openCurrentProject = function(){
    App.currentProject = App.normalizeProject(App.currentProject);
    document.getElementById("startScreen").classList.add("hidden");
    document.getElementById("workScreen").classList.remove("hidden");

    document.getElementById("projectTitle").value = App.currentProject.documentTitle || "";
    document.getElementById("systemLabel").textContent = App.currentProject.template.title;
    document.getElementById("folderNameLabel").textContent = App.currentProject.projectName || "";
    document.getElementById("executorsLabel").textContent = (App.currentProject.executors || []).join(", ");
    document.getElementById("dateField").value = App.currentProject.date || new Date().toISOString().slice(0,10);
    document.getElementById("methodField").value = App.currentProject.method || "";
    document.getElementById("performedByField").value = App.currentProject.performedBy || "";

    App.bindTopFields();
    App.renderEditor();
    App.renderTable();
    App.setStatus("Projekt öppnat.");
  };

  window.backToStart = function(){
    App.flushAutosave(true);
    document.getElementById("workScreen").classList.add("hidden");
    document.getElementById("startScreen").classList.remove("hidden");
    App.renderSavedProjects();
    App.setStatus("Tillbaka till startsidan. Projektet är sparat.");
  };

  App.init = function(){
    addExecutor();
    App.renderSavedProjects();

    setInterval(() => {
      if(App.currentProject && Date.now() - App.lastSavedAt > App.PERIODIC_SAVE_MS){
        App.flushAutosave(false);
      }
    }, App.PERIODIC_SAVE_MS);

    window.addEventListener("beforeunload", function(){
      if(App.currentProject) App.flushAutosave(false);
    });

    window.addEventListener("blur", function(){
      if(App.currentProject) App.flushAutosave(false);
    });

    document.addEventListener("visibilitychange", function(){
      if(document.hidden && App.currentProject) App.flushAutosave(false);
    });

    const lastId = App.getCurrentProjectId();
    if(lastId){
      const projects = App.getProjects();
      const found = projects.find(p => p.id === lastId);
      if(found){
        App.currentProject = App.normalizeProject(App.clone(found));
        App.openCurrentProject();
      }
    }
  };

  App.init();
})();
