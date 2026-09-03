#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Zeichnet stilisierte Schwarz-Weiss-Blaetter fuer die Baumarten-Kacheln.

    python3 tools/make_baumartenblaetter.py

Ausgabe: assets/baumart/<KUERZEL>.svg

Die Zeichnungen sind schematisch, nicht bestimmungsgenau: Laubblatt,
Fiederblatt und vier Nadel-Grundtypen, jeweils in der fuer die Art
typischen Umrissform (gelappt, herzfoermig, lanzettlich, dreieckig ...).

EIGENES BILD EINSETZEN
----------------------
Einfach z. B. assets/baumart/RBU.png ablegen - fertig. Die App probiert
.png, .jpg, .jpeg, .webp und erst zuletzt .svg, ein eigenes Bild gewinnt
also immer gegen die Zeichnung. Die SVG-Datei muss dafuer nicht geloescht
werden. Wer alles selbst zeichnen will, kann den ganzen Ordner leeren -
dann zeigen die Kacheln wieder den Platzhalter.

Einzelne Form anpassen: unten in ARTEN die Parameter des Kuerzels aendern
und das Skript erneut laufen lassen.
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "baumart"

W, H = 120.0, 140.0            # Zeichenflaeche
MITTE = W / 2
BASIS = H - 12.0               # Blattgrund
SPITZE = 14.0                  # Blattspitze

STRICH = "#20291f"
DUENN = 1.1
DICK = 2.3


# --------------------------------------------------------------------------
# Grundformen
# --------------------------------------------------------------------------

def _breitenprofil(t, a, b, breite, basis, lappen, tiefe, zaehne, zahn_n,
                   stumpf=0.0):
    """Halbe Blattbreite an der relativen Position t (0 = Grund, 1 = Spitze)."""
    scheitel = a / (a + b)
    norm = (scheitel ** a) * ((1 - scheitel) ** b)
    w = ((t ** a) * ((1 - t) ** b)) / norm
    w = breite * w + basis * (1 - t) ** 2
    if lappen:
        w *= 1 - tiefe * (0.5 - 0.5 * math.cos(2 * math.pi * lappen * t))
    if stumpf:
        w += stumpf * breite * t ** 3
    if zaehne and zahn_n:
        w += zaehne * breite * ((t * zahn_n) % 1.0)
    return w


def blatt_pfad(a=0.8, b=0.8, breite=26.0, basis=0.0, lappen=0, tiefe=0.0,
               zaehne=0.0, zahn_n=0, kerbe=0.0, laenge=1.0, stumpf=0.0,
               spitzkerbe=0.0, n=170):
    """Geschlossener Umriss eines einfachen Blattes."""
    y0 = BASIS
    y1 = BASIS - (BASIS - SPITZE) * laenge
    rechts, links = [], []
    for i in range(n + 1):
        t = i / n
        w = _breitenprofil(t, a, b, breite, basis, lappen, tiefe, zaehne, zahn_n,
                           stumpf)
        y = y0 + (y1 - y0) * t
        rechts.append((MITTE + w, y))
        links.append((MITTE - w, y))

    d = [f"M {MITTE:.1f} {y0 - kerbe:.1f}"]
    d += [f"L {x:.1f} {y:.1f}" for x, y in rechts]
    if spitzkerbe:
        d.append(f"L {MITTE:.1f} {y1 + spitzkerbe:.1f}")
    d += [f"L {x:.1f} {y:.1f}" for x, y in reversed(links)]
    d.append("Z")
    return " ".join(d), y0, y1


def hand_pfad(lappen_winkel, lappen_laenge, schaerfe=13.0, grund=17.0, n=420):
    """Handfoermig gelapptes Blatt (Ahorn, Weisspappel, Elsbeere)."""
    y0 = BASIS
    punkte = []
    spanne = max(abs(min(lappen_winkel)), abs(max(lappen_winkel))) + 26.0
    for i in range(n + 1):
        grad = -spanne + 2 * spanne * i / n
        r = grund
        for wi, li in zip(lappen_winkel, lappen_laenge):
            r += li * math.exp(-((grad - wi) / schaerfe) ** 2)
        rad = math.radians(grad)
        punkte.append((MITTE + r * math.sin(rad), y0 - r * math.cos(rad)))
    d = [f"M {punkte[0][0]:.1f} {punkte[0][1]:.1f}"]
    d += [f"L {x:.1f} {y:.1f}" for x, y in punkte[1:]]
    d.append("Z")
    return " ".join(d), y0


# --------------------------------------------------------------------------
# Zeichnungen je Grundtyp
# --------------------------------------------------------------------------

def zeichne_einfach(p):
    d, y0, y1 = blatt_pfad(**{k: v for k, v in p.items() if k in
                              ("a", "b", "breite", "basis", "lappen", "tiefe",
                               "zaehne", "zahn_n", "kerbe", "laenge", "stumpf",
                               "spitzkerbe")})
    kerbe = p.get("kerbe", 0.0)
    teile = [f'<path d="{d}" fill="#fff" stroke="{STRICH}" stroke-width="{DICK}" '
             f'stroke-linejoin="round"/>']
    stiel = p.get("stiel", 12.0)
    teile.append(f'<path d="M {MITTE} {y0 - kerbe} L {MITTE} {y0 + stiel}" '
                 f'stroke="{STRICH}" stroke-width="{DICK}" stroke-linecap="round"/>')
    teile.append(f'<path d="M {MITTE} {y0 - kerbe} L {MITTE} {y1 + 4:.1f}" '
                 f'stroke="{STRICH}" stroke-width="{DUENN}" stroke-linecap="round"/>')
    for j in range(1, p.get("nerven", 5) + 1):
        t = j / (p.get("nerven", 5) + 1)
        w = _breitenprofil(t, p.get("a", .8), p.get("b", .8), p.get("breite", 26.0),
                           p.get("basis", 0.0), p.get("lappen", 0), p.get("tiefe", 0.0),
                           0.0, 0, p.get("stumpf", 0.0))
        y = y0 + (y1 - y0) * t
        yz = y - (y0 - y1) * 0.07
        for s in (1, -1):
            teile.append(
                f'<path d="M {MITTE} {y:.1f} Q {MITTE + s * w * 0.55:.1f} {y:.1f} '
                f'{MITTE + s * w * 0.86:.1f} {yz:.1f}" fill="none" '
                f'stroke="{STRICH}" stroke-width="{DUENN}" stroke-linecap="round"/>')
    return teile


def zeichne_hand(p):
    d, y0 = hand_pfad(p["winkel"], p["laengen"], p.get("schaerfe", 13.0),
                      p.get("grund", 17.0))
    teile = [f'<path d="{d}" fill="#fff" stroke="{STRICH}" stroke-width="{DICK}" '
             f'stroke-linejoin="round"/>']
    teile.append(f'<path d="M {MITTE} {y0} L {MITTE} {y0 + p.get("stiel", 14.0)}" '
                 f'stroke="{STRICH}" stroke-width="{DICK}" stroke-linecap="round"/>')
    for wi, li in zip(p["winkel"], p["laengen"]):
        rad = math.radians(wi)
        r = (li + p.get("grund", 17.0)) * 0.78
        teile.append(
            f'<path d="M {MITTE} {y0} L {MITTE + r * math.sin(rad):.1f} '
            f'{y0 - r * math.cos(rad):.1f}" stroke="{STRICH}" '
            f'stroke-width="{DUENN}" stroke-linecap="round"/>')
    return teile


def zeichne_fieder(p):
    """Fiederblatt: Spindel mit gegenstaendigen Fiedern und Endfieder."""
    paare = p.get("paare", 5)
    fl = p.get("fieder_laenge", 21.0)
    fb = p.get("fieder_breite", 6.5)
    neigung = p.get("neigung", 62.0)
    y0, y1 = BASIS, SPITZE + 8
    teile = [f'<path d="M {MITTE} {y0 + p.get("stiel", 10.0)} L {MITTE} {y1:.1f}" '
             f'stroke="{STRICH}" stroke-width="{DICK}" stroke-linecap="round"/>']

    def fieder(x, y, grad, laenge, breite):
        rad = math.radians(grad)
        dx, dy = math.sin(rad), -math.cos(rad)
        nx, ny = -dy, dx
        sp = (x + dx * laenge, y + dy * laenge)
        k1 = (x + dx * laenge * 0.34 + nx * breite, y + dy * laenge * 0.34 + ny * breite)
        k2 = (x + dx * laenge * 0.78 + nx * breite * 0.66,
              y + dy * laenge * 0.78 + ny * breite * 0.66)
        k3 = (x + dx * laenge * 0.78 - nx * breite * 0.66,
              y + dy * laenge * 0.78 - ny * breite * 0.66)
        k4 = (x + dx * laenge * 0.34 - nx * breite, y + dy * laenge * 0.34 - ny * breite)
        return (f'<path d="M {x:.1f} {y:.1f} C {k1[0]:.1f} {k1[1]:.1f} '
                f'{k2[0]:.1f} {k2[1]:.1f} {sp[0]:.1f} {sp[1]:.1f} '
                f'C {k3[0]:.1f} {k3[1]:.1f} {k4[0]:.1f} {k4[1]:.1f} '
                f'{x:.1f} {y:.1f} Z" fill="#fff" stroke="{STRICH}" '
                f'stroke-width="{DUENN * 1.5:.1f}" stroke-linejoin="round"/>')

    spanne = (y0 - 6) - y1
    for i in range(paare):
        t = (i + 0.6) / (paare + 0.4)
        y = (y0 - 6) - spanne * t
        skala = 0.7 + 0.45 * math.sin(math.pi * (0.25 + 0.75 * t))
        teile.append(fieder(MITTE, y, neigung, fl * skala, fb * skala))
        teile.append(fieder(MITTE, y, -neigung, fl * skala, fb * skala))
    teile.append(fieder(MITTE, y1 + fl * 0.72, 0, fl * 0.85, fb * 0.9))
    return teile


def zeichne_nadel_paar(p):
    """Kiefer: kurzer Trieb mit paarweisen langen Nadeln."""
    lang = p.get("nadel", 62.0)
    teile = [f'<path d="M {MITTE} {BASIS + 6} L {MITTE} {BASIS - 34}" '
             f'stroke="{STRICH}" stroke-width="{DICK * 1.35:.1f}" stroke-linecap="round"/>']
    for i, y in enumerate((BASIS - 6, BASIS - 20, BASIS - 33)):
        f = 1.0 - i * 0.1
        for s in (1, -1):
            grad = math.radians(s * (13 + i * 3))
            x2 = MITTE + math.sin(grad) * lang * f
            y2 = y - math.cos(grad) * lang * f
            teile.append(f'<path d="M {MITTE:.1f} {y:.1f} L {x2:.1f} {y2:.1f}" '
                         f'stroke="{STRICH}" stroke-width="{DICK * 0.8:.1f}" '
                         f'stroke-linecap="round"/>')
        teile.append(f'<path d="M {MITTE - 4} {y:.1f} L {MITTE + 4} {y:.1f}" '
                     f'stroke="{STRICH}" stroke-width="{DICK:.1f}" stroke-linecap="round"/>')
    return teile


def zeichne_nadel_einzeln(p):
    """Fichte: Zweig mit rundum stehenden, spitzen Nadeln."""
    lang = p.get("nadel", 20.0)
    teile = [f'<path d="M {MITTE} {BASIS + 6} L {MITTE} {SPITZE + 4}" '
             f'stroke="{STRICH}" stroke-width="{DICK * 1.3:.1f}" stroke-linecap="round"/>']
    n = p.get("anzahl", 11)
    for i in range(n):
        y = BASIS - 4 - (BASIS - SPITZE - 12) * i / (n - 1)
        f = 1.0 - 0.35 * (i / (n - 1))
        for s in (1, -1):
            grad = math.radians(s * p.get("winkel", 58.0))
            teile.append(
                f'<path d="M {MITTE:.1f} {y:.1f} '
                f'L {MITTE + math.sin(grad) * lang * f:.1f} '
                f'{y - math.cos(grad) * lang * f:.1f}" stroke="{STRICH}" '
                f'stroke-width="{DICK * 0.7:.1f}" stroke-linecap="round"/>')
    return teile


def zeichne_nadel_flach(p):
    """Tanne, Douglasie, Hemlock, Eibe: flache Nadeln in zwei Reihen."""
    lang = p.get("nadel", 26.0)
    breite = p.get("nadel_breite", 3.2)
    teile = [f'<path d="M {MITTE} {BASIS + 6} L {MITTE} {SPITZE + 6}" '
             f'stroke="{STRICH}" stroke-width="{DICK * 1.3:.1f}" stroke-linecap="round"/>']
    n = p.get("anzahl", 9)
    for i in range(n):
        y = BASIS - 6 - (BASIS - SPITZE - 16) * i / (n - 1)
        f = 1.0 - 0.3 * (i / (n - 1))
        if p.get("ungleich"):
            f *= 0.75 if i % 2 else 1.0
        for s in (1, -1):
            grad = math.radians(s * p.get("winkel", 76.0))
            l = lang * f
            x2 = MITTE + math.sin(grad) * l
            y2 = y - math.cos(grad) * l
            teile.append(
                f'<path d="M {MITTE:.1f} {y:.1f} L {x2:.1f} {y2:.1f}" '
                f'fill="none" stroke="{STRICH}" stroke-width="{breite:.1f}" '
                f'stroke-linecap="round"/>')
    return teile


def zeichne_nadel_buschel(p):
    """Laerche: Kurztrieb mit Nadelbueschel."""
    lang = p.get("nadel", 46.0)
    y0 = BASIS - 10
    teile = [f'<path d="M {MITTE} {BASIS + 8} L {MITTE} {y0:.1f}" '
             f'stroke="{STRICH}" stroke-width="{DICK * 1.5:.1f}" stroke-linecap="round"/>',
             f'<ellipse cx="{MITTE}" cy="{y0:.1f}" rx="7" ry="5" fill="#fff" '
             f'stroke="{STRICH}" stroke-width="{DICK:.1f}"/>']
    n = p.get("anzahl", 17)
    for i in range(n):
        grad = math.radians(-72 + 144 * i / (n - 1))
        f = 0.72 + 0.28 * math.cos(grad)
        teile.append(
            f'<path d="M {MITTE:.1f} {y0 - 3:.1f} '
            f'L {MITTE + math.sin(grad) * lang * f:.1f} '
            f'{y0 - 3 - math.cos(grad) * lang * f:.1f}" stroke="{STRICH}" '
            f'stroke-width="{DICK * 0.62:.1f}" stroke-linecap="round"/>')
    return teile


ZEICHNER = {
    "einfach": zeichne_einfach,
    "hand": zeichne_hand,
    "fieder": zeichne_fieder,
    "nadel_paar": zeichne_nadel_paar,
    "nadel_einzeln": zeichne_nadel_einzeln,
    "nadel_flach": zeichne_nadel_flach,
    "nadel_buschel": zeichne_nadel_buschel,
}

# --------------------------------------------------------------------------
# Zuordnung Baumart -> Blattform
# --------------------------------------------------------------------------

ARTEN = {
    # --- Eichen: gelappt ---------------------------------------------------
    "SEI": ("einfach", dict(a=1.15, b=0.72, breite=25, lappen=4, tiefe=0.42,
                            nerven=4, stiel=7)),
    "TEI": ("einfach", dict(a=1.05, b=0.78, breite=24, lappen=4, tiefe=0.40,
                            nerven=4, stiel=15)),
    "REI": ("einfach", dict(a=0.95, b=0.85, breite=27, lappen=5, tiefe=0.55,
                            nerven=5, stiel=14)),
    "ZEI": ("einfach", dict(a=0.95, b=0.85, breite=22, lappen=6, tiefe=0.58,
                            nerven=5, stiel=12)),
    # --- Buche, Hainbuche, einfache Blaetter -------------------------------
    "RBU": ("einfach", dict(a=0.85, b=0.85, breite=26, nerven=6, stiel=8)),
    "HBU": ("einfach", dict(a=0.80, b=0.95, breite=23, zaehne=0.10, zahn_n=16,
                            nerven=7, stiel=8)),
    "EK":  ("einfach", dict(a=0.85, b=1.05, breite=17, zaehne=0.16, zahn_n=13,
                            nerven=8, stiel=10)),
    "VKB": ("einfach", dict(a=0.85, b=1.05, breite=19, zaehne=0.09, zahn_n=15,
                            nerven=6, stiel=15)),
    "BB":  ("einfach", dict(a=1.0, b=0.9, breite=24, laenge=0.82, zaehne=0.05,
                            zahn_n=18, nerven=5, stiel=18)),
    "SWE": ("einfach", dict(a=0.9, b=1.0, breite=20, nerven=6, stiel=9)),
    # --- Ulmen: schiefe Blattbasis -----------------------------------------
    "BRU": ("einfach", dict(a=1.25, b=0.80, breite=25, zaehne=0.11, zahn_n=17,
                            nerven=7, stiel=5, schief=0.30)),
    "FRU": ("einfach", dict(a=1.25, b=0.85, breite=20, laenge=0.85, zaehne=0.11,
                            zahn_n=15, nerven=6, stiel=6, schief=0.30)),
    "WRU": ("einfach", dict(a=1.30, b=0.78, breite=26, zaehne=0.12, zahn_n=18,
                            nerven=8, stiel=5, schief=0.38)),
    # --- Linden: herzfoermig ------------------------------------------------
    "WLI": ("einfach", dict(a=0.75, b=1.05, breite=21, basis=16, kerbe=15,
                            zaehne=0.09, zahn_n=16, nerven=4, stiel=17)),
    "SLI": ("einfach", dict(a=0.72, b=1.00, breite=24, basis=19, kerbe=18,
                            zaehne=0.09, zahn_n=14, nerven=4, stiel=15)),
    # --- Erle: verkehrt-eifoermig, Spitze ausgerandet ----------------------
    "RER": ("einfach", dict(a=1.30, b=0.85, breite=24, laenge=0.90, stumpf=0.62,
                            spitzkerbe=7, zaehne=0.06, zahn_n=14, nerven=6,
                            stiel=13)),
    # --- Birken: rautenfoermig ---------------------------------------------
    "GBI": ("einfach", dict(a=0.62, b=1.05, breite=24, zaehne=0.13, zahn_n=15,
                            nerven=5, stiel=14)),
    "MBI": ("einfach", dict(a=0.85, b=0.92, breite=24, laenge=0.85, zaehne=0.09,
                            zahn_n=13, nerven=5, stiel=13)),
    # --- Pappeln und Aspe ---------------------------------------------------
    "AS":  ("einfach", dict(a=1.0, b=1.0, breite=28, laenge=0.70, lappen=6,
                            tiefe=0.16, nerven=4, stiel=28)),
    "SPA": ("einfach", dict(a=0.30, b=1.30, breite=26, basis=10, zaehne=0.06,
                            zahn_n=18, nerven=4, stiel=18)),
    "HPA": ("einfach", dict(a=0.26, b=1.25, breite=29, basis=12, zaehne=0.05,
                            zahn_n=20, nerven=4, stiel=16)),
    "WPA": ("hand", dict(winkel=[-72, -33, 0, 33, 72], laengen=[15, 25, 33, 25, 15],
                         schaerfe=11, grund=13, stiel=16)),
    # --- Weiden: lanzettlich -------------------------------------------------
    "WWE": ("einfach", dict(a=0.85, b=1.35, breite=11, nerven=7, stiel=7)),
    "BWE": ("einfach", dict(a=0.90, b=1.45, breite=12, zaehne=0.09, zahn_n=22,
                            nerven=7, stiel=7)),
    "FWE": ("einfach", dict(a=0.88, b=1.40, breite=11, zaehne=0.07, zahn_n=20,
                            nerven=7, stiel=7)),
    # --- Ahorne und Elsbeere: handfoermig ------------------------------------
    "BAH": ("hand", dict(winkel=[-74, -37, 0, 37, 74], laengen=[22, 30, 33, 30, 22],
                         schaerfe=13, grund=17, stiel=18)),
    "SAH": ("hand", dict(winkel=[-78, -40, 0, 40, 78], laengen=[24, 32, 36, 32, 24],
                         schaerfe=9, grund=15, stiel=18)),
    "EL":  ("hand", dict(winkel=[-62, -30, 0, 30, 62], laengen=[16, 24, 34, 24, 16],
                         schaerfe=11, grund=17, stiel=14)),
    # --- Fiederblaetter -------------------------------------------------------
    "GES": ("fieder", dict(paare=4, fieder_laenge=26, fieder_breite=7.5, neigung=58)),
    "EB":  ("fieder", dict(paare=6, fieder_laenge=21, fieder_breite=5.5, neigung=70)),
    "NBS": ("fieder", dict(paare=7, fieder_laenge=23, fieder_breite=5.0, neigung=64)),
    "RO":  ("fieder", dict(paare=5, fieder_laenge=18, fieder_breite=8.0, neigung=74)),
    # --- Nadelbaeume ----------------------------------------------------------
    "GKI": ("nadel_paar", dict(nadel=62)),
    "SKI": ("nadel_paar", dict(nadel=72)),
    "GFI": ("nadel_einzeln", dict(nadel=20, anzahl=11, winkel=58)),
    "WTA": ("nadel_flach", dict(nadel=27, nadel_breite=3.4, anzahl=9, winkel=80)),
    "KTA": ("nadel_flach", dict(nadel=31, nadel_breite=3.4, anzahl=9, winkel=78)),
    "GDG": ("nadel_flach", dict(nadel=25, nadel_breite=2.8, anzahl=11, winkel=70)),
    "WHT": ("nadel_flach", dict(nadel=21, nadel_breite=3.0, anzahl=11, winkel=82,
                                ungleich=True)),
    "EIB": ("nadel_flach", dict(nadel=24, nadel_breite=3.6, anzahl=10, winkel=86)),
    "ELA": ("nadel_buschel", dict(nadel=44, anzahl=17)),
    "JLA": ("nadel_buschel", dict(nadel=40, anzahl=21)),
    "HLA": ("nadel_buschel", dict(nadel=42, anzahl=19)),
}


def svg(art: str) -> str:
    typ, p = ARTEN[art]
    teile = ZEICHNER[typ](p)
    schief = p.get("schief", 0.0)
    inhalt = "\n  ".join(teile)
    if schief:
        inhalt = (f'<g transform="translate({MITTE} {BASIS}) '
                  f'skewX({-schief * 22:.1f}) translate({-MITTE} {-BASIS})">\n  '
                  + inhalt + "\n  </g>")
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.0f} {H:.0f}" '
        f'role="img" aria-label="{art}">\n'
        f'  <rect width="{W:.0f}" height="{H:.0f}" fill="#fff"/>\n'
        f'  {inhalt}\n'
        f'</svg>\n'
    )


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    daten = ROOT / "data" / "bzt_data.json"
    if daten.exists():
        import json
        codes = [a["code"] for a in
                 json.loads(daten.read_text(encoding="utf-8"))["baumarten"]]
        fehlend = [c for c in codes if c not in ARTEN]
        if fehlend:
            print(f"Ohne Zeichnung: {fehlend}", file=sys.stderr)
    for art in ARTEN:
        (OUT / f"{art}.svg").write_text(svg(art), encoding="utf-8")
    print(f"{len(ARTEN)} Baumartenblaetter nach {OUT.relative_to(ROOT)} geschrieben")
    print("Eigenes Bild einsetzen: gleichnamige .png/.jpg daneben legen - "
          "sie gewinnt gegen die .svg-Zeichnung.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
