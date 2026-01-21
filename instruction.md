# 📄 Rapport Technique : Kweebec Manager (Spécial Hytale Server Manager)

**Objet :** Infrastructure et Configuration du Serveur Hytale via Kweebec Manager

---

## 1. Présentation
Le **Kweebec Manager** (instance Crafty Controller) est l'interface centrale pour le déploiement des serveurs Hytale. Suite à la publication du manuel officiel Hytale, cette configuration a été adaptée pour répondre aux exigences du moteur "post-Java" et du protocole réseau QUIC.

## 2. Prérequis Techniques (Critiques)

Conformément à la documentation officielle (*support.hytale.com*), l'hôte du Kweebec Manager doit impérativement respecter ces critères :

### ☕ Environnement Java
* **Version Obligatoire :** **Java 25** (JDK 25). Hytale **ne démarrera pas** avec Java 17 ou 21.
* **Distribution recommandée :** Adoptium (Temurin).
* *Note pour Kweebec Manager :* Assurez-vous que le conteneur Docker ou l'environnement local de Crafty pointe vers un exécutable Java 25.

### 🌐 Réseau & Ports
* **Protocole :** UDP uniquement (Hytale utilise QUIC).
* **Port par défaut :** **5520** (et non 25565 comme Minecraft).
* **Action requise :** Ouvrir le port **5520 en UDP** (Inbound) sur le pare-feu. Le TCP n'est pas nécessaire pour le jeu, seulement pour l'interface web de Kweebec (8443).

### 🖥️ Matériel Recommandé
* **CPU :** 4 Cœurs @ 3.5GHz+ (Hytale privilégie la vitesse monocœur pour la simulation).
* **RAM :**
    * *Minimum :* 4 Go (Test/Solo).
    * *Recommandé :* **8 Go à 16 Go** (Serveur communautaire avec distance de vue standard).
* **Stockage :** NVMe SSD obligatoire pour éviter les saccades de chargement de chunks (World Streaming).

---

## 3. Installation et Démarrage via Kweebec Manager

### Étape A : Configuration de l'exécutable
Dans les paramètres de lancement de Kweebec Manager, la ligne de commande de démarrage doit inclure l'argument de cache AOT pour optimiser le lancement :

```bash
java -Xms8G -Xmx8G -XX:AOTCache=HytaleServer.aot -jar HytaleServer.jar --assets Assets.zip

(Ajustez -Xmx selon la RAM allouée).

### Étape B : Authentification du Serveur (Première exécution)
Contrairement à Minecraft, un serveur Hytale doit être "lié".

1. **Lancer le serveur** via Kweebec Manager.
2. **Surveiller la Console Web** intégrée.
3. Le serveur affichera : `Please authenticate device`.
4. **Taper la commande** dans la console : `/auth login device`.
5. **Aller sur l'URL fournie** (ex: `hytale.com/device`) et entrer le code affiché.

### Étape C : Configuration du Monde (config.json)
Le fichier `server.properties` est remplacé par `config.json`.

* **View Distance (Distance de vue) :** Par défaut à 384 blocs (12 chunks).
* **Conseil :** Réduire à 192 blocs si la RAM sature. La distance de vue est le facteur n°1 de consommation mémoire sur Hytale.

---

## 4. Stratégie de Maintenance

* **Sauvegardes :** Hytale génère des fichiers de monde plus lourds que Minecraft. Configurer Kweebec Manager pour des sauvegardes différentielles quotidiennes vers un stockage externe.
* **Mises à jour :** Utiliser le script `hytale-downloader` (CLI) intégré aux tâches planifiées de Kweebec pour maintenir `Assets.zip` et `HytaleServer.jar` à jour automatiquement.