#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Zeichnet fuer jede Standortgruppe das Standorts-Piktogramm des Erlasses.

    python3 tools/make_standortpiktogramme.py

Ausgabe: assets/standort/<KUERZEL>.svg

Das Piktogramm ist der Darstellung im BZT-Erlass nachgebildet
(Abschnitt 3.5, Beispiel S. 17): eine Matrix aus den Naehrkraftstufen
A (arm), Z (ziemlich arm), M (maessig), K (kraeftig), R (reich) und den
Feuchtestufen trocken, maessig frisch, frisch, feucht, nass, sumpfig.
Markiert ist die eine Zelle, die der jeweiligen Standortgruppe entspricht.

Die Zuordnung der Codes zu den Feuchtestufen steht woertlich im Erlass
(S. 8/9); sie ist in tools/build_data.py hinterlegt und wird hier aus
data/bzt_data.json uebernommen (Felder piktoSpalte und feuchteIdx).

EIGENES BILD EINSETZEN
----------------------
assets/standort/NM2.png ablegen - fertig. Die App probiert .png, .jpg,
.jpeg, .webp und erst zuletzt .svg; die SVG-Datei muss nicht geloescht
werden.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "standort"
DATEN = ROOT / "data" / "bzt_data.json"

NAEHR = ["A", "Z", "M", "K", "R"]          # arm -> reich (Spalten)
FEUCHTE = ["trocken", "mäßig frisch", "frisch", "feucht", "nass", "sumpfig"]

# Farbton = Wasserhaushalt, Saettigung = Naehrkraft (Erlass S. 66).
# Reihenfolge der Naehrstufen wie in NAEHR, also arm -> reich.
FARBEN = {
    "":  ["#bfeaa9", "#93dc76", "#69c94b", "#49b02f", "#2f8f21"],
    "T": ["#bfeaa9", "#93dc76", "#69c94b", "#49b02f", "#2f8f21"],
    "N": ["#f8b3c7", "#ef7fa1", "#e34c7c", "#c72f61", "#9e2049"],
    "O": ["#bfc8f9", "#8b9df4", "#5570ee", "#2c47e0", "#1a2fc0"],
    "Ü": ["#dcbdf7", "#c491f0", "#a95ee6", "#8b34d6", "#6b21b8"],
}

CODE = re.compile(r"^(Ü|O|N|T)?([RKMZA])(\d)(.*)$")

# Zeichenmasse. RAND_L ist die Spalte fuer die Feuchtestufen-Beschriftung
# links; auf 4.0 gesetzt zeichnet das Skript das Piktogramm ohne Beschriftung.
RAND_L, RAND_O = 58.0, 13.0
ZB, ZH = 15.0, 13.5
SCHRIFT_ZEILE = 8.4          # Schriftgroesse der Feuchtestufen
SCHRIFT_SPALTE = 9.0         # Schriftgroesse der Naehrkraftstufen
BREITE = RAND_L + 5 * ZB + 4.0
HOEHE = RAND_O + 6 * ZH + 4.0

GITTER = "#c8cfc8"
RAHMEN = "#3a463c"
TEXT = "#5d6b63"
MARKE = "#20291f"


def zerlege(code: str):
    m = CODE.match(code)
    if not m:
        return None
    praefix = m.group(1) or ""
    return praefix, m.group(2), int(m.group(3)), (m.group(4) or "")


def piktogramm(standort: dict) -> str:
    code = standort["id"]
    praefix, naehr, _, suffix = zerlege(code)
    stufe = standort["feuchte"]
    zeile = standort["feuchteIdx"]
    spalte = standort["piktoSpalte"]        # arm -> reich, wie NAEHR
    farbe = FARBEN[praefix][spalte]

    x = RAND_L + spalte * ZB
    y = RAND_O + zeile * ZH

    o = [f'<svg xmlns="http://www.w3.org/2000/svg" '
         f'viewBox="0 0 {BREITE:.0f} {HOEHE:.0f}" role="img" '
         f'aria-label="Standort {code}: Nährkraft {naehr}, {stufe}">',
         f'<rect width="{BREITE:.0f}" height="{HOEHE:.0f}" fill="#fff"/>',
         f'<rect x="{x:.1f}" y="{y:.1f}" width="{ZB:.1f}" height="{ZH:.1f}" '
         f'fill="{farbe}"/>']

    for i in range(1, 6):
        o.append(f'<line x1="{RAND_L:.1f}" y1="{RAND_O + i * ZH:.1f}" '
                 f'x2="{RAND_L + 5 * ZB:.1f}" y2="{RAND_O + i * ZH:.1f}" '
                 f'stroke="{GITTER}" stroke-width="1"/>')
    for j in range(1, 5):
        o.append(f'<line x1="{RAND_L + j * ZB:.1f}" y1="{RAND_O:.1f}" '
                 f'x2="{RAND_L + j * ZB:.1f}" y2="{RAND_O + 6 * ZH:.1f}" '
                 f'stroke="{GITTER}" stroke-width="1"/>')

    o.append(f'<rect x="{RAND_L:.1f}" y="{RAND_O:.1f}" width="{5 * ZB:.1f}" '
             f'height="{6 * ZH:.1f}" fill="none" stroke="{RAHMEN}" stroke-width="1.6"/>')
    o.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{ZB:.1f}" height="{ZH:.1f}" '
             f'fill="none" stroke="{MARKE}" stroke-width="2"/>')

    for j, n in enumerate(NAEHR):
        o.append(f'<text x="{RAND_L + j * ZB + ZB / 2:.1f}" y="{RAND_O - 3.5:.1f}" '
                 f'font-size="{SCHRIFT_SPALTE}" font-family="sans-serif" '
                 f'text-anchor="middle" fill="{TEXT}">{n}</text>')

    if RAND_L > 12:
        for i, f in enumerate(FEUCHTE):
            fett = ' font-weight="700"' if i == zeile else ''
            farbe_z = MARKE if i == zeile else TEXT
            ty = RAND_O + i * ZH + ZH / 2 + SCHRIFT_ZEILE / 3
            o.append(f'<text x="{RAND_L - 4:.1f}" y="{ty:.1f}" '
                     f'font-size="{SCHRIFT_ZEILE}" font-family="sans-serif" '
                     f'text-anchor="end" fill="{farbe_z}"{fett}>{f}</text>')

    if suffix:
        o.append(f'<text x="{BREITE - 3:.1f}" y="{HOEHE - 2:.1f}" font-size="9" '
                 f'font-weight="700" font-family="sans-serif" text-anchor="end" '
                 f'fill="{MARKE}">{suffix}</text>')

    o.append("</svg>")
    return "\n".join(o) + "\n"


def main() -> int:
    if not DATEN.exists():
        sys.exit("data/bzt_data.json fehlt – bitte zuerst tools/build_data.py laufen lassen.")
    standorte = json.loads(DATEN.read_text(encoding="utf-8"))["standorte"]

    ohne = [s["id"] for s in standorte if not s.get("feuchte")]
    if ohne:
        sys.exit(f"Keine Feuchtestufe in den Daten: {ohne}")
    # Gegenprobe: die Spalte muss zum Naehrkraft-Kuerzel des Codes passen
    for s_ in standorte:
        if NAEHR[s_["piktoSpalte"]] != s_["naehrCode"]:
            sys.exit(f"{s_['id']}: Spalte {NAEHR[s_['piktoSpalte']]} passt nicht "
                     f"zur Naehrkraftstufe {s_['naehrCode']}.")

    OUT.mkdir(parents=True, exist_ok=True)
    verteilung = {f: 0 for f in FEUCHTE}
    for s in standorte:
        (OUT / f"{s['slug']}.svg").write_text(piktogramm(s), encoding="utf-8")
        verteilung[s["feuchte"]] += 1

    print(f"{len(standorte)} Piktogramme nach {OUT.relative_to(ROOT)} geschrieben")
    for f in FEUCHTE:
        print(f"  {f:14} {verteilung[f]:3}")
    print("Eigenes Bild einsetzen: gleichnamige .png/.jpg daneben legen.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
