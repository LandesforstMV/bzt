# Bilder

Hier liegen die Kachelbilder der App. Solange eine Datei fehlt, zeichnet die
App einen Platzhalter – es muss also nichts vollständig sein, um die App zu
benutzen.

## Ein Bild einsetzen

1. In `DATEILISTE.md` den Dateinamen nachschlagen (dort steht auch, welche
   Bilder schon vorhanden sind).
2. Die eigene Datei genau unter diesem Namen in den passenden Ordner legen.
3. Seite neu laden – fertig.

Probiert werden `.png`, `.jpg`, `.jpeg`, `.webp`, `.svg` in dieser
Reihenfolge. Ein eigenes PNG gewinnt daher immer gegen eine mitgelieferte
JPG- oder SVG-Datei gleichen Namens – die Originaldatei muss nicht
gelöscht werden.

## Ordner

| Ordner | Inhalt |
|---|---|
| `klimastufe/` | Karten der Klimastufen, 3 Dateien – aus `dokumente/Klimastufen_BZT.pdf` |
| `standort/` | Piktogramm Nährkraft × Feuchtestufe, 83 Dateien – aus `tools/make_standortpiktogramme.py` |
| `bzt/` | Bestandesbilder, 19 Dateien – aus `dokumente/BZT_Erlass.pdf` |
| `baumart/` | Blattzeichnungen, 43 Dateien – aus `tools/make_baumartenblaetter.py` |
| `seiten/` | ganze Erlass-Seiten für die Seitenansicht (automatisch erzeugt) |

Neu erzeugen: `python3 tools/extract_images.py` (Karten, Bestandesbilder,
Seitenansichten), `python3 tools/make_baumartenblaetter.py` (Blätter) und
`python3 tools/make_standortpiktogramme.py` (Standorts-Piktogramme).

## Logos

Optional, fehlende werden ausgeblendet:

| Datei | Ort |
|---|---|
| `favicon.ico` | Browser-Tab |
| `front.PNG` | Startbild (Klick öffnet die Anwendung) |
| `logo.png` | links oben neben dem Titel |
| `logo_lf.png` | oben mittig |
| `logo1.png` … `logo4.png` | Logoleiste unten rechts |

Anderer Ordner oder andere Endungen: `BILD_PFADE` / `BILD_ENDUNGEN` ganz
oben in `../app.js`.
