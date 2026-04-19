---
name: human-approval
description: Queue d'approbation humaine. Utilise quand une action necessite validation de Lucas avant execution (email, message, modification client).
---

# Human Approval Queue

Utilise ce skill quand une action necessite validation de Lucas avant execution.

## Quand utiliser

- Avant d'envoyer un email (meme un draft)
- Avant de modifier un fichier client
- Avant toute action irreversible ou externe
- Avant d'envoyer un message a quelqu'un d'autre que Lucas

## Process

1. Prepare le draft ou l'action avec tous les details
2. Stocke dans /workspace/group/tasks/pending/{timestamp}-{action}.md
3. Envoie un message Telegram a Lucas via mcp__nanoclaw__send_message :

```
[APPROBATION REQUISE]
Action : {type d'action}
Details : {description courte}
Fichier : tasks/pending/{nom du fichier}

Reponds "ok" ou "valide" pour approuver.
```

4. NE PAS proceder sans reponse explicite de Lucas

## Format du fichier pending

```markdown
# Action en attente : {titre}

Date : {timestamp}
Type : {email_draft | file_edit | external_action | message}
Statut : EN ATTENTE

## Description
{ce qui sera fait}

## Contenu
{le draft complet ou les details de l'action}

## Destinataire (si applicable)
{qui recevra le message/email}
```

## Quand Lucas approuve

1. Deplace le fichier de tasks/pending/ vers tasks/approved/
2. Execute l'action
3. Confirme a Lucas que c'est fait

## Quand Lucas refuse

1. Deplace le fichier de tasks/pending/ vers tasks/rejected/
2. Confirme a Lucas que c'est annule
