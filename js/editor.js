(function(){
  const App = window.App || (window.App = {});

  App.getValueInsertIndex = function(groupIndex){
    let index = 0;
    for(let i = 0; i < groupIndex; i++){
      index += Math.max(1, Number(App.currentProject.template.groups[i].count) || 1);
    }
    return index;
  };

  App.insertColumnAtGroup = function(groupIndex){
    const group = App.currentProject.template.groups[groupIndex];
    const insertIndex = App.getValueInsertIndex(groupIndex) + group.count;
    App.currentProject.rows.forEach(row => {
      row.values.splice(insertIndex, 0, App.createEmptyEntryByType(group.type));
    });
    group.count += 1;
  };

  App.removeColumnAtGroup = function(groupIndex){
    const group = App.currentProject.template.groups[groupIndex];
    if(group.count <= 1) return false;
    const removeIndex = App.getValueInsertIndex(groupIndex) + group.count - 1;
    App.currentProject.rows.forEach(row => {
      row.values.splice(removeIndex, 1);
    });
    group.count -= 1;
    return true;
  };

  App.renderEditor = function(){
    const wrap = document.getElementById("editorControls");
    wrap.innerHTML = "";

    App.currentProject.template.groups.forEach((g, groupIndex) => {
      const box = document.createElement("div");
      box.style.border = "1px solid #b8b0a6";
      box.style.padding = "10px";
      box.style.background = "#fff";
      box.style.minWidth = "220px";

      box.innerHTML = `
        <label style="display:block; font-size:11px; font-weight:700; margin-bottom:6px;">
          Rumsnamn
        </label>
        <input class="group-label-input" type="text" value="${App.escapeHtml(g.label)}" style="margin-bottom:8px;" />

        <div class="muted" style="margin:6px 0 8px 0;">
          Typ: ${g.type === "double" ? "Proj/Uppm" : g.type === "quick" ? "Snabbval" : "Enkel"} · Kolumner: ${g.count}
        </div>

        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="small-btn" type="button">Lägg till</button>
          <button class="small-btn" type="button">Ta bort</button>
        </div>
      `;

      const labelInput = box.querySelector(".group-label-input");
      const buttons = box.querySelectorAll("button");

      labelInput.addEventListener("input", () => {
        g.label = labelInput.value.trim() || "Namnlös";
        App.renderHead();
        App.scheduleAutosave();
        App.setStatus("Rumsnamn uppdaterat.");
      });

      buttons[0].onclick = () => {
        App.flushAutosave(false);
        App.insertColumnAtGroup(groupIndex);
        App.renderEditor();
        App.renderTable();
        App.flushAutosave(false);
        App.setStatus(`${g.label}: kolumn tillagd.`);
      };

      buttons[1].onclick = () => {
        if(g.count <= 1){
          App.setStatus(`${g.label}: minst en måste finnas kvar.`);
          return;
        }
        if(!confirm(`Ta bort sista kolumnen för ${g.label}?`)) return;
        App.flushAutosave(false);
        App.removeColumnAtGroup(groupIndex);
        App.renderEditor();
        App.renderTable();
        App.flushAutosave(false);
        App.setStatus(`${g.label}: kolumn borttagen.`);
      };

      wrap.appendChild(box);
    });
  };
})();
