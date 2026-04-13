---
name: health-check
description: Vérification régulière de tous les outils et connexions (MCP, WhatsApp, Gmail, Telegram, Docker, OneCLI). Diagnostique, tente de réparer, et documente les incidents pour apprentissage.
---

# Health Check - Verification des connexions

Tache declenchee toutes les 48h. Verifie que tous les composants du systeme fonctionnent.

## Composants a verifier

### 1. WhatsApp (Baileys)
```bash
# Verifier la connexion dans les logs recents
grep -c "Connected to WhatsApp" /workspace/project/logs/nanoclaw.log | tail -1
# Verifier les erreurs 440 (conflit session)
grep -c "reason.*440" /workspace/project/logs/nanoclaw.log
# Verifier le dernier message envoye
sqlite3 /workspace/project/store/messages.db "SELECT timestamp FROM messages WHERE is_from_me = 0 ORDER BY timestamp DESC LIMIT 1;"
```
Problemes connus :
- Code 440 = conflit avec un autre client Baileys (ancien MCP WA sur port 3456). Solution : tuer le process `pkill -f whatsapp-mcp`
- Deconnexion QR = re-scanner. Prevenir Lucas.

### 2. Telegram
```bash
# Verifier les messages recents
sqlite3 /workspace/project/store/messages.db "SELECT timestamp FROM messages WHERE chat_jid LIKE 'tg:%' ORDER BY timestamp DESC LIMIT 1;"
```
Problemes connus : aucun pour l'instant.

### 3. Gmail
```bash
# Tester l'acces Gmail en listant les derniers emails
# Si erreur auth : le token OAuth a expire, prevenir Lucas pour re-authentifier
```
Problemes connus :
- Token expire = relancer `/add-gmail` dans Claude Code (terminal ~/nanoclaw/)

### 4. Docker
```bash
# Verifier que Docker tourne
docker info > /dev/null 2>&1 && echo "OK" || echo "DOCKER DOWN"
```
Problemes connus :
- Docker Desktop crash = relancer l'app. Prevenir Lucas.

### 5. OneCLI
```bash
# Verifier le gateway
curl -s http://127.0.0.1:10254/health 2>/dev/null || echo "ONECLI DOWN"
```
Problemes connus :
- Gateway down = `onecli` doit etre relance. Prevenir Lucas.

### 6. Taches scheduled
```bash
# Verifier que toutes les taches sont actives
sqlite3 /workspace/project/store/messages.db "SELECT id, status, next_run FROM scheduled_tasks WHERE status != 'active';"
# Verifier les echecs recents
sqlite3 /workspace/project/store/messages.db "SELECT task_id, status, created_at FROM task_run_logs WHERE status = 'error' ORDER BY created_at DESC LIMIT 5;"
```

### 7. Espace disque
```bash
df -h / | tail -1
# Alerter si < 10 Gi libres
```

## Process de verification

### Etape 1 : Executer tous les checks
Lancer chaque verification. Collecter les resultats.

### Etape 2 : Classifier
Pour chaque composant :
- OK : rien a faire
- DEGRADE : fonctionne mais avec des erreurs (ex: 440 WhatsApp)
- DOWN : ne fonctionne plus

### Etape 3 : Tenter de reparer (si possible)
- Problemes que tu peux reparer toi-meme : tuer un process, relancer un service
- Problemes qui necessitent Lucas : re-scanner QR, re-auth OAuth, relancer Docker Desktop

### Etape 4 : Rapport
Envoyer sur Telegram :
```
[HEALTH CHECK - {date}]

OK : {liste des composants OK}
DEGRADE : {composant} - {probleme} - {action prise ou a prendre}
DOWN : {composant} - {probleme} - ACTION REQUISE : {ce que Lucas doit faire}
```

Ne rien envoyer si tout est OK (sauf si c'est le premier check apres un incident).

### Etape 5 : Apprentissage
Apres chaque incident resolu :
1. Documenter dans /workspace/group/health/incidents.md :
   - Date
   - Composant
   - Symptome
   - Cause racine
   - Solution appliquee
   - Temps de resolution
   - Prevention : ce qu'on peut faire pour eviter que ca se reproduise

2. Si un pattern se repete (meme incident 3+ fois) :
   - Creer un script de reparation automatique
   - Ajouter le script dans le pre-check de la tache health-check
   - Mettre a jour ce SKILL.md avec le nouveau probleme connu

## Regles

- Ne JAMAIS supprimer de donnees pour "reparer" un probleme
- Si tu n'es pas sur de la cause : documenter et escalader a Lucas
- Toujours tenter le diagnostic avant de demander a Lucas
- Accents francais obligatoires
