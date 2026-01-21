# 🌬️ Mistral AI : Design System & UI Patterns

Ce document récapitule les standards visuels et interactifs inspirés par l'interface de Mistral AI.

## 1. Principes Fondamentaux
- **Clarté Technique :** Pas de fioritures, chaque élément a une fonction.
- **Vitesse Perçue :** Les transitions doivent être instantanées (< 200ms).
- **Sobriété :** Utilisation de l'espace vide pour focaliser l'attention sur le texte.

## 2. Palette de Couleurs
| Élément | Code Hex | Usage |
| :--- | :--- | :--- |
| **Background** | `#000000` | Fond principal |
| **Surface** | `#111111` | Cartes et conteneurs |
| **Accent** | `#FF591E` | Boutons d'action, liens |
| **Text Primary**| `#FFFFFF` | Titres et corps de texte |
| **Text Muted** | `#A1A1AA` | Métadonnées et labels |

## 3. Typographie
- **Titres :** `Inter`, Semi-bold, Letter-spacing: -0.02em.
- **Code/IA :** `JetBrains Mono` ou `Roboto Mono`.
- **Corps :** `Inter`, Regular, Line-height: 1.6.

## 4. Animations & Micro-interactions

### A. Chargement de Recherche (Search State)
L'input de recherche utilise un état "Loading" caractérisé par :
- Un contour pulsé aux couleurs de la marque.
- Un placeholder animé : "Mistral réfléchit..." avec une opacité oscillant entre 0.4 et 1.

### B. Skeleton Screens
Utilisez des blocs gris arrondis avec une animation de balayage de dégradé :
```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.skeleton {
  background: linear-gradient(90deg, #111 25%, #222 50%, #111 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
```

### C. Streaming de Texte
Le texte ne doit pas apparaître d'un bloc. Il doit être "injecté" mot par mot avec une légère transition d'opacité (fade-in) pour réduire la fatigue visuelle.

### D. Composants UI Clés
- Boutons : Angles vifs ou très légèrement arrondis (radius: 4px).
- Bordures : Très fines (1px) avec une couleur #27272A.