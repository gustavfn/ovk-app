(function(){
  const App = window.App || (window.App = {});

  App.cachedLogoDataUrl = null;

  App.getDocumentPrefix = function(){
    return App.currentProject.system === "självdrag" ? "Lägenhetsprotokoll" : "Luftflödesprotokoll";
  };

  App.getExportFileName = function(){
    const base = `${App.getDocumentPrefix()} ${App.currentProject.documentTitle}`;
    const cleanBase = App.sanitizeFileName(base);
    const count = (App.currentProject.exportCount || 0) + 1;
    if(count <= 1) return `${cleanBase}.pdf`;
    return `${cleanBase} v.${count}.pdf`;
  };

  App.buildPdfHead = function(){
    const hasDouble = App.currentProject.template.groups.some(g => g.type === "double");

    if(!hasDouble){
      const row = [{ content: "Lägenhet" }];
      App.currentProject.template.groups.forEach(g => {
        for(let i = 1; i <= g.count; i++){
          row.push({ content: g.count > 1 ? `${g.label} ${i}` : g.label });
        }
      });
      row.push({ content: "Not." });
      return [row];
    }

    const row1 = [{ content: "Lägenhet", rowSpan: 2 }];
    const row2 = [];

    App.currentProject.template.groups.forEach(g => {
      for(let i = 1; i <= g.count; i++){
        const label = g.count > 1 ? `${g.label} ${i}` : g.label;
        if(g.type === "double"){
          row1.push({ content: label, colSpan: 2 });
          row2.push("Proj", "Uppm");
        } else {
          row1.push({ content: label, rowSpan: 2 });
        }
      }
    });

    row1.push({ content: "Not.", rowSpan: 2 });
    return [row1, row2];
  };

  App.getLogoDataUrl = function(){
    return new Promise((resolve) => {
      if(App.cachedLogoDataUrl){
        resolve(App.cachedLogoDataUrl);
        return;
      }

      const img = new Image();
      img.onload = function(){
        try{
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          App.cachedLogoDataUrl = canvas.toDataURL("image/png");
          resolve(App.cachedLogoDataUrl);
        } catch(e){
          resolve(null);
        }
      };
      img.onerror = function(){ resolve(null); };
      img.src = "./logo.png";
    });
  };

  window.exportPDF = async function(){
    App.flushAutosave(false);

    if(!window.jspdf || !window.jspdf.jsPDF || typeof window.jspdf.jsPDF !== "function"){
      alert("PDF-biblioteket är inte laddat. För helt offline PDF-export behöver jsPDF bäddas in lokalt i appen.");
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("landscape");

    const prefix = App.getDocumentPrefix();
    const pdfTitle = `${prefix} ${App.currentProject.documentTitle}`;
    const logoDataUrl = await App.getLogoDataUrl();

    if(logoDataUrl){
      doc.addImage(logoDataUrl, "PNG", 10, 6, 42, 14);
    }

    doc.setFillColor(224, 172, 0);
    doc.rect(8, 24, 281, 12, "F");

    doc.setTextColor(255,255,255);
    doc.setFontSize(13);
    doc.text(pdfTitle, 148, 32, { align: "center" });

    doc.setTextColor(20);

    const body = [];
    App.currentProject.rows.forEach(row => {
      let apt = row.apartment || "";
      if(row.note?.level === 1) apt += "*";
      if(row.note?.level === 2) apt += "**";

      const out = [apt];
      row.values.forEach(entry => {
        if(entry.mode === "double") out.push(entry.proj || "", entry.uppm || "");
        else out.push(entry.value || "");
      });
      out.push(row.note?.text ? "Ja" : "");
      body.push(out);
    });

    doc.autoTable({
      startY: 40,
      head: App.buildPdfHead(),
      body: body,
      theme: "grid",
      styles: {
        fontSize: 7,
        cellPadding: 1.8,
        textColor: 20,
        lineColor: [170,170,170],
        lineWidth: 0.1,
        halign: "center",
        valign: "middle"
      },
      headStyles: {
        fillColor: [47,47,47],
        textColor: 255,
        fontStyle: "bold"
      },
      alternateRowStyles: {
        fillColor: [248,246,243]
      },
      didParseCell: function(data){
        if (data.section === "head" && data.row.index === 1) {
          data.cell.styles.fillColor = [241, 235, 227];
          data.cell.styles.textColor = [20,20,20];
        }
      }
    });

    let finalY = doc.lastAutoTable.finalY + 8;

    const notes = App.currentProject.rows
      .map(r => ({
        apartment: r.apartment,
        level: r.note?.level || 0,
        text: r.note?.text || ""
      }))
      .filter(n => n.text);

    if(notes.length){
      doc.setFontSize(10);
      doc.text("Noteringar", 12, finalY);
      finalY += 4;

      notes.forEach(n => {
        let label = n.apartment;
        if(n.level === 1) label += "*";
        if(n.level === 2) label += "**";
        const text = `${label} – ${n.text}`;
        const lines = doc.splitTextToSize(text, 260);
        finalY += 5;
        if(n.level === 1) doc.setTextColor(216,161,0);
        else if(n.level === 2) doc.setTextColor(198,40,40);
        else doc.setTextColor(20);
        doc.text(lines, 12, finalY);
        doc.setTextColor(20);
        finalY += (lines.length * 4);
      });
    }

    finalY = Math.min(finalY + 6, 180);
    doc.setDrawColor(120,120,120);
    doc.rect(12, finalY, 60, 18);
    doc.rect(98, finalY, 88, 18);
    doc.rect(212, finalY, 60, 18);

    doc.setFontSize(9);
    doc.text("Datum", 15, finalY + 5);
    doc.text("Mätmetod / kalibreringsnummer", 101, finalY + 5);
    doc.text("Utfört av", 215, finalY + 5);

    doc.setFontSize(10);
    doc.text(String(App.currentProject.date || ""), 15, finalY + 12);
    doc.text(String(App.currentProject.method || ""), 101, finalY + 12);
    doc.text(String(App.currentProject.performedBy || ""), 215, finalY + 12);

    const fileName = App.getExportFileName();
    doc.save(fileName);

    App.currentProject.exportCount = (App.currentProject.exportCount || 0) + 1;
    App.saveCurrentProject({ renderList: false });
    App.setStatus(`PDF exporterad: ${fileName}`);
  };
})();
