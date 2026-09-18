# -*- coding: utf-8 -*-
"""
Fabrique index.html — la version autonome de la page d'essai.

La page publiée sur claude.ai reçoit son en-tête HTML de la plateforme.
Pour qu'elle marche partout ailleurs (GitHub Pages, un simple fichier envoyé
par WhatsApp, n'importe quel navigateur), il lui faut son propre en-tête :
encodage des accents, largeur d'écran du téléphone, titre, couleur de barre.

À relancer après chaque modification de peintre-pro-dz-essai.html :
    python3 construire-page-publique.py
"""
import io
import os

DOSSIER = os.path.dirname(os.path.abspath(__file__))
SOURCE = os.path.join(DOSSIER, 'peintre-pro-dz-essai.html')
CIBLE = os.path.join(DOSSIER, 'index.html')

contenu = io.open(SOURCE, encoding='utf-8').read()
separateur = '<div class="app">'
tete, corps = contenu.split(separateur, 1)
corps = separateur + corps

page = u"""<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="Version d'essai de PEINTRE PRO DZ : devis de peinture, surfaces, quantites de peinture et totaux, hors connexion.">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#1B5E5A" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#24352F" media="(prefers-color-scheme: dark)">
<style>
  :root {
    padding-top: env(safe-area-inset-top, 0px);
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
  body { margin: 0; }
  [hidden] { display: none !important; }
</style>
%s</head>
<body>
%s</body>
</html>
""" % (tete, corps)

io.open(CIBLE, 'w', encoding='utf-8').write(page)
print(u'index.html ecrit : %d octets' % len(page))
