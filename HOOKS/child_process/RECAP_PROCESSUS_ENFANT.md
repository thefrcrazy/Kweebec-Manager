# Récap : Comment fonctionne un Processus Enfant sur Linux et Windows

## Concept de Base

Quand tu lances un serveur depuis ton application, tu crées un **processus enfant**. Ton application (le **processus parent**) "spawne" un nouveau processus qui exécute le serveur de manière indépendante.

```
┌─────────────────────────────────────────────────────────────┐
│  Processus Parent (ton application)                         │
│  PID: 1234                                                   │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Processus Enfant (serveur Hytale)                      ││
│  │  PID: 5678                                               ││
│  │  PPID: 1234 (lié au parent)                              ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## Les 3 Flux Standards (stdin, stdout, stderr)

Chaque processus a **3 flux de communication** par défaut :

| Flux | Direction | Rôle |
|------|-----------|------|
| **stdin** (fd 0) | Entrée → Processus | Ce que le processus lit (clavier, commandes) |
| **stdout** (fd 1) | Processus → Sortie | Sortie normale (logs, messages) |
| **stderr** (fd 2) | Processus → Sortie | Erreurs et avertissements |

```
                    ┌──────────────────┐
 stdin (entrée) ───►│                  │───► stdout (sortie normale)
                    │   PROCESSUS      │
                    │   SERVEUR        │───► stderr (erreurs)
                    └──────────────────┘
```

---

## Comment ça marche avec les PIPES

Quand tu crées un processus enfant avec `subprocess.Popen` (Python) ou `Command` (Rust), tu peux **rediriger ces flux** vers des **pipes** (tuyaux) :

```
┌──────────────────┐         PIPE          ┌──────────────────┐
│                  │◄──────────────────────│                  │
│  TON APPLI       │   stdin (tu écris)    │  SERVEUR         │
│  (Parent)        │                       │  (Enfant)        │
│                  │──────────────────────►│                  │
│                  │   stdout (tu lis)     │                  │
└──────────────────┘                       └──────────────────┘
```

### Qu'est-ce qu'un PIPE ?

- C'est un **buffer en mémoire** géré par le noyau (kernel)
- Un côté écrit, l'autre côté lit
- C'est **unidirectionnel** (sens unique)
- C'est **bloquant** si vide (lecture) ou plein (écriture)

---

## Différences Linux vs Windows

| Aspect | Linux | Windows |
|--------|-------|---------|
| **Appel système** | `fork()` + `exec()` | `CreateProcess()` |
| **Pipes** | File descriptors (int) | HANDLE |
| **Signaux** | SIGTERM, SIGKILL, etc. | TerminateProcess() |
| **Terminaux** | PTY (pseudo-terminal) | ConPTY |

### Linux : fork() + exec()

```
1. fork() → Duplique le processus parent
   
   Parent (PID 1234)  ──fork()──►  Enfant (PID 5678)
        │                              │
        ▼                              ▼
   Continue son code            Copie exacte du parent

2. exec() → L'enfant remplace son code par le serveur
   
   Enfant (PID 5678)
        │
        ▼ exec("./hytale-server")
   Le code Python/Rust est remplacé par le serveur Hytale
```

### Windows : CreateProcess()

```
CreateProcess("hytale-server.exe", ...)
        │
        ▼
Crée directement un nouveau processus
avec le programme spécifié
(pas de fork, création directe)
```

---

## Le Flux Complet (ce qui se passe vraiment)

### 1. Création du processus

```rust
Command::new("java")
    .args(["-jar", "server.jar"])
    .stdin(Stdio::piped())   // ← Crée un pipe stdin
    .stdout(Stdio::piped())  // ← Crée un pipe stdout
    .stderr(Stdio::piped())  // ← Crée un pipe stderr
    .spawn()                 // ← Lance le processus
```

### 2. Après le spawn

Ton application a maintenant :
- Un "handle" vers **stdin** du serveur (pour écrire)
- Un "handle" vers **stdout** du serveur (pour lire)
- Un "handle" vers **stderr** du serveur (pour lire)

### 3. Envoi d'une commande

```
stdin_handle.write("say Hello\n")
       │
       ▼
┌─────────────────┐         ┌─────────────────┐
│ Buffer PIPE     │────────►│ Serveur lit     │
│ "say Hello\n"   │         │ stdin           │
└─────────────────┘         └─────────────────┘
                                   │
                                   ▼
                            Exécute la commande
```

### 4. Lecture de la sortie

```
Le serveur affiche "[Server] Hello" dans sa console
       │
       ▼
┌─────────────────┐         ┌─────────────────┐
│ Serveur écrit   │────────►│ Buffer PIPE     │
│ stdout          │         │ "[Server] Hello"│
└─────────────────┘         └─────────────────┘
       │
       ▼
Ton appli lit le pipe → Envoie via WebSocket → Frontend
```

---

## Pourquoi pas `screen` ou `tmux` ?

| Avec screen/tmux | Avec subprocess/pipes |
|------------------|----------------------|
| Dépendance externe | Natif au système |
| Accès via terminal | Accès programmatique |
| Un seul utilisateur | Multi-utilisateurs |
| Pas d'API | Contrôle total via code |
| Logs dans un fichier | Logs en mémoire, temps réel |

---

## Résumé Simple

```
1. Tu crées un processus enfant avec des pipes
2. Tu gardes les "handles" des pipes
3. Pour envoyer une commande → Tu écris dans le pipe stdin
4. Pour lire les logs → Tu lis le pipe stdout en boucle
5. Les logs lus → Diffusés via WebSocket aux clients
```

**C'est exactement ce que font Crafty-4 et ce que tu feras en Rust !**
