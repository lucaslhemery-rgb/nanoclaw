---
name: briefing
description: Morning briefing quotidien. Compile agenda, emails, WhatsApp et points urgents. Envoie un resume concis sur WhatsApp a Lucas.
---

# Morning Briefing

Tache declenchee a 7h00 chaque matin. Compile un briefing concis du jour.

## Sources a consulter (dans cet ordre)

1. *Emails non lus* : cherche sur le web si tu as accès à Gmail, sinon skip
2. *Messages WhatsApp non lus* : lis la base SQLite pour les messages recents non traites
3. *Fichiers recents* : verifie si des fichiers ont ete modifies dans /workspace/group/ ou /workspace/extra/os/clients/
4. *Journaux projets actifs* : pour chaque client avec un projet en cours, lis la section `## Journal` de `/workspace/extra/os/clients/{slug}/projects/{projet}/project.md` (filtre les entrees des dernieres 48h)
5. *Decisions recentes clients* : si un projet a evolue, regarde `/workspace/extra/os/clients/{slug}/memory.md` section `## Decisions` pour le contexte

## Format du briefing

```
Briefing du {date}

PRIORITES
- {point 1}
- {point 2}

EMAILS (si disponible)
- {expediteur} : {sujet}

SIGNAUX
- {point d'attention ou opportunite}

CLIENTS (si news)
- {client} : {update bref}

Bonne journee.
```

## Regles

- Concis : 10-15 lignes max
- Faits uniquement, pas d'interpretation
- Si rien d'urgent : "RAS aujourd'hui, bonne journee."
- Ne JAMAIS envoyer d'emails ou de messages aux clients
- Accents francais obligatoires
- Pas de tiret cadratin
