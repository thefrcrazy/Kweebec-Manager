# Hiérarchie du Serveur Hytale

Ce document détaille la structure et l'organisation du projet Hytale situé dans `./`.

## 📂 Structure Racine

Le répertoire principal contient les éléments de gestion de haut niveau :

- `manager.json` : Configuration pour l'outil de gestion de serveur ou le launcher.
- `server/` : Le cœur du serveur de jeu, contenant tous les exécutables, configurations et données de jeu.

---

## 🖥️ Répertoire /server

C'est ici que se trouve toute l'intelligence du serveur :

### ⚙️ Exécutable et Coeur

- `HytaleServer.jar` : L'archive Java principale qui fait tourner le serveur.
- `auth.enc` : Fichier de données d'authentification chiffré.

### 📜 Configuration Globale

- `config.json` : Le fichier de configuration principal du serveur (ports, réglages réseau, etc.).
- `permissions.json` : Définit les rôles et les droits des joueurs.
- `bans.json` : Liste noire des joueurs bannis du serveur.

### 📊 Logs

- `logs/` : Contient l'historique des sessions du serveur avec des fichiers horodatés (ex: `2026-01-22_server.log`).

---

## 🔌 Gestion des Extensions (Mods)

Le dossier `mods/` gère les ajouts de fonctionnalités :

- **Binaires** : Fichiers `.jar` et `.zip` (ex: `DoubleBeds-0.3.0.jar`, `Violets_Furnishings.zip`).
- **Configurations** : Sous-dossiers spécifiques (ex: `DynamicSleep/`, `Hytale_Shop/`) contenant les réglages propres à chaque extension.

---

## 🌍 Données de Jeu (Universe)

Le dossier `universe/` contient l'état persistant du monde :

- `players/` : Fichiers JSON stockant l'inventaire, la position et les statistiques de chaque joueur (nommés par UUID).
- `worlds/` : Les données de la carte.
  - `chunks/` : Fichiers `.region.bin` contenant la géométrie du monde.
  - `resources/` : Métadonnées du monde (marqueurs de carte, compteurs de blocs).
- `warps.json` & `memories.json` : Systèmes de téléportation et points d'intérêt enregistrés.

---

> **Note de Senior Dev** : La présence de nombreux fichiers `.bak` indique un système de sauvegarde automatique, essentiel pour la résilience des données.
