# n8n-nodes-devises

Un nœud communautaire n8n pour convertir un prix dans plusieurs devises à la fois, à partir de l’API gratuite [Frankfurter](https://frankfurter.dev/).

Aucune clé API n’est nécessaire.

## Fonctionnalités

- Saisir un code de devise de départ, par exemple `EUR`.
- Saisir un prix à convertir.
- Ajouter plusieurs devises cibles séparées par des virgules, par exemple `USD, GBP, JPY`.
- Obtenir un élément n8n par devise cible et par date.
- Consulter le taux d'un jour précis ou récupérer des valeurs étalées sur une période.

## Valeurs sur une période

Les champs `Start Date` et `End Date` permettent de récupérer les taux de change
sur une période complète. Les dates peuvent être saisies au format `DD/MM/YYYY`
ou `YYYY-MM-DD`.

Exemple :

- Date de début : `12/09/2025`
- Date de fin : `12/09/2026`

Le nœud interroge l'API Frankfurter pour chaque date disponible dans cette
période et renvoie un élément n8n pour chaque date et chaque devise cible.

Si seule la date de début est renseignée, le nœud renvoie le taux de cette
date. Si les deux dates sont vides, la date du jour est utilisée.

## Exemple

Avec les paramètres suivants :

- Devise de départ : `EUR`
- Prix : `100`
- Devises cibles : `USD, GBP, JPY`
- Date de début : `12/09/2025`
- Date de fin : `12/09/2026`

Pour une seule date, le nœud renvoie trois éléments : un pour le dollar
américain, un pour la livre sterling et un pour le yen japonais. Pour une
période, il renvoie ces mêmes devises pour chaque date disponible.

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
