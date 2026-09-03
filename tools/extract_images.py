#!/usr/bin/env python3
"""
Schneidet die Kachelbilder aus den beiden Quell-PDFs aus.

    python3 tools/extract_images.py

Eingabe  : dokumente/Klimastufen_BZT.pdf
           dokumente/BZT_Erlass.pdf
Ausgabe  : assets/klimastufe/Tf|Tm|Tt.png   – Landeskarte, jeweils nur die
                                              eigene Klimastufe farbig
           assets/bzt/BZT_<n>.jpg           – Bestandesbild (Waldbild) von
                                              der Erlass-Seite des BZT
           assets/seiten/seite-<n>.jpg      – ganze Erlass-Seiten als Bild
                                              (Seitenansicht in der App)
           assets/seiten/klimastufen.jpg    – die Klimastufen-Karte als Bild

Alle erzeugten Dateien lassen sich jederzeit von Hand durch eigene Bilder
gleichen Namens ersetzen.
"""
from __future__ import annotations

import io
import sys
from pathlib import Path

try:
    import pymupdf
    import numpy as np
    from PIL import Image
except ImportError:  # pragma: no cover
    sys.exit("Bitte zuerst 'pip install pymupdf pillow numpy' ausführen.")

ROOT = Path(__file__).resolve().parents[1]
PDF_KLIMA = ROOT / "dokumente" / "Klimastufen_BZT.pdf"
PDF_ERLASS = ROOT / "dokumente" / "BZT_Erlass.pdf"

OUT_KLIMA = ROOT / "assets" / "klimastufe"
OUT_BZT = ROOT / "assets" / "bzt"
OUT_SEITEN = ROOT / "assets" / "seiten"

# Farben der drei Klimastufen in der Karte (aus der Legende ausgelesen)
KLIMA_FARBEN = {
    "Tf": (33, 158, 222),
    "Tm": (134, 205, 87),
    "Tt": (222, 75, 42),
}
# Legendenblock in der Karte (Anteil an Breite/Höhe) – wird vor dem
# Zuschneiden geweißt, weil die App eigene Beschriftungen setzt.
LEGENDE = (0.040, 0.115, 0.420, 0.310)

GRAU = np.array([226, 229, 226])       # zurückgenommene übrige Klimastufen

# Die erste Erlass-Seite eines BZT (= Spalte "Seiten" der Zieltabelle);
# dort steht das breite Bestandesbild. Die zweite Seite folgt direkt danach.
BZT_SEITEN = {nr: 16 + 2 * (nr - 1) for nr in range(1, 20)}


def klimakarten() -> None:
    doc = pymupdf.open(PDF_KLIMA)
    pix = doc[0].get_pixmap(dpi=200)
    bild = np.array(
        Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    ).astype(int)
    hoehe, breite, _ = bild.shape

    x0, y0, x1, y1 = LEGENDE
    bild[int(hoehe * y0):int(hoehe * y1), int(breite * x0):int(breite * x1)] = 255

    OUT_SEITEN.mkdir(parents=True, exist_ok=True)
    uebersicht = Image.fromarray(bild.astype("uint8"))
    uebersicht.thumbnail((1600, 1600), Image.LANCZOS)
    uebersicht.save(OUT_SEITEN / "klimastufen.jpg", quality=80, optimize=True,
                    progressive=True)

    farben = list(KLIMA_FARBEN.values())
    abstand = np.stack([((bild - np.array(c)) ** 2).sum(axis=2) for c in farben])
    naechste = abstand.argmin(axis=0)
    bunt = (bild.max(axis=2) - bild.min(axis=2)) > 18

    # Zuschnitt auf die Karte: alles, was nicht weiß ist
    inhalt = (bild.max(axis=2) < 245) | bunt
    ys, xs = np.nonzero(inhalt)
    rand = int(0.01 * max(breite, hoehe))
    oben, unten = max(0, ys.min() - rand), min(hoehe - 1, ys.max() + rand)
    links, rechts = max(0, xs.min() - rand), min(breite - 1, xs.max() + rand)

    OUT_KLIMA.mkdir(parents=True, exist_ok=True)
    for i, (name, farbe) in enumerate(KLIMA_FARBEN.items()):
        aus = bild.copy()
        aus[bunt & (naechste != i)] = GRAU
        aus[bunt & (naechste == i)] = np.array(farbe)
        bild_aus = Image.fromarray(aus[oben:unten + 1, links:rechts + 1].astype("uint8"))
        bild_aus.thumbnail((1100, 1100), Image.LANCZOS)
        # wenige Farbtöne -> Palette hält die Datei klein
        bild_aus.convert("P", palette=Image.ADAPTIVE, colors=64).save(
            OUT_KLIMA / f"{name}.png", optimize=True)
        print(f"  assets/klimastufe/{name}.png  {bild_aus.size[0]}x{bild_aus.size[1]}")


def waldbilder_und_seiten() -> None:
    doc = pymupdf.open(PDF_ERLASS)
    OUT_BZT.mkdir(parents=True, exist_ok=True)
    OUT_SEITEN.mkdir(parents=True, exist_ok=True)

    for nr, seite in BZT_SEITEN.items():
        p = doc[seite - 1]
        breite_bilder = [
            i for i in p.get_image_info(xrefs=True)
            if i["width"] / max(i["height"], 1) > 2.5
        ]
        if not breite_bilder:
            print(f"  ! BZT_{nr}: kein Bestandesbild auf Seite {seite}", file=sys.stderr)
            continue
        roh = doc.extract_image(max(breite_bilder, key=lambda i: i["width"])["xref"])
        bild = Image.open(io.BytesIO(roh["image"]))
        if bild.mode != "RGB":
            bild = bild.convert("RGB")
        bild.save(OUT_BZT / f"BZT_{nr}.jpg", quality=88, optimize=True,
                  progressive=True)
        print(f"  assets/bzt/BZT_{nr}.jpg  {bild.size[0]}x{bild.size[1]}")

        # beide Seiten des BZT als Bild für die Seitenansicht in der App
        for s in (seite, seite + 1):
            ziel = OUT_SEITEN / f"seite-{s}.jpg"
            if ziel.exists():
                continue
            pix = doc[s - 1].get_pixmap(dpi=130)
            Image.frombytes("RGB", (pix.width, pix.height), pix.samples).save(
                ziel, quality=76, optimize=True, progressive=True)


def main() -> int:
    for pdf in (PDF_KLIMA, PDF_ERLASS):
        if not pdf.exists():
            sys.exit(f"PDF nicht gefunden: {pdf}")
    print("Klimastufen-Karten:")
    klimakarten()
    print("Bestandesbilder und Seitenansichten:")
    waldbilder_und_seiten()
    print("fertig.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
