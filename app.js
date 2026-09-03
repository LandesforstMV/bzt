/* ==========================================================================
   BZT-Filter – Anwendungslogik

   Daten:  data/bzt_data.js  (erzeugt von tools/build_data.py)
   Bilder: siehe BILD_PFADE weiter unten
   ========================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------------------------ *
   * BILDER
   *
   * Hier stehen die Pfade zu den Kachelbildern. Zum Austauschen genügt es,
   * die PNG-Dateien in die passenden Ordner zu legen – die Dateinamen
   * stehen vollständig in assets/DATEILISTE.md.
   *
   * Andere Endung (z. B. .jpg) oder anderer Ordner? Einfach hier ändern.
   * Fehlt eine Datei, zeigt die Kachel automatisch einen Platzhalter.
   * ------------------------------------------------------------------ */
  var BILD_PFADE = {
    kli:  function (slug) { return "assets/klimastufe/" + slug; },
    stgr: function (slug) { return "assets/standort/"   + slug; },
    bzt:  function (slug) { return "assets/bzt/"        + slug; },
    ba:   function (slug) { return "assets/baumart/"    + slug; }
  };

  // Reihenfolge, in der Dateiendungen probiert werden. Ein eigenes PNG
  // gewinnt damit immer gegen ein mitgeliefertes JPG gleichen Namens.
  var BILD_ENDUNGEN = [".png", ".jpg", ".jpeg", ".webp", ".svg"];

  /* ------------------------------------------------------------------ *
   * QUELLDOKUMENTE
   *
   * Die PDFs liegen unter dokumente/. SEITEN_BILD zeigt auf die daraus
   * erzeugten Seitenbilder (tools/extract_images.py), die die App in der
   * Seitenansicht anzeigt.
   * ------------------------------------------------------------------ */
  var DOKUMENTE = {
    erlass: {
      pdf: "dokumente/BZT_Erlass.pdf",
      titel: "Bestockungszieltypen im Klimawandel (Erlass MV)"
    },
    klima: {
      pdf: "dokumente/Klimastufen_BZT.pdf",
      titel: "Klimastufen nach BAS Standorts-Karte 2023 (KS_41_10)"
    }
  };
  var SEITEN_BILD = function (nr) { return "assets/seiten/seite-" + nr + ".jpg"; };
  var KLIMA_BILD = "assets/seiten/klimastufen.jpg";

  /* ------------------------------------------------------------------ */

  var D = window.BZT_DATA;
  if (!D) {
    // Haeufigster Fall: beim Hochladen ist der Ordner data/ nicht mitgekommen.
    document.body.innerHTML =
      '<div style="max-width:46rem;margin:3rem auto;padding:0 1.5rem;' +
      'font:15px/1.6 system-ui,sans-serif;color:#1c2320">' +
      '<h1 style="font-size:20px">Die Daten wurden nicht geladen</h1>' +
      '<p>Die Datei <code>data/bzt_data.js</code> konnte nicht gefunden werden. ' +
      'Sie muss im Ordner <code>data/</code> direkt neben dieser ' +
      '<code>index.html</code> liegen.</p>' +
      '<ul>' +
      '<li><b>Nach dem Hochladen (GitHub, Webspace):</b> Meist fehlt der Ordner ' +
      '<code>data/</code> – bitte prüfen, ob er mit übertragen wurde.</li>' +
      '<li><b>Groß- und Kleinschreibung:</b> Auf einem Server zählt sie. Der Name ' +
      'muss genau <code>data/bzt_data.js</code> lauten.</li>' +
      '<li><b>Frisch aus den Quelltabellen:</b> ' +
      '<code>python3 tools/build_data.py</code> erzeugt die Datei neu.</li>' +
      '</ul></div>';
    return;
  }

  var FACETS = ["kli", "stgr", "bzt", "ba"];
  var LISTE = { kli: D.klimastufen, stgr: D.standorte, bzt: D.bzt, ba: D.baumarten };
  var ID = {
    kli:  function (o) { return o.id; },
    stgr: function (o) { return o.id; },
    bzt:  function (o) { return o.id; },
    ba:   function (o) { return o.code; }
  };

  /* --- Indizes ------------------------------------------------------- */

  var idxKli  = mapIndex(D.klimastufen, "id");
  var idxStgr = mapIndex(D.standorte, "id");
  var idxBzt  = mapIndex(D.bzt, "id");
  var idxBa   = mapIndex(D.baumarten, "code");

  // Baumarten je BZT: Set der Kürzel + Detailinfo (Rang, Min, Max)
  var bztArten = D.bzt.map(function (b) {
    var set = new Set();
    b.gruppen.forEach(function (g) { g.arten.forEach(function (a) { set.add(a); }); });
    return set;
  });
  var bztArtInfo = D.bzt.map(function (b) {
    var m = new Map();
    b.gruppen.forEach(function (g) {
      g.arten.forEach(function (a) {
        if (!m.has(a)) m.set(a, { rang: g.rang, min: g.min, max: g.max, label: g.label });
      });
    });
    return m;
  });

  // Maximalanteil einer Baumart über alle BZT hinweg (für die Gesamtsortierung)
  var artMaxGesamt = new Map();
  bztArtInfo.forEach(function (m) {
    m.forEach(function (info, code) {
      artMaxGesamt.set(code, Math.max(artMaxGesamt.get(code) || 0, info.max || 0));
    });
  });

  var KOMBIS = D.kombis;   // [ [kliIdx, stgrIdx, bztIdx], ... ]

  /* --- Zustand ------------------------------------------------------- */

  var sel = { kli: new Set(), stgr: new Set(), bzt: new Set(), ba: new Set() };
  var baMode = "und";                  // "und" = alle gewählten Baumarten, "oder" = mindestens eine
  var suche = { kli: "", stgr: "", bzt: "", ba: "" };
  var zeigeNichtMoegliche = false;
  var fokusBzt = null;                 // BZT, dessen Karte hervorgehoben wird

  /* --- Filterprüfung ------------------------------------------------- */

  // skip: Facette, deren eigene Auswahl ignoriert wird (für die Optionslisten)
  function passt(k, s, b, skip) {
    if (skip !== "kli"  && sel.kli.size  && !sel.kli.has(D.klimastufen[k].id)) return false;
    if (skip !== "stgr" && sel.stgr.size && !sel.stgr.has(D.standorte[s].id))  return false;
    if (skip !== "bzt"  && sel.bzt.size  && !sel.bzt.has(D.bzt[b].id))         return false;
    if (skip !== "ba"   && sel.ba.size) {
      var arten = bztArten[b];
      if (baMode === "und") {
        var alle = true;
        sel.ba.forEach(function (a) { if (!arten.has(a)) alle = false; });
        if (!alle) return false;
      } else {
        var eine = false;
        sel.ba.forEach(function (a) { if (arten.has(a)) eine = true; });
        if (!eine) return false;
      }
    }
    return true;
  }

  function filtern(skip) {
    var out = [];
    for (var i = 0; i < KOMBIS.length; i++) {
      var r = KOMBIS[i];
      if (passt(r[0], r[1], r[2], skip)) out.push(r);
    }
    return out;
  }

  /* --- Auswertung ---------------------------------------------------- */

  function zaehle(rows, pos) {
    var c = new Map();
    rows.forEach(function (r) { c.set(r[pos], (c.get(r[pos]) || 0) + 1); });
    return c;
  }

  // Baumarten der Treffermenge inkl. Anzahl, Maximalanteil und bestem Rang
  function baumartStatistik(rows) {
    var stat = new Map();
    rows.forEach(function (r) {
      var b = r[2];
      bztArtInfo[b].forEach(function (info, code) {
        var e = stat.get(code);
        if (!e) { e = { code: code, n: 0, max: 0, rang: 9, bzt: new Set() }; stat.set(code, e); }
        e.n++;
        e.bzt.add(b);
        if ((info.max || 0) > e.max) e.max = info.max || 0;
        if (info.rang < e.rang) e.rang = info.rang;
      });
    });
    return stat;
  }

  /* --- DOM-Hilfen ---------------------------------------------------- */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function mapIndex(arr, key) {
    var m = new Map();
    arr.forEach(function (o, i) { m.set(o[key], i); });
    return m;
  }

  // Bildkachel: Platzhalter im Hintergrund, Bild darüber (falls vorhanden).
  // Es werden nacheinander alle Endungen aus BILD_ENDUNGEN probiert.
  function thumb(facet, code, slug, extraKlasse) {
    var box = el("span", "thumb thumb--" + facet + (extraKlasse ? " " + extraKlasse : ""));
    box.appendChild(el("span",
      "thumb-code" + (String(code).length > 7 ? " thumb-code--lang" : ""), code));
    var basis = BILD_PFADE[facet](slug);
    var i = 0;
    var img = new Image();
    img.alt = "";
    img.loading = "lazy";
    img.addEventListener("error", function () {
      i++;
      if (i < BILD_ENDUNGEN.length) img.src = basis + BILD_ENDUNGEN[i];
      else img.remove();
    });
    img.src = basis + BILD_ENDUNGEN[0];
    box.appendChild(img);
    return box;
  }

  function prozent(v) { return (v == null ? "–" : v + " %"); }

  /* --- Kachel-Beschriftungen je Spalte -------------------------------- */

  var TILE = {
    kli: function (o) {
      return { code: o.kurz, name: o.name, meta: o.beschreibung, slug: o.slug };
    },
    stgr: function (o) {
      var meta = o.wasserhaushalt;
      if (o.zusatz && o.zusatz !== o.wasserhaushalt) meta += " · " + o.zusatz;
      return {
        code: o.id,
        name: o.naehrstoff + " · " + o.feuchte,
        meta: meta,
        slug: o.slug
      };
    },
    bzt: function (o) {
      return {
        code: o.typ,
        name: o.name,
        meta: "Nr. " + o.nr + " · " + o.baAnzahl + " BA · LH " +
              Math.round((o.lhAnteil || 0) * 100) + " %",
        slug: o.slug
      };
    },
    ba: function (o) {
      return { code: o.code, name: o.name, lat: o.lat, slug: o.slug,
               nb: o.gruppe === "NB" };
    }
  };

  /* --- Spalten rendern ------------------------------------------------ */

  var colEl = {};
  FACETS.forEach(function (f) {
    colEl[f] = document.querySelector('.col[data-facet="' + f + '"]');
  });

  function renderSpalte(facet, eintraege, gesamt) {
    var wrap = colEl[facet].querySelector("[data-tiles]");
    var leer = colEl[facet].querySelector("[data-empty]");
    var q = suche[facet].trim().toLowerCase();

    wrap.textContent = "";
    var gruppeAktuell = null;
    var sichtbar = 0;

    eintraege.forEach(function (e) {
      var o = e.obj;
      var t = TILE[facet](o);
      var id = ID[facet](o);
      var gewaehlt = sel[facet].has(id);
      var moeglich = e.n > 0;

      if (!moeglich && !gewaehlt && !zeigeNichtMoegliche) return;
      if (q) {
        var hay = (t.code + " " + t.name + " " + (t.meta || "") + " " +
                   (o.gruppe || "")).toLowerCase();
        if (hay.indexOf(q) === -1) return;
      }

      if (facet === "stgr" && o.gruppe !== gruppeAktuell) {
        gruppeAktuell = o.gruppe;
        wrap.appendChild(el("p", "tiles-group", o.gruppe));
      }

      var btn = el("button", "tile" + (moeglich ? "" : " is-off"));
      btn.type = "button";
      btn.setAttribute("aria-pressed", gewaehlt ? "true" : "false");
      btn.dataset.facet = facet;
      btn.dataset.id = id;
      btn.title = [t.code, t.name, t.lat, t.meta, o.beschreibung, o.gruppe]
        .filter(Boolean).join(" · ");
      if (!moeglich && !gewaehlt) btn.disabled = true;

      btn.appendChild(thumb(facet, t.code, t.slug));

      var body = el("span", "tile-body");
      body.appendChild(el("span", "tile-code", t.code));
      body.appendChild(el("span", "tile-name", t.name));
      if (t.lat) body.appendChild(el("span", "tile-lat", t.lat));
      if (facet === "ba") {
        var meta = el("span", "tile-meta");
        meta.appendChild(el("span", "pill", o.gruppe === "NB" ? "NB" : "LB"));
        meta.appendChild(document.createTextNode(
          "max. " + prozent(e.max) + " · in " + e.nBzt + " BZT"));
        body.appendChild(meta);
        var bar = el("span", "bar" + (o.gruppe === "NB" ? " bar--nb" : ""));
        var fill = el("i");
        fill.style.width = Math.max(2, e.max || 0) + "%";
        bar.appendChild(fill);
        body.appendChild(bar);
      } else if (t.meta) {
        body.appendChild(el("span", "tile-meta", t.meta));
      }
      btn.appendChild(body);

      var rechts = el("span", "tile-right");
      rechts.appendChild(el("span", "tile-count", String(e.n)));
      if (facet === "kli" || facet === "bzt") {
        var lupe = el("button", "tile-doc");
        lupe.type = "button";
        lupe.title = facet === "kli"
          ? "Klimastufen-Karte im Original ansehen"
          : "Erlass-Seite " + o.seite + " ansehen";
        lupe.setAttribute("aria-label", lupe.title);
        lupe.textContent = "⤢";
        lupe.addEventListener("click", function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          if (facet === "kli") zeigeKlimakarte(o); else zeigeErlassSeite(o);
        });
        rechts.appendChild(lupe);
      }
      btn.appendChild(rechts);
      wrap.appendChild(btn);
      sichtbar++;
    });

    leer.hidden = sichtbar > 0;

    var verfuegbar = eintraege.filter(function (e) { return e.n > 0; }).length;
    colEl[facet].querySelector("[data-count]").textContent = String(verfuegbar);
    colEl[facet].querySelector("[data-total]").textContent = " / " + gesamt;
    colEl[facet].querySelector("[data-clear]").hidden = sel[facet].size === 0;
  }

  /* --- Ergebnisbereich ------------------------------------------------ */

  function renderErgebnis(rows) {
    var body = document.getElementById("results-body");
    var summary = document.getElementById("results-summary");
    body.textContent = "";

    if (!rows.length) {
      summary.textContent = "";
      var leer = el("div", "leer",
        "Diese Kombination kommt in der Zieltabelle nicht vor. " +
        "Bitte einen Filter lockern.");
      body.appendChild(leer);
      return;
    }

    var proBzt = new Map();
    rows.forEach(function (r) {
      var e = proBzt.get(r[2]);
      if (!e) { e = { n: 0, stgr: new Set(), kli: new Set() }; proBzt.set(r[2], e); }
      e.n++;
      e.stgr.add(r[1]);
      e.kli.add(r[0]);
    });

    var stgrGesamt = new Set(rows.map(function (r) { return r[1]; })).size;
    summary.textContent =
      rows.length + " Kombination" + (rows.length === 1 ? "" : "en") + " · " +
      proBzt.size + " Bestandeszieltyp" + (proBzt.size === 1 ? "" : "en") + " · " +
      stgrGesamt + " Standortgruppe" + (stgrGesamt === 1 ? "" : "n");

    var cards = el("div", "bzt-cards");
    Array.from(proBzt.keys())
      .sort(function (a, b) {
        var d = proBzt.get(b).n - proBzt.get(a).n;
        return d !== 0 ? d : D.bzt[a].nr - D.bzt[b].nr;
      })
      .forEach(function (bi) { cards.appendChild(bztKarte(bi, proBzt.get(bi))); });
    body.appendChild(cards);
  }

  function bztKarte(bi, info) {
    var b = D.bzt[bi];
    var card = el("article", "card" + (fokusBzt === b.id ? " is-focus" : ""));
    card.id = "card-" + b.slug;

    var banner = el("button", "card-bild");
    banner.type = "button";
    banner.title = "Bestandesbild und Erlass-Seite " + b.seite + " ansehen";
    banner.appendChild(thumb("bzt", b.typ, b.slug, "thumb--breit"));
    banner.addEventListener("click", function () { zeigeErlassSeite(b); });
    card.appendChild(banner);

    var head = el("header", "card-head");
    var htxt = el("div");
    htxt.appendChild(el("h3", null, b.typ + " – " + b.name));
    htxt.appendChild(el("p", "sub",
      "Nr. " + b.nr + " · Laubholzanteil " + Math.round((b.lhAnteil || 0) * 100) + " %"));
    head.appendChild(htxt);
    if (b.seite) {
      var seitenBtn = el("button", "btn btn--klein", "Seite " + b.seite + " ↗");
      seitenBtn.type = "button";
      seitenBtn.title = "Beschreibung im Erlass ansehen";
      seitenBtn.addEventListener("click", function () { zeigeErlassSeite(b); });
      head.appendChild(seitenBtn);
    }
    card.appendChild(head);

    b.gruppen.forEach(function (g) {
      var box = el("div", "grp");
      var gh = el("div", "grp-head");
      gh.appendChild(el("span", null, "Baumartengruppe " + g.rang));
      var anteil = el("span");
      anteil.appendChild(el("b", null, g.label || (g.min + "–" + g.max + " %")));
      gh.appendChild(anteil);
      box.appendChild(gh);

      var arten = el("div", "arten");
      g.arten
        .slice()
        .sort(function (x, y) { return artName(x).localeCompare(artName(y), "de"); })
        .forEach(function (code) {
          var a = D.baumarten[idxBa.get(code)];
          var chip = el("button", "art" +
            (a && a.gruppe === "NB" ? " is-nb" : "") +
            (sel.ba.has(code) ? " is-sel" : ""));
          chip.type = "button";
          chip.dataset.facet = "ba";
          chip.dataset.id = code;
          chip.title = (a ? a.name + (a.latVoll ? " – " + a.latVoll : "") : code) +
            " · anklicken, um nach dieser Baumart zu filtern";
          chip.appendChild(document.createTextNode(code));
          var txt = el("span", "art-txt");
          txt.appendChild(el("small", null, a ? a.name : ""));
          if (a && a.lat) txt.appendChild(el("i", null, a.lat));
          chip.appendChild(txt);
          arten.appendChild(chip);
        });
      box.appendChild(arten);
      card.appendChild(box);
    });

    var foot = el("div", "card-foot");
    var kliNamen = Array.from(info.kli).sort().map(function (i) {
      return D.klimastufen[i].kurz;
    }).join(", ");
    foot.appendChild(el("div", null,
      "Klimastufe: " + kliNamen + " · " + info.stgr.size +
      " Standortgruppe" + (info.stgr.size === 1 ? "" : "n")));
    var liste = el("div", "stgr-liste");
    Array.from(info.stgr)
      .sort(function (a, b2) { return a - b2; })
      .forEach(function (si) { liste.appendChild(el("span", null, D.standorte[si].id)); });
    foot.appendChild(liste);
    card.appendChild(foot);
    return card;
  }


  function artName(code) {
    var i = idxBa.get(code);
    return i == null ? code : D.baumarten[i].name;
  }

  /* --- Seitenleiste: Kurzfassung der Auswahl --------------------------- */

  function renderSeitenleiste(rows) {
    var box = document.getElementById("sidebar-status");
    if (!box) return;
    box.textContent = "";
    var gesetzt = FACETS.filter(function (f) { return sel[f].size > 0; });
    if (!gesetzt.length) {
      box.appendChild(el("p", null, "keine Filter gesetzt"));
    } else {
      gesetzt.forEach(function (f) {
        var z = el("p");
        z.appendChild(el("b", null, LABEL[f] + ": "));
        z.appendChild(document.createTextNode(
          Array.from(sel[f]).map(function (id) { return beschriftung(f, id); }).join(", ")));
        box.appendChild(z);
      });
    }
    box.appendChild(el("p", "sidebar-zahl",
      rows.length + " Kombination" + (rows.length === 1 ? "" : "en")));
  }

  /* --- Aktive Filter -------------------------------------------------- */

  var LABEL = { kli: "Klimastufe", stgr: "Standort", bzt: "BZT", ba: "Baumart" };

  function renderAktiveFilter() {
    var box = document.getElementById("active-filters");
    box.textContent = "";
    var leer = FACETS.every(function (f) { return sel[f].size === 0; });
    box.hidden = leer;
    if (leer) return;

    FACETS.forEach(function (f) {
      sel[f].forEach(function (id) {
        var chip = el("span", "chip");
        chip.appendChild(el("b", null, LABEL[f] + ": "));
        chip.appendChild(document.createTextNode(beschriftung(f, id)));
        var x = el("button", null, "×");
        x.type = "button";
        x.title = "Filter entfernen";
        x.addEventListener("click", function () { sel[f].delete(id); render(); });
        chip.appendChild(x);
        box.appendChild(chip);
      });
    });
  }

  function beschriftung(facet, id) {
    var i = { kli: idxKli, stgr: idxStgr, bzt: idxBzt, ba: idxBa }[facet].get(id);
    if (i == null) return id;
    var o = LISTE[facet][i];
    if (facet === "bzt") return o.typ + " (" + o.name + ")";
    if (facet === "ba") return o.code + " (" + o.name + ")";
    if (facet === "kli") return o.kurz;
    return o.id;
  }

  /* --- Gesamt-Render -------------------------------------------------- */

  function render() {
    var rows = filtern(null);

    // Optionslisten: die eigene Auswahl der Spalte wird jeweils ignoriert
    var cKli  = zaehle(filtern("kli"), 0);
    var cStgr = zaehle(filtern("stgr"), 1);
    var cBzt  = zaehle(filtern("bzt"), 2);
    var statBa = baumartStatistik(filtern("ba"));

    renderSpalte("kli", D.klimastufen.map(function (o, i) {
      return { obj: o, n: cKli.get(i) || 0 };
    }), D.klimastufen.length);

    renderSpalte("stgr", D.standorte.map(function (o, i) {
      return { obj: o, n: cStgr.get(i) || 0 };
    }), D.standorte.length);

    renderSpalte("bzt", D.bzt.map(function (o, i) {
      return { obj: o, n: cBzt.get(i) || 0 };
    }).sort(function (a, b) {
      return (b.n > 0) - (a.n > 0) || a.obj.nr - b.obj.nr;
    }), D.bzt.length);

    // Baumarten: absteigend nach Maximalanteil, dann nach Häufigkeit
    renderSpalte("ba", D.baumarten.map(function (o) {
      var s = statBa.get(o.code);
      return {
        obj: o,
        n: s ? s.n : 0,
        nBzt: s ? s.bzt.size : 0,
        max: s ? s.max : (artMaxGesamt.get(o.code) || 0),
        rang: s ? s.rang : 0
      };
    }).sort(function (a, b) {
      return (b.n > 0) - (a.n > 0) ||
             b.max - a.max ||
             a.rang - b.rang ||
             a.obj.name.localeCompare(b.obj.name, "de");
    }), D.baumarten.length);

    document.getElementById("result-count").textContent = String(rows.length);
    renderSeitenleiste(rows);
    renderAktiveFilter();
    renderErgebnis(rows);
    schreibeHash();
    return rows;
  }


  /* --- Seitenansicht (Overlay) ----------------------------------------- */

  var viewer = {
    box: document.getElementById("viewer"),
    titel: document.getElementById("viewer-titel"),
    sub: document.getElementById("viewer-sub"),
    bild: document.getElementById("viewer-bild"),
    hinweis: document.getElementById("viewer-hinweis"),
    pdf: document.getElementById("viewer-pdf"),
    zurueck: document.getElementById("viewer-zurueck"),
    weiter: document.getElementById("viewer-weiter"),
    blatt: document.getElementById("viewer-blatt"),
    seiten: [],
    pos: 0,
    zuletzt: null
  };

  function viewerOeffnen(titel, sub, seiten, pdfUrl) {
    viewer.zuletzt = document.activeElement;
    viewer.titel.textContent = titel;
    viewer.sub.textContent = sub || "";
    viewer.seiten = seiten;
    viewer.pos = 0;
    viewer.pdf.href = pdfUrl;
    viewer.box.hidden = false;
    document.body.classList.add("hat-viewer");
    viewerZeigen();
    viewer.box.querySelector(".viewer-zu").focus();
  }

  function viewerZeigen() {
    var s = viewer.seiten[viewer.pos];
    viewer.hinweis.hidden = true;
    viewer.bild.alt = s.alt || "";
    viewer.bild.src = s.bild;
    viewer.blatt.textContent = viewer.seiten.length > 1
      ? (viewer.pos + 1) + " / " + viewer.seiten.length + (s.label ? " · " + s.label : "")
      : (s.label || "");
    viewer.zurueck.disabled = viewer.pos === 0;
    viewer.weiter.disabled = viewer.pos >= viewer.seiten.length - 1;
    viewer.pdf.textContent = s.pdfText || "Original-PDF öffnen ↗";
    viewer.pdf.href = s.pdfUrl;
  }

  function viewerSchliessen() {
    viewer.box.hidden = true;
    document.body.classList.remove("hat-viewer");
    viewer.bild.removeAttribute("src");
    if (viewer.zuletzt && viewer.zuletzt.focus) viewer.zuletzt.focus();
  }

  function zeigeErlassSeite(b) {
    if (!b.seite) return;
    var seiten = [b.seite, b.seite + 1].map(function (nr) {
      return {
        bild: SEITEN_BILD(nr),
        label: "Seite " + nr,
        alt: "Erlass, Seite " + nr,
        pdfUrl: DOKUMENTE.erlass.pdf + "#page=" + nr,
        pdfText: "PDF bei Seite " + nr + " öffnen ↗"
      };
    });
    viewerOeffnen(b.typ + " – " + b.name, DOKUMENTE.erlass.titel, seiten,
                  DOKUMENTE.erlass.pdf);
  }

  function zeigeKlimakarte(k) {
    viewerOeffnen("Klimastufe " + k.kurz + " – " + k.name, DOKUMENTE.klima.titel, [{
      bild: KLIMA_BILD,
      label: "Klimastufen-Karte",
      alt: "Karte der Klimastufen in Mecklenburg-Vorpommern",
      pdfUrl: DOKUMENTE.klima.pdf,
      pdfText: "Original-PDF öffnen ↗"
    }], DOKUMENTE.klima.pdf);
  }

  viewer.box.addEventListener("click", function (ev) {
    if (ev.target === viewer.box || ev.target.classList.contains("viewer-zu")) {
      viewerSchliessen();
    }
  });
  viewer.zurueck.addEventListener("click", function () {
    if (viewer.pos > 0) { viewer.pos--; viewerZeigen(); }
  });
  viewer.weiter.addEventListener("click", function () {
    if (viewer.pos < viewer.seiten.length - 1) { viewer.pos++; viewerZeigen(); }
  });
  viewer.bild.addEventListener("error", function () {
    viewer.hinweis.hidden = false;
  });
  document.addEventListener("keydown", function (ev) {
    if (viewer.box.hidden) return;
    if (ev.key === "Escape") viewerSchliessen();
    else if (ev.key === "ArrowLeft") viewer.zurueck.click();
    else if (ev.key === "ArrowRight") viewer.weiter.click();
  });

  /* --- Logos ------------------------------------------------------------ *
   * Erwartet werden assets/logo.png (links oben), assets/logo_lf.png
   * (oben mittig) und assets/logo1.png … logo4.png (Leiste unten rechts
   * und in der Seitenleiste). Damit auch abweichend benannte Dateien
   * gefunden werden, wird jede Endung und die Gross-Schreibweise probiert;
   * fehlt eine Datei ganz, verschwindet ihr Platz.
   * --------------------------------------------------------------------- */

  var LOGO_ENDUNGEN = [".png", ".PNG", ".svg", ".jpg", ".JPG", ".jpeg", ".webp"];

  function logoWeg(img) {
    var box = img.closest(".logo-slot");
    // Beim Logo neben dem Titel bleibt die gezeichnete Marke stehen.
    if (box && box.classList.contains("brand-mark")) img.remove();
    else if (box) box.hidden = true;
    else img.remove();
    logoKartePruefen();
  }

  function logoLaden(img) {
    var name = img.dataset.logo;
    if (!name) return;
    // Kandidaten: assets/logo1.png, assets/logo1.PNG, …, assets/Logo1.png, …
    var namen = [name, name.charAt(0).toUpperCase() + name.slice(1)];
    var kandidaten = [];
    namen.forEach(function (n) {
      LOGO_ENDUNGEN.forEach(function (e) { kandidaten.push("assets/" + n + e); });
    });
    var i = 0;
    img.addEventListener("error", function () {
      i++;
      if (i < kandidaten.length) img.src = kandidaten[i];
      else logoWeg(img);
    });
    img.addEventListener("load", logoKartePruefen);
    img.src = kandidaten[0];
  }

  // Die Logo-Karte der Seitenleiste erscheint nur, wenn es etwas zu zeigen gibt.
  function logoKartePruefen() {
    var karte = document.getElementById("sidebar-logos");
    if (!karte) return;
    var sichtbar = Array.prototype.some.call(
      karte.querySelectorAll(".logo-slot"),
      function (slot) { return !slot.hidden; });
    karte.hidden = !sichtbar;
  }

  document.querySelectorAll(".logo-slot img").forEach(logoLaden);


  /* --- Startbild ------------------------------------------------------- */

  (function startbild() {
    var box = document.getElementById("splash");
    if (!box) return;
    var img = document.getElementById("splash-img");
    var ersatz = document.getElementById("splash-ersatz");
    var balken = document.getElementById("ladebalken-fuellung");
    var hinweis = document.getElementById("splash-hinweis");
    var bereit = false;

    // Dateiname wird in beiden Schreibweisen probiert; fehlt das Bild,
    // bleibt die gezeichnete Ersatzdarstellung stehen.
    var versuche = ["assets/front.PNG", "assets/front.png", "assets/front.jpg"];
    var i = 0;
    img.addEventListener("error", function () {
      i++;
      if (i < versuche.length) img.src = versuche[i];
      else img.remove();
    });
    img.addEventListener("load", function () { ersatz.hidden = true; });
    img.src = versuche[0];

    requestAnimationFrame(function () { balken.style.width = "100%"; });
    window.setTimeout(function () {
      bereit = true;
      box.classList.add("ist-bereit");
      hinweis.textContent = "zum Starten klicken";
    }, 1700);

    function starten() {
      if (!bereit) return;
      box.classList.add("ist-weg");
      window.setTimeout(function () { box.hidden = true; }, 420);
      document.removeEventListener("keydown", tastatur);
    }
    function tastatur(ev) {
      if (ev.key === "Enter" || ev.key === " " || ev.key === "Escape") starten();
    }
    box.addEventListener("click", starten);
    document.addEventListener("keydown", tastatur);
  })();

  /* --- Seitenleiste ---------------------------------------------------- */

  (function seitenleiste() {
    var schalter = document.getElementById("sidebar-schalter");
    var layout = document.getElementById("layout");
    if (!schalter || !layout) return;
    // Standard: eingeklappt. Erst ein Klick auf ☰ blendet sie ein,
    // danach bleibt die zuletzt gewählte Einstellung erhalten.
    var zu = true;
    try {
      zu = window.localStorage.getItem("bzt-sidebar") !== "auf";
    } catch (e) {}
    setzen(zu);
    schalter.addEventListener("click", function () { setzen(!zu); });

    function setzen(neu) {
      zu = neu;
      layout.classList.toggle("ohne-sidebar", zu);
      schalter.setAttribute("aria-expanded", zu ? "false" : "true");
      try { window.localStorage.setItem("bzt-sidebar", zu ? "zu" : "auf"); } catch (e) {}
    }
  })();

  document.getElementById("sidebar-reset").addEventListener("click", function () {
    document.getElementById("reset-all").click();
  });
  document.getElementById("sidebar-csv").addEventListener("click", function () {
    document.getElementById("export-csv").click();
  });

  /* --- Ereignisse ----------------------------------------------------- */

  document.addEventListener("click", function (ev) {
    var t = ev.target.closest("[data-facet][data-id]");
    if (!t || t.disabled) return;
    var f = t.dataset.facet, id = t.dataset.id;
    if (sel[f].has(id)) sel[f].delete(id); else sel[f].add(id);
    if (f === "bzt") fokusBzt = sel.bzt.has(id) ? id : null;
    render();
    if (f === "bzt" && fokusBzt) {
      var card = document.getElementById("card-" + D.bzt[idxBzt.get(id)].slug);
      if (card) card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });

  FACETS.forEach(function (f) {
    colEl[f].querySelector("[data-search]").addEventListener("input", function (ev) {
      suche[f] = ev.target.value;
      render();
    });
    colEl[f].querySelector("[data-clear]").addEventListener("click", function () {
      sel[f].clear();
      if (f === "bzt") fokusBzt = null;
      render();
    });
  });

  document.querySelectorAll("[data-bamode]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      baMode = btn.dataset.bamode;
      document.querySelectorAll("[data-bamode]").forEach(function (b) {
        var on = b === btn;
        b.classList.toggle("is-on", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
      render();
    });
  });

  document.getElementById("show-unavailable").addEventListener("change", function (ev) {
    zeigeNichtMoegliche = ev.target.checked;
    render();
  });

  document.getElementById("reset-all").addEventListener("click", function () {
    FACETS.forEach(function (f) {
      sel[f].clear();
      suche[f] = "";
      colEl[f].querySelector("[data-search]").value = "";
    });
    fokusBzt = null;
    render();
  });

  document.getElementById("export-csv").addEventListener("click", function () {
    exportCsv(filtern(null));
  });

  document.getElementById("drucken").addEventListener("click", drucken);
  document.getElementById("sidebar-druck").addEventListener("click", drucken);

  /* --- Standortblatt drucken -------------------------------------------- */

  function drucken() {
    var kopf = document.getElementById("druckkopf");
    var rows = filtern(null);
    kopf.textContent = "";
    kopf.appendChild(el("h1", null, "BZT-Standortblatt"));

    var zeilen = el("dl", "druck-filter");
    FACETS.forEach(function (f) {
      if (!sel[f].size) return;
      zeilen.appendChild(el("dt", null, LABEL[f]));
      zeilen.appendChild(el("dd", null,
        Array.from(sel[f]).map(function (id) { return beschriftung(f, id); }).join(", ")));
    });
    if (!zeilen.childNodes.length) {
      zeilen.appendChild(el("dt", null, "Auswahl"));
      zeilen.appendChild(el("dd", null, "keine Einschränkung – alle Kombinationen"));
    }
    var bzt = new Set(rows.map(function (r) { return r[2]; })).size;
    var stgr = new Set(rows.map(function (r) { return r[1]; })).size;
    zeilen.appendChild(el("dt", null, "Treffer"));
    zeilen.appendChild(el("dd", null,
      rows.length + " Kombinationen · " + bzt + " Bestandeszieltypen · " +
      stgr + " Standortgruppen"));
    kopf.appendChild(zeilen);

    kopf.appendChild(el("p", "druck-quelle",
      "Quelle: BZT-Erlass Mecklenburg-Vorpommern – Bestockungszieltypen im " +
      "Klimawandel. Ausgedruckt am " + new Date().toLocaleDateString("de-DE") + "."));

    window.print();
  }

  /* --- CSV-Export ------------------------------------------------------ */

  function exportCsv(rows) {
    var kopf = ["Klimastufe", "Standortbeschreibung", "Standortgruppe",
                "Naehrstoff", "Wasserhaushalt", "BZT_Nr", "BZT_Typ", "BZT_Bezeichnung",
                "LH_Anteil"];
    for (var g = 1; g <= 3; g++) {
      kopf.push("Baumart_" + g, "Anteil_BA" + g, "Min_BA" + g, "Max_BA" + g);
    }
    var zeilen = [kopf];
    rows.forEach(function (r) {
      var k = D.klimastufen[r[0]], s = D.standorte[r[1]], b = D.bzt[r[2]];
      var z = [k.quellwert, s.gruppe, s.id, s.naehrstoff, s.wasserhaushalt,
               b.id, b.typ, b.name, b.lhAnteil];
      for (var i = 1; i <= 3; i++) {
        var gr = b.gruppen.filter(function (x) { return x.rang === i; })[0];
        z.push(gr ? gr.arten.join(",") : "", gr ? gr.label : "",
               gr ? gr.min : "", gr ? gr.max : "");
      }
      zeilen.push(z);
    });
    var csv = zeilen.map(function (z) {
      return z.map(function (v) {
        v = v == null ? "" : String(v);
        return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(";");
    }).join("\r\n");

    var blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "BZT_Auswahl.csv";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  /* --- Auswahl in der Adresszeile (teilbar) ---------------------------- */

  function schreibeHash() {
    var teile = [];
    FACETS.forEach(function (f) {
      if (sel[f].size) teile.push(f + "=" + Array.from(sel[f]).map(encodeURIComponent).join(","));
    });
    if (baMode !== "und") teile.push("bamode=oder");
    var neu = teile.length ? "#" + teile.join("&") : "";
    if (neu !== location.hash) {
      history.replaceState(null, "", location.pathname + location.search + neu);
    }
  }

  function leseHash() {
    var h = location.hash.replace(/^#/, "");
    if (!h) return;
    h.split("&").forEach(function (p) {
      var kv = p.split("=");
      var k = kv[0], v = decodeURIComponent(kv[1] || "");
      if (k === "bamode") {
        baMode = v === "oder" ? "oder" : "und";
        document.querySelectorAll("[data-bamode]").forEach(function (b) {
          var on = b.dataset.bamode === baMode;
          b.classList.toggle("is-on", on);
          b.setAttribute("aria-pressed", on ? "true" : "false");
        });
        return;
      }
      if (!sel[k]) return;
      v.split(",").filter(Boolean).forEach(function (id) { sel[k].add(decodeURIComponent(id)); });
    });
  }

  /* --- Start ----------------------------------------------------------- */

  document.getElementById("meta-line").textContent =
    D.meta.kombinationen + " Kombinationen · " +
    D.klimastufen.length + " Klimastufen · " + D.standorte.length + " Standortgruppen · " +
    D.bzt.length + " BZT · " + D.baumarten.length + " Baumarten";

  leseHash();
  render();
})();
