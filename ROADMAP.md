# Alfred Brain - Roadmap

> Objectif : reproduire un Brain Kit (Alexandra Kassis) adapte a l'activite de Lucas.
> But final : Lucas est dans le monde reel, devant un ecran le moins possible. Alfred gere l'operationnel en autonomie, Lucas ne fait que valider et decider.

## Status : Niveau 0 - Deploye (2026-03-30)

- Alfred daemon 24/7 (WhatsApp + Telegram + Gmail)
- KG : 121 entites/relations (clients, equipe, systemes, decisions)
- 3 crons : briefing 7h, sleep 2h, email drafting 8h30
- Human approval queue (cree, pas encore teste en conditions reelles)
- agency-os monte en lecture seule

---

## Niveau 1 - Cerveau reactif (semaine 1-2)

Passer de "3 crons fixes" a "Alfred reagit aux evenements".

| # | Feature | Ce que ca fait | Effort | Statut |
|---|---|---|---|---|
| 1.0 | Webhook server HTTP | Endpoint generique POST /webhooks/:source, registry de handlers, HMAC-SHA256 | 0.5j | FAIT (2026-04-08) |
| 1.1 | Polling Notion projets | Poll Notion DB toutes les 15 min, detecte changements statut, notif Telegram | 0.5j | FAIT (2026-04-12) |
| 1.2 | Triage emails urgent | Classification urgence (client connu, mots-cles), tag prioritaire dans notif | 0.5j | FAIT (2026-04-12) |
| 1.3 | Scan inactivite projets | Lundi 9h : projets inactifs 5j+ -> notif Telegram recap | 0.5j | FAIT (2026-04-12) |
| 1.4 | Suivi post-webinaire | Mercredi 10h : compile stats du webi, envoie mini-rapport WhatsApp | 0.5j | - |

## Niveau 2 - Cerveau specialise (semaine 3-4)

Alfred comprend le metier de Lucas.

| # | Feature | Ce que ca fait | Effort |
|---|---|---|---|
| 2.1 | Skill audit funnel | Analyse KPIs client, compare benchmarks Safe, produit diagnostic | 1j |
| 2.2 | Resume call Fathom | Webhook temps reel via 1.0 (remplace polling Fireflies). Notif Telegram + MAJ memory.md client (v2) | 0.5j | FAIT notification (2026-04-08), MAJ memory a faire |
| 2.3 | Skill retroplanning | Nouveau projet -> retroplanning auto base sur type de funnel | 0.5j |
| 2.4 | Weekly report | Vendredi 17h : rapport hebdo agence | 0.5j |

## Niveau 3 - Cerveau auto-ameliorant (mois 2)

Alfred apprend de ses erreurs.

| # | Feature | Ce que ca fait |
|---|---|---|
| 3.1 | Feedback loop | Correction Lucas -> regle dans CLAUDE.md pour ne plus refaire l'erreur |
| 3.2 | Memoire procedurale | Detecte patterns recurrents, propose de les automatiser |
| 3.3 | Scoring de pertinence | Briefing s'ameliore : ignore 3x = deprioritise, action = prioritise |
| 3.4 | Auto-nettoyage KG | Sleep consolidation detecte entites obsoletes, archive, fusionne doublons |

## Niveau 4 - Cerveau multi-agent (mois 3+)

| # | Feature | Ce que ca fait |
|---|---|---|
| 4.1 | Agent copywriter | Container avec acces styles clients, redige premiers jets |
| 4.2 | Agent prospection | LinkedIn via lhremote, propose posts, gere outreach |
| 4.3 | Safe Team | Containers isoles pour Sam, PL, Paul K, Logan |

## Niveau 5 - Ambient computing (mois 6+)

- PWA mobile (remplace WhatsApp pour briefings)
- Voice input (Whisper pour vocaux)
- Vision (analyse images)
- Mac Mini dedie (cerveau permanent, laptop libre)

---

## Priorites par impact metier

| Rang | Feature | Pourquoi | Effort |
|---|---|---|---|
| 1 | Relances client auto (1.3) | Plus de deals oublies | 0.5j |
| 2 | Weekly report (2.4) | Visibilite agence sans effort | 0.5j |
| 3 | Resume call Fireflies (2.2) | Plus de notes oubliees | 1j |
| 4 | Veille emails continue (1.2) | Reactivite emails | 0.5j |
| 5 | Audit funnel auto (2.1) | Diagnostic client sans effort | 1j |
| 6 | Feedback loop (3.1) | Alfred s'ameliore seul | 0.5j |

## Rythme recommande

- Semaine 1 (actuelle) : stabiliser, observer les crons, corriger les erreurs
- Semaine 2 : Niveau 1 (relances auto + veille emails + webhooks Make)
- Semaine 3-4 : Niveau 2 (audit funnel + resume call + retroplanning)
- Mois 2 : Niveau 3 (feedback loop + memoire procedurale)
- Mois 3+ : Niveau 4-5 (multi-agent + voice)

---

## Documents de reference

- Deep dive Kassis : `~/.claude/deep-dives/alexandra-kassis-brain-kit-2026-03-29.md`
- Plan detaille : `~/.claude/deep-dives/plan-alfred-brain-levels-2026-03-30.md`
- Plan build initial : `~/.claude/plans/2026-03-29-nanoclaw-brain-cerveau-autonome.md`
- Memoire projet : `~/.claude/projects/-Users-lucas--claude/memory/nanoclaw-brain-project.md`
