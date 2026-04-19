---
name: email-drafting
description: Tache matinale (8h30). Lit les emails non lus via Gmail, prepare des drafts de reponse, et demande validation a Lucas via human-approval.
---

# Email Drafting

Tache declenchee a 8h30 chaque matin, apres le briefing.

## Process

### Etape 1 : Lire les emails non lus

- Utilise les outils Gmail pour lister les emails non lus depuis hier soir
- Filtre : ignore les newsletters, notifications automatiques, spam, promotions

### Etape 2 : Identifier les emails qui meritent une reponse

Criteres :
- Email d'un client (Safe, Synapse, AZMK, BistroBiz, etc. - voir ~/.claude/client-registry.md)
- Email d'un membre de l'équipe Safe (voir ~/agency-os/teams/safe.md) ou Miura (~/agency-os/teams/miura.md)
- Email professionnel qui attend une action de Lucas
- Ignorer : newsletters, notifications GitHub/Notion/Slack, promotions

### Etape 3 : Rediger les drafts

Pour chaque email identifie :
1. Redige un draft de reponse
2. Ton : R8 anti-slop (registre courant, pro, pas academique)
3. Accents francais obligatoires (R7)
4. Pas de tiret cadratin
5. Concis : repondre au point, pas de blabla

### Etape 4 : Human approval

Pour chaque draft :
1. Stocke dans /workspace/group/tasks/pending/{timestamp}-email-{sujet-court}.md
2. Envoie un message WhatsApp a Lucas :

```
[DRAFT EMAIL]
A : {destinataire}
Sujet : {sujet}
Resume : {1 ligne}

Fichier : tasks/pending/{nom}
Reponds "ok" pour valider ou "non" pour annuler.
```

## Regles

- Ne JAMAIS envoyer un email sans validation de Lucas (R3)
- Ne JAMAIS repondre a des emails de clients CF depuis un contexte Safe (R2)
- Si aucun email ne merite de reponse : ne rien faire, pas de notification
