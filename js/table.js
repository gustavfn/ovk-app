(function(){
  const App = window.App || (window.App = {});

  App.renderHead = function(){
    const head = document.getElementById("tableHead");
    const hasDouble = App.currentProject.template.groups.some(g => g.type === "double");

    let row1 = `<tr class="main-head"><th rowspan="${hasDouble ? 2 : 1}">Lägenhet</th>`;
    let row2 = `<tr class="sub-head">`;

    App.currentProject.template.groups.forEach(g => {
      for(let i = 1; i <= g.count; i++){
        const label = g.count > 1 ? `${g.label} ${i}` : g.label;
        if(g.type === "double"){
          row1 += `<th colspan="2">${App.escapeHtml(label)}</th>`;
          row2 += `<th>Proj</th><th>Uppm</th>`;
        } else {
          row1 += `<th rowspan="${hasDouble ? 2 : 1}">${App.escapeHtml(label)}</th>`;
        }
      }
    });

    row1 += `<th rowspan="${hasDouble ? 2 : 1}">Notering</th></tr>`;
    row2 += `</tr>`;
    head.innerHTML = hasDouble ? row1 + row2 : row1;
  };

  App.noteBadge = function(level){
    if(level === 1) return `<span style="color:#d8a100">*</span>`;
    if(level === 2) return `<span style="color:#c62828">**</span>`;
    return ``;
  };

  App.renderBody = function(){
    const body = document.getElementById("tableBody");
    body.innerHTML = "";

    App.currentProject.rows.forEach((row, rowIndex) => {
      const tr = document.createElement("tr");
      const note = row.note || { level:0, text:"" };

      let html = `
        <td class="apt-cell">
          <input class="cell-input js-apartment" data-nav-col="0" data-row-index="${rowIndex}" value="${App.escapeHtml(row.apartment || "")}">
          <div style="font-size:12px; padding:0 6px 6px 6px;">${App.noteBadge(note.level)}</div>
        </td>
      `;

      let navCol = 1;

      row.values.forEach((entry, entryIndex) => {
        if(entry.mode === "double"){
          html += `
            <td data-entry-index="${entryIndex}" data-mode="double">
              <input class="cell-input js-proj" maxlength="4" data-entry-index="${entryIndex}" data-nav-col="${navCol++}" data-row-index="${rowIndex}" value="${App.escapeHtml(entry.proj || "")}">
            </td>
            <td data-entry-index="${entryIndex}" data-mode="double">
              <input class="cell-input js-uppm" maxlength="4" data-entry-index="${entryIndex}" data-nav-col="${navCol++}" data-row-index="${rowIndex}" value="${App.escapeHtml(entry.uppm || "")}">
            </td>
          `;
        } else if(entry.mode === "quick"){
          const val = entry.value || "";
          html += `
            <td data-entry-index="${entryIndex}" data-mode="quick" data-quick-value="${App.escapeHtml(val)}">
              <div class="quick-menu">
                ${["OK","SV","IN","UK"].map(opt => `
                  <button class="quick-btn ${val===opt ? "active" : ""}" type="button" onclick="setQuickValue(${rowIndex}, ${entryIndex}, '${opt}')">${opt}</button>
                `).join("")}
              </div>
            </td>
          `;
        } else {
          html += `
            <td data-entry-index="${entryIndex}" data-mode="single">
              <input class="cell-input js-single" maxlength="4" data-entry-index="${entryIndex}" data-nav-col="${navCol++}" data-row-index="${rowIndex}" value="${App.escapeHtml(entry.value || "")}">
            </td>
          `;
        }
      });

      const noteClass = note.level === 2 ? "level-2" : note.level === 1 ? "level-1" : "empty";
      const noteText = note.text ? `📝 ${note.level === 1 ? "*" : note.level === 2 ? "**" : ""}` : "📝";

      html += `
        <td>
          <button class="note-btn ${noteClass}" type="button" onclick="openNoteModal(${rowIndex})">${noteText}</button>
        </td>
      `;

      tr.innerHTML = html;
      body.appendChild(tr);
    });

    App.bindTableInputs();
  };

  App.renderTable = function(){
    App.renderHead();
    App.renderBody();
  };

  App.bindTableInputs = function(){
    document.querySelectorAll("#tableBody input").forEach(i => {
      i.oninput = () => {
        App.scheduleAutosave();
      };
      i.onkeydown = App.handleInputKeydown;
      i.onfocus = function(){
        this.select();
      };
      i.onclick = function(){
        this.select();
      };
    });
  };

  App.handleInputKeydown = function(e){
    const key = e.key;
    const currentCol = Number(e.target.dataset.navCol);
    const currentRow = Number(e.target.dataset.rowIndex);

    const findCell = (row, col) => {
      return document.querySelector(`[data-row-index="${row}"][data-nav-col="${col}"]`);
    };

    const moveTo = (row, col) => {
      const next = findCell(row, col);
      if(next){
        next.focus();
        return true;
      }
      return false;
    };

    if(key === "Enter"){
      e.preventDefault();
      if(!moveTo(currentRow + 1, currentCol)){
        moveTo(currentRow, currentCol);
      }
      return;
    }

    if(key === "Tab"){
      e.preventDefault();

      if(e.shiftKey){
        if(!moveTo(currentRow, currentCol - 1)){
          const prevRow = currentRow - 1;
          if(prevRow >= 0){
            const prevRowInputs = [...document.querySelectorAll(`[data-row-index="${prevRow}"][data-nav-col]`)]
              .map(el => Number(el.dataset.navCol))
              .filter(Number.isFinite)
              .sort((a, b) => a - b);

            if(prevRowInputs.length){
              moveTo(prevRow, prevRowInputs[prevRowInputs.length - 1]);
            }
          }
        }
      } else {
        if(!moveTo(currentRow, currentCol + 1)){
          const nextRow = currentRow + 1;
          moveTo(nextRow, 0);
        }
      }
      return;
    }

    if(key === "ArrowDown"){
      e.preventDefault();
      moveTo(currentRow + 1, currentCol);
      return;
    }

    if(key === "ArrowUp"){
      e.preventDefault();
      if(currentRow > 0) moveTo(currentRow - 1, currentCol);
      return;
    }

    if(key === "ArrowRight"){
      if(e.target.selectionStart === e.target.value.length){
        e.preventDefault();
        if(!moveTo(currentRow, currentCol + 1)){
          moveTo(currentRow + 1, 0);
        }
      }
      return;
    }

    if(key === "ArrowLeft"){
      if(e.target.selectionStart === 0 && e.target.selectionEnd === 0){
        e.preventDefault();
        if(!moveTo(currentRow, currentCol - 1)){
          const prevRow = currentRow - 1;
          if(prevRow >= 0){
            const prevRowInputs = [...document.querySelectorAll(`[data-row-index="${prevRow}"][data-nav-col]`)]
              .map(el => Number(el.dataset.navCol))
              .filter(Number.isFinite)
              .sort((a, b) => a - b);

            if(prevRowInputs.length){
              moveTo(prevRow, prevRowInputs[prevRowInputs.length - 1]);
            }
          }
        }
      }
    }
  };

  window.setQuickValue = function(rowIndex, entryIndex, value){
    if(!App.currentProject?.rows[rowIndex]?.values[entryIndex]) return;
    App.currentProject.rows[rowIndex].values[entryIndex].value = value;
    const cell = document.querySelector(`#tableBody tr:nth-child(${rowIndex + 1}) td[data-mode="quick"][data-entry-index="${entryIndex}"]`);
    if(cell){
      cell.dataset.quickValue = value;
      cell.querySelectorAll(".quick-btn").forEach(btn => btn.classList.toggle("active", btn.textContent === value));
    }
    App.scheduleAutosave();
  };

  window.openNoteModal = function(rowIndex){
    App.flushAutosave(false);
    App.currentNoteRowIndex = rowIndex;
    const row = App.currentProject.rows[rowIndex];
    const note = row.note || { level:0, text:"" };

    document.getElementById("noteModalTitle").textContent = `Notering – Lägenhet ${row.apartment || ""}`;
    document.getElementById("noteModalText").value = note.text || "";
    App.currentNoteLevel = note.level || 0;
    App.refreshNoteLevelButtons();
    document.getElementById("noteModal").classList.remove("hidden");
  };

  window.closeNoteModal = function(){
    document.getElementById("noteModal").classList.add("hidden");
    App.currentNoteRowIndex = null;
  };

  window.setNoteLevel = function(level){
    App.currentNoteLevel = level;
    App.refreshNoteLevelButtons();
  };

  App.refreshNoteLevelButtons = function(){
    document.querySelectorAll(".level-btn").forEach(btn => btn.classList.remove("active"));
    const btns = document.querySelectorAll(".level-btn");
    if(App.currentNoteLevel === 0) btns[0].classList.add("active");
    if(App.currentNoteLevel === 1) btns[1].classList.add("active");
    if(App.currentNoteLevel === 2) btns[2].classList.add("active");
  };

  window.clearNoteModal = function(){
    document.getElementById("noteModalText").value = "";
    App.currentNoteLevel = 0;
    App.refreshNoteLevelButtons();
  };

  window.saveNoteModal = function(){
    if(App.currentNoteRowIndex === null) return;
    const text = document.getElementById("noteModalText").value.trim();
    App.currentProject.rows[App.currentNoteRowIndex].note = { level: App.currentNoteLevel, text };
    closeNoteModal();
    App.renderBody();
    App.flushAutosave(false);
    App.setStatus("Notering sparad.");
  };

  window.addApartmentRow = function(){
    App.currentProject.rows.push({
      apartment: App.makeApartmentLabel(App.currentProject.rows.length + 1),
      values: App.buildEmptyValueArray(App.currentProject.template),
      note: { level:0, text:"" }
    });
    App.renderBody();
    App.flushAutosave(false);
    App.setStatus("Rad tillagd.");
  };

  window.removeApartmentRow = function(){
    if(App.currentProject.rows.length <= 1){
      App.setStatus("Minst en rad måste finnas kvar.");
      return;
    }
    if(!confirm("Ta bort sista raden?")) return;
    App.currentProject.rows.pop();
    App.renderBody();
    App.flushAutosave(false);
    App.setStatus("Sista raden borttagen.");
  };
})();
