# n8n-nodes-devises

Un nœud communautaire n8n pour convertir un prix dans plusieurs devises à la fois, à partir de l’API gratuite [Frankfurter](https://frankfurter.dev/).

Aucune clé API n’est nécessaire.

## Fonctionnalités

- Choisir une devise de départ dans une liste actualisée par Frankfurter.
- Saisir un prix à convertir.
- Ajouter plusieurs devises de sortie.
- Obtenir un élément n8n par devise cible.
- Consulter le dernier taux disponible ou un taux historique à une date donnée.

## Exemple

Avec les paramètres suivants :

- Devise de départ : `EUR`
- Prix : `100`
- Devises cibles : `USD`, `GBP`, `JPY`

Le nœud renvoie trois éléments : un pour le dollar américain, un pour la livre sterling et un pour le yen japonais.

Chaque élément contient :

| Champ | Description |
| --- | --- |
| `date` | Date du taux utilisé |
| `from` | Devise de départ |
| `to` | Devise cible |
| `rate` | Taux de conversion |
| `amount` | Prix initial |
| `convertedAmount` | Prix converti |

## Installation locale avec Docker

### 1. Cloner le dépôt

```bash
git clone https://github.com/JeremyMeignan/devises.git
cd devises
