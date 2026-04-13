---
name: sleep-consolidation
description: Tâche nocturne (2h00). Consolide les interactions de la journée directement dans les memory.md des clients concernés. Idempotent via tag horodaté.
---

# Sleep Consolidation

Tâche déclenchée à 2h00 chaque nuit quand Lucas dort. Le KG NanoClaw a été supprimé le 2026-04-13 ; cette tâche écrit désormais directement dans les `memory.md` clients via mécanisme idempotent.

## Process

### Étape 1 : Lire les nouvelles données

- Lis les conversations archivées dans `/workspace/group/conversations/` (fichiers modifiés depuis hier).
- Lis les fichiers récemment modifiés dans `/workspace/group/` (préférences, notes, etc.).

### Étape 2 : Identifier le client concerné

Pour chaque fait important découvert, identifier le client (slug) via :
- Mention explicite dans le texte (mapping aliases dans `/workspace/extra/os/.claude/CLAUDE.md` ou `~/.claude/client-registry.md`)
- Contexte de la conversation (numéro WhatsApp, group)

Si aucun client identifiable : skip le fait.

### Étape 3 : Écrire dans memory.md du client (idempotent)

Pour chaque fait à consolider, ouvrir `/workspace/extra/os/clients/{slug}/memory.md` et :

1. **Construire le tag d'idempotence** : `[alfred-obs YYYY-MM-DD HASH8]` où HASH8 = 8 premiers caractères du SHA-1 du fait normalisé (lowercase, espaces normalisés).
2. **Vérifier la présence** : `grep` du tag exact dans le fichier. Si présent : skip (déjà consolidé hier ou avant).
3. **Sinon, ajouter** dans la section `## Decisions recentes` (la créer si absente, juste avant `## Decisions structurantes` ou en fin de fichier) :
   ```
   - [alfred-obs YYYY-MM-DD HASH8] {fait factuel concis}
   ```

### Étape 4 : Maintenance mémoire

- Si le `CLAUDE.md` du groupe main dépasse 200 lignes : identifier les sections qui peuvent être déplacées dans des fichiers séparés.
- Si des conversations archivées ont plus de 7 jours : les déplacer dans `conversations/archived/`.
- Pour chaque `memory.md` touché : si la section `## Decisions recentes` dépasse 30 entrées `[alfred-obs ...]`, archiver les plus anciennes vers une sous-section `### Archive {mois}`.

## Format du fait

Un fait = une ligne factuelle, datée, sourcée si possible. Exemples :

- `[alfred-obs 2026-04-13 a3f9c4d2] Lucas a validé le briefing AZMK semaine 14`
- `[alfred-obs 2026-04-13 b7e1098f] Bryan Parry a demandé une LP pour son offre coaching`
- `[alfred-obs 2026-04-13 c2d4e8a1] Decision : passer Safe en equity (validation Sam attendue)`

## Règles

- **Idempotence absolue** : ne jamais écrire deux fois le même fait. Le tag `[alfred-obs DATE HASH8]` est la clé.
- Ne JAMAIS modifier ou supprimer une ligne existante avec un tag `[alfred-obs ...]`.
- Ne JAMAIS envoyer de messages ou modifier des funnels.
- En cas de doute sur un fait ou son client : le laisser intact, ne pas consolider.
- Loguer un résumé des actions dans `/workspace/group/tasks/sleep-log-{date}.md` (compteurs : N faits écrits, N skipped duplicate, N skipped no-client).
- Accents français obligatoires dans tous les textes écrits.
- Pas de tiret cadratin.
