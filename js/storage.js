(function(){
  const App = window.App || (window.App = {});

  App.STORAGE_KEY = "ovk_app_stabilized_split_v1";
  App.APP_STATE_KEY = "ovk_app_current_project_id_stabilized_split_v1";
  App.AUTOSAVE_DELAY = 250;
  App.PERIODIC_SAVE_MS = 5000;
  App.autosaveTimer = null;
  App.lastSavedAt = 0;

  App.getProjects = function(){
    return App.safeParse(localStorage.getItem(App.STORAGE_KEY) || "[]", []);
  };

  App.setProjects = function(projects){
    try{
      localStorage.setItem(App.STORAGE_KEY, JSON.stringify(projects));
      return true;
    } catch(e){
      App.setStatus("Kunde inte spara i lokal lagring. Kontrollera lagringsutrymme.");
      console.error(e);
      return false;
    }
  };

  App.setCurrentProjectId = function(id){
    try { localStorage.setItem(App.APP_STATE_KEY, id || ""); }
    catch(e){ console.error(e); }
  };

  App.getCurrentProjectId = function(){
    try { return localStorage.getItem(App.APP_STATE_KEY) || ""; }
    catch(e){ return ""; }
  };

  App.getTemplateEntryDescriptors = function(template){
    const descriptors = [];
    template.groups.forEach((group, groupIndex) => {
      const count = Math.max(1, Number(group.count) || 1);
      for(let itemIndex = 0; itemIndex < count; itemIndex++){
        descriptors.push({
          groupIndex,
          itemIndex,
          type: group.type,
          key: group.key,
          label: group.label
        });
      }
    });
    return descriptors;
  };

  App.createEmptyEntryByType = function(type){
    if(type === "double") return { mode:"double", proj:"", uppm:"" };
    if(type === "quick") return { mode:"quick", value:"" };
    return { mode:"single", value:"" };
  };

  App.buildEmptyValueArray = function(template){
    return App.getTemplateEntryDescriptors(template).map(d => App.createEmptyEntryByType(d.type));
  };

  App.makeApartmentLabel = function(n){
    const floor = 11 + Math.floor((n - 1) / 3);
    const door = ((n - 1) % 3) + 1;
    return `${floor}0${door}`;
  };

  App.buildInitialRows = function(template, count){
    const rows = [];
    for(let i = 1; i <= count; i++){
      rows.push({
        apartment: App.makeApartmentLabel(i),
        values: App.buildEmptyValueArray(template),
        note: { level: 0, text: "" }
      });
    }
    return rows;
  };

  App.normalizeRowValues = function(row, template){
    const wanted = App.getTemplateEntryDescriptors(template);
    const incoming = Array.isArray(row.values) ? row.values : [];
    const out = [];

    for(let i = 0; i < wanted.length; i++){
      const desiredType = wanted[i].type;
      const entry = incoming[i];
      if(entry && entry.mode === desiredType){
        if(desiredType === "double") out.push({ mode:"double", proj:String(entry.proj || ""), uppm:String(entry.uppm || "") });
        else out.push({ mode:desiredType, value:String(entry.value || "") });
      } else {
        out.push(App.createEmptyEntryByType(desiredType));
      }
    }

    row.values = out;
    if(!row.note || typeof row.note !== "object") row.note = { level: 0, text: "" };
    row.note.level = Number(row.note.level) || 0;
    row.note.text = String(row.note.text || "");
    row.apartment = String(row.apartment || "");
    return row;
  };

  App.normalizeProject = function(project){
    if(!project || typeof project !== "object") return null;
    if(!project.id) project.id = App.uid();
    if(!project.system || !App.templates[project.system]) return null;

    const baseTemplate = App.clone(App.templates[project.system]);
    const incomingTemplate = project.template && Array.isArray(project.template.groups) ? project.template : baseTemplate;

    project.template = {
      title: incomingTemplate.title || baseTemplate.title,
      groups: incomingTemplate.groups.map((group, index) => {
        const fallback = baseTemplate.groups[index] || baseTemplate.groups[0];
        return {
          key: String(group.key || fallback.key || `g_${index}`),
          label: String(group.label || fallback.label || `Rum ${index + 1}`),
          type: ["double", "quick", "single"].includes(group.type) ? group.type : fallback.type,
          count: Math.max(1, Number(group.count) || 1)
        };
      })
    };

    project.projectName = String(project.projectName || "");
    project.documentTitle = String(project.documentTitle || "");
    project.executors = Array.isArray(project.executors) ? project.executors.map(v => String(v || "")) : [""];
    project.date = String(project.date || new Date().toISOString().slice(0,10));
    project.method = String(project.method || "");
    project.performedBy = String(project.performedBy || "");
    project.exportCount = Number(project.exportCount) || 0;
    project.updatedAt = project.updatedAt || new Date().toISOString();

    if(!Array.isArray(project.rows) || !project.rows.length){
      project.rows = App.buildInitialRows(project.template, 32);
    } else {
      project.rows = project.rows.map(row => App.normalizeRowValues(row, project.template));
    }

    return project;
  };

  App.saveCurrentProject = function(options = {}){
    if(!App.currentProject) return false;
    App.currentProject.updatedAt = new Date().toISOString();
    const projects = App.getProjects();
    const idx = projects.findIndex(p => p.id === App.currentProject.id);
    const cleanProject = App.clone(App.currentProject);
    if(idx >= 0) projects[idx] = cleanProject;
    else projects.push(cleanProject);

    const ok = App.setProjects(projects);
    if(ok){
      App.setCurrentProjectId(App.currentProject.id);
      App.lastSavedAt = Date.now();
      if(options.renderList && App.isStartScreenVisible()) App.renderSavedProjects();
    }
    return ok;
  };

  App.collectUiIntoProject = function(){
    if(!App.currentProject) return;

    const titleEl = document.getElementById("projectTitle");
    const dateEl = document.getElementById("dateField");
    const methodEl = document.getElementById("methodField");
    const performedEl = document.getElementById("performedByField");

    if(titleEl) App.currentProject.documentTitle = titleEl.value.trim();
    if(dateEl) App.currentProject.date = dateEl.value;
    if(methodEl) App.currentProject.method = methodEl.value.trim();
    if(performedEl) App.currentProject.performedBy = performedEl.value.trim();

    const descriptors = App.getTemplateEntryDescriptors(App.currentProject.template);
    const rows = [];
    const tableRows = document.querySelectorAll("#tableBody tr");

    tableRows.forEach((tr, rowIndex) => {
      const apartmentInput = tr.querySelector(".js-apartment");
      const apartment = apartmentInput ? apartmentInput.value.trim() : "";
      const noteData = App.currentProject.rows[rowIndex]?.note || { level: 0, text: "" };

      const values = descriptors.map((desc, entryIndex) => {
        if(desc.type === "double"){
          const projInput = tr.querySelector(`.js-proj[data-entry-index="${entryIndex}"]`);
          const uppmInput = tr.querySelector(`.js-uppm[data-entry-index="${entryIndex}"]`);
          return {
            mode: "double",
            proj: projInput ? projInput.value.trim() : "",
            uppm: uppmInput ? uppmInput.value.trim() : ""
          };
        }
        if(desc.type === "quick"){
          const quickCell = tr.querySelector(`td[data-mode="quick"][data-entry-index="${entryIndex}"]`);
          return {
            mode: "quick",
            value: quickCell ? String(quickCell.dataset.quickValue || "") : ""
          };
        }
        const singleInput = tr.querySelector(`.js-single[data-entry-index="${entryIndex}"]`);
        return {
          mode: "single",
          value: singleInput ? singleInput.value.trim() : ""
        };
      });

      rows.push({
        apartment,
        values,
        note: { level: Number(noteData.level) || 0, text: String(noteData.text || "") }
      });
    });

    App.currentProject.rows = rows;
  };

  App.flushAutosave = function(renderList = false){
    if(!App.currentProject) return;
    App.collectUiIntoProject();
    App.saveCurrentProject({ renderList });
  };

  App.scheduleAutosave = function(){
    if(!App.currentProject) return;
    window.clearTimeout(App.autosaveTimer);
    App.autosaveTimer = window.setTimeout(() => {
      App.flushAutosave(false);
      App.setStatus("Autosparat.");
    }, App.AUTOSAVE_DELAY);
  };

  window.downloadBackup = function(){
    if(!App.currentProject){
      alert("Inget projekt öppet.");
      return;
    }
    App.flushAutosave(false);
    const data = JSON.stringify(App.currentProject, null, 2);
    const blob = new Blob([data], { type:"application/json" });
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = `ovk_backup_${Date.now()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    App.setStatus("Backup nedladdad.");
  };

  window.restoreBackup = function(){
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = function(e){
      const file = e.target.files[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = function(){
        try{
          const parsed = App.safeParse(reader.result, null);
          const normalized = App.normalizeProject(parsed);
          if(!normalized) throw new Error("Invalid backup");
          App.currentProject = normalized;
          App.saveCurrentProject({ renderList: true });
          App.openCurrentProject();
          App.setStatus("Backup återställd.");
        } catch(err){
          alert("Kunde inte läsa backupfilen.");
          console.error(err);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };
})();
