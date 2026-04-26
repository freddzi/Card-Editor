#!/usr/bin/env python3
"""Insert new game_docs entries (keywords, effects, abilities) into Supabase."""

import json, urllib.request, urllib.error

URL  = "https://uofhyrawyjhqbdztagae.supabase.co/rest/v1"
KEY  = ("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
        ".eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZmh5cmF3eWpocWJkenRhZ2FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MTgwMDEsImV4cCI6MjA5MjA5NDAwMX0"
        ".ihOsMlG6LBe71Ta13T1Pomzv38zX3Vw8YIw9Pn2FfjU")
HDRS = {"apikey": KEY, "Authorization": f"Bearer {KEY}",
        "Content-Type": "application/json", "Prefer": "return=minimal"}

# Hämta befintliga titlar för att undvika dubbletter
req = urllib.request.Request(f"{URL}/game_docs?select=title", headers=HDRS)
existing = {d["title"] for d in json.loads(urllib.request.urlopen(req).read())}
print(f"Befintliga docs: {len(existing)}")

new_docs = [
    # ── Nya keywords ─────────────────────────────────────────────────────────
    {"category":"keyword","title":"STUN","tags":"combat,restriction",
     "body":"Minionen är bedövad och kan varken attackera eller blockera under sin bedövade tur.\nSTUN löser sig i slutet av ägarens tur."},
    {"category":"keyword","title":"SCARE","tags":"combat,control",
     "body":"Minionen skrämmer fiender vid kontakt — det skrämda målet tvingas till BACK_LINE och kan inte attackera den turen.\nSCARE triggar vanligen on_attack eller passivt (first_attacker)."},
    {"category":"keyword","title":"GUARDIAN","tags":"defense,combat",
     "body":"Minionen kan blockera attacker riktade mot din core även från BACK_LINE.\nFiender måste slå igenom GUARDIAN-minionen för att nå din core."},
    {"category":"keyword","title":"STEALTH","tags":"evasion,offense",
     "body":"Minionen kan inte väljas som mål av motspelaren tills den attackerar eller påverkar en fiende.\nSTEALTH bryts när minionen delar ut skada."},
    {"category":"keyword","title":"CANT_BLOCK","tags":"combat,restriction",
     "body":"Minionen kan inte användas som blocker. Kan fortfarande attackera och använda aktiverade förmågor."},
    {"category":"keyword","title":"CONSUME","tags":"combat,sustain",
     "body":"När minionen dödar en fiendeminion äter den upp den och får dess attack- och/eller HP-värden.\neffect_arg styr vilka stats som absorberas."},

    # ── Nya effects — Skada & AOE ────────────────────────────────────────────
    {"category":"effect","title":"aoe_damage_wave","tags":"damage,aoe",
     "body":"Delar ut skada till flera grupper i en våg.\neffect_value = skada till primär grupp (ex attackerare).\neffect_arg kan ange extra grupper: friendly_value och core_value.\nEx: Magma Tsunami — 3 till alla attacker, 2 till egna, 1 till core."},
    {"category":"effect","title":"damage_and_cant_block","tags":"damage,control",
     "body":"Delar ut X skada till ett mål och förhindrar det från att blockera den aktuella turen.\neffect_value = skada. target_mode = any_minion."},
    {"category":"effect","title":"on_death_splash","tags":"damage,deathrattle",
     "body":"Fäster ett emblem på en minion. När den minionen dör delar effekten ut X skada till närmaste mål.\neffect_value = splash-skada. effect_arg = splash:closest."},

    # ── Nya effects — Kortdrag & Mana ────────────────────────────────────────
    {"category":"effect","title":"draw_random_spell","tags":"card-draw,spell",
     "body":"Lägger till ett slumpmässigt spell från ditt deck i handen utan att dra det normalt.\neffect_value = antal spells att lägga till."},
    {"category":"effect","title":"draw_next_turn","tags":"card-draw",
     "body":"Spelaren drar X extra kort i sin nästa DRAW-fas.\neffect_value = antal extra kort."},
    {"category":"effect","title":"gain_mana","tags":"mana,resource",
     "body":"Ger spelaren X extra mana direkt.\neffect_arg kan begränsa till \"this_turn\" eller \"next_turn\"."},
    {"category":"effect","title":"pay_life_reduce_cost","tags":"mana,life",
     "body":"Spelaren förlorar X HP och alla kort kostar 1 mana mindre resten av turen.\neffect_value = HP-kostnad. effect_arg = cost_reduction:1,this_turn."},

    # ── Nya effects — Healing & Sustain ─────────────────────────────────────
    {"category":"effect","title":"sacrifice_minion_heal","tags":"healing,sacrifice",
     "body":"Offrar en vänlig minion och ger spelaren X HP.\neffect_value = HP att återfå. target_mode = friendly_minion."},

    # ── Nya effects — Buffar & Debuffar ─────────────────────────────────────
    {"category":"effect","title":"buff_stats","tags":"buff",
     "body":"Ger en minion +X attack och +Y HP permanent.\neffect_value = attack-buff. effect_arg = +A/+H-format."},
    {"category":"effect","title":"buff_attack_temporary","tags":"buff,temporary",
     "body":"Ger en minion +X attack som varar en begränsad tid.\neffect_arg kan ange \"dies_after_turn\" (minionen dör efter turen) eller \"fire\" (skadeflagg)."},
    {"category":"effect","title":"buff_attack_reduce_hp","tags":"buff,risk",
     "body":"Ger en minion +X attack men sätter dess HP till 1.\neffect_value = attack-buff. effect_arg = set_hp:1."},
    {"category":"effect","title":"buff_attackers","tags":"buff,combat",
     "body":"Ger alla egna attackerande minions +X attack denna tur.\neffect_value = attack-buff. target_mode = all_friendly_attackers."},
    {"category":"effect","title":"buff_tribe_attack","tags":"buff,tribal",
     "body":"Ger alla egna minions av en viss subtyp +X attack.\neffect_value = attack-buff. effect_arg = subtype:<typ>."},
    {"category":"effect","title":"debuff_stats","tags":"debuff",
     "body":"Ger en minion -X attack och -Y HP som en aura (permanent tills kortet försvinner).\neffect_value = attack-debuff. effect_arg = -A/-H,aura."},
    {"category":"effect","title":"recurring_debuff","tags":"debuff,dot",
     "body":"Ger en minion -X/-X i attack och HP i slutet av varje tur.\neffect_value = mängd per tur. effect_arg = per_turn."},

    # ── Nya effects — Vanish & Rörelse ───────────────────────────────────────
    {"category":"effect","title":"vanish_and_damage","tags":"vanish,damage",
     "body":"Tar bort en minion från fältet (den återkommer nästa tur) och delar ut X skada till ett annat mål.\neffect_value = skada. effect_arg anger skademålet."},
    {"category":"effect","title":"vanish_cleanse","tags":"vanish,cleanse",
     "body":"Tar bort en vänlig minion från fältet tillfälligt. När den återvänder tas alla debuffar och curses bort.\neffect_value = antal turer borta."},
    {"category":"effect","title":"vanish_to_lantern","tags":"vanish,structure",
     "body":"Tar bort en minion och spawnar en 0/4-struktur på FRONT_LINE i dess ställe.\nNär strukturen förstörs återkommer minionen.\ntarget_mode = any_minion."},
    {"category":"effect","title":"skip_turn_vanish","tags":"vanish,control",
     "body":"Spelaren hoppar över sin tur. Alla egna minions vanishar och återkommer nästa tur. Spelaren tar ingen skada under hoppad tur.\neffect_arg = immune_damage."},
    {"category":"effect","title":"bounce_attackers","tags":"bounce,control",
     "body":"Skickar tillbaka alla fiendeattackerare till motståndarens hand.\ntarget_mode = all_enemy_attackers."},

    # ── Nya effects — Spawn & Nekromans ─────────────────────────────────────
    {"category":"effect","title":"spawn_tokens","tags":"spawn,tokens",
     "body":"Spawnar X tokens med specificerade stats på fältet.\neffect_value = antal tokens. effect_arg = attack/hp/namn/flaggor."},
    {"category":"effect","title":"resurrect_dead_this_turn","tags":"resurrect,necro",
     "body":"Alla minions som dog under denna tur återkommer till ägarens BACK_LINE.\ntarget_mode = self (påverkar alla egna döda den turen)."},
    {"category":"effect","title":"banish_grave_spawn","tags":"grave,spawn",
     "body":"Tar bort X slumpmässiga minions från fiendens gravhög permanent och spawnar ett Skeleton per borttagen minion.\neffect_value = antal. effect_arg = spawn:<stats/typ>."},
    {"category":"effect","title":"mass_reanimate_as_spirit","tags":"grave,spawn,buff",
     "body":"Tar bort X minions från den egna gravhögen och spawnar en kraftfull Spirit-minion. Ger dessutom +1 attack till alla egna minions.\neffect_value = antal från graven. effect_arg = spawn:<stats> och buff."},
    {"category":"effect","title":"on_death_spawn_spirit","tags":"deathrattle,spawn",
     "body":"Fäster en deathrattle på en vänlig minion. När den dör spawnas en Spirit med angivna stats och RAPID.\neffect_arg = spawn:<stats/typ>/RAPID."},
    {"category":"effect","title":"sacrifice_tribe_buff_hp","tags":"sacrifice,buff,tribal",
     "body":"Offrar alla egna minions av en viss subtyp och ger en vänlig minion +HP lika med antal offrade (max X).\neffect_arg = subtype:<typ>,max:<X>."},
    {"category":"effect","title":"sacrifice_tribe_draw","tags":"sacrifice,card-draw,tribal",
     "body":"Dödar alla egna minions av en viss subtyp och drar ett kort per dödad.\neffect_arg = subtype:<typ>."},
    {"category":"effect","title":"shuffle_tribe_on_death","tags":"grave,shuffle,tribal",
     "body":"Alla minions av en viss subtyp som dör denna tur blandas tillbaka i decket istället för att gå till graven.\neffect_arg = subtype:<typ>,this_turn."},

    # ── Nya effects — Kontroll & Special ────────────────────────────────────
    {"category":"effect","title":"clone_minion","tags":"copy,spawn",
     "body":"Kopierar en minion och lägger kopian på ditt fält. Kopians stats sätts till angivet värde.\neffect_arg = set_stats:A/H."},
    {"category":"effect","title":"destroy_structure","tags":"removal,structure",
     "body":"Förstör omedelbart en vald struktur.\ntarget_mode = any_structure."},
    {"category":"effect","title":"transform_minion","tags":"transform,removal",
     "body":"Förvandlar en minion med X eller lägre attack till en ny minion med angivna stats.\neffect_arg = max_attack:<X>,into:<A>/<H>/<Namn>."},
    {"category":"effect","title":"force_attack_hero","tags":"control,combat",
     "body":"Tvingar en fiendeминion att attackera din hero nästa attackfas istället för att välja mål fritt.\ntarget_mode = enemy_minion."},
    {"category":"effect","title":"cant_block","tags":"control,combat",
     "body":"Förhindrar en minion från att blockera under sin nästa blockfas.\neffect_value = antal turer. target_mode = enemy_minion."},
    {"category":"effect","title":"trap_minion","tags":"trap,control",
     "body":"Låser en minion i en fälla i X turer. Om minionen dör i fällan spawnas en Spectre för dig.\neffect_value = turer. effect_arg = on_death_spawn:<stats/typ>/friendly."},
    {"category":"effect","title":"lock_then_release","tags":"control,buff",
     "body":"Låser en minion i X turer, sedan får den +3/+3 och tvingas attackera din core.\neffect_value = låsturer. effect_arg = buff:3/3,force_attack_core."},
    {"category":"effect","title":"give_stealth","tags":"stealth,evasion",
     "body":"Ger en vänlig minion STEALTH i X turer — kan inte väljas som mål av motspelaren.\neffect_value = antal turer."},
    {"category":"effect","title":"give_spell_absorb","tags":"protection,magic",
     "body":"Ger en vänlig minion SPELL_ABSORB — nästa spell som riktas mot minionen absorberas och nekas.\ntarget_mode = friendly_minion."},
    {"category":"effect","title":"punish_card_play","tags":"control,damage",
     "body":"Nästa tur tar fienden X skada för varje kort de spelar.\neffect_value = skada per kort. effect_arg = per_card,next_turn."},
    {"category":"effect","title":"conditional_spawn","tags":"spawn,conditional",
     "body":"Spawnar en kraftfull minion om ett villkor är uppfyllt (ex spelaren är under X HP).\neffect_arg = condition:<typ>:<värde>,spawn:<A>/<H>/<Namn>/<keyword>."},
    {"category":"effect","title":"absorb_convert_to_attack","tags":"defense,buff",
     "body":"Absorberar all inkommande skada till en vänlig minion under en tur och ger den lika mycket i attackbuff nästa tur.\ntarget_mode = friendly_minion."},
    {"category":"effect","title":"stasis_minion","tags":"protection,stasis",
     "body":"Sätter en skadad minion till 1 HP och gör den omöjlig att attackera tills ägarens nästa tur.\neffect_value = HP att sätta. effect_arg = untargetable."},
    {"category":"effect","title":"survive_lethal","tags":"protection,combat",
     "body":"Om en vänlig minion tar exakt dödlig skada (skada = nuvarande HP) överlever den med 1 HP den turen.\neffect_arg = condition:exact_lethal."},
    {"category":"effect","title":"core_trap","tags":"defense,damage",
     "body":"Din core tar max 1 skada per attacker denna tur. Dessutom tar alla attackerande fiender X skada som svar.\neffect_value = svarsskada. effect_arg = max_core_damage:1,retaliate_all_attackers."},

    # ── Nya ability-triggers ─────────────────────────────────────────────────
    {"category":"ability","title":"on_damage","tags":"trigger,reactive",
     "body":"Förmågan triggar när minionen tar skada (oavsett källa)."},
    {"category":"ability","title":"on_kill","tags":"trigger,combat",
     "body":"Förmågan triggar när minionen dödar en annan minion i strid."},
    {"category":"ability","title":"on_core_hit","tags":"trigger,combat",
     "body":"Förmågan triggar när minionen träffar motståndarens core direkt."},
    {"category":"ability","title":"on_deal_damage","tags":"trigger,damage",
     "body":"Förmågan triggar varje gång minionen delar ut skada (inkl. ability-skada)."},
    {"category":"ability","title":"on_draw","tags":"trigger,card-draw",
     "body":"Förmågan triggar när kortens ägare drar ett kort."},
    {"category":"ability","title":"on_tribe_death","tags":"trigger,tribal",
     "body":"Förmågan triggar när en vänlig minion av en specifik subtyp dör.\nability_arg = subtype:<typ>."},
    {"category":"ability","title":"on_survive_turn","tags":"trigger,endurance",
     "body":"Förmågan triggar om minionen överlever till slutet av ägarens tur (den var vid liv vid turstarten och levde kvar)."},
    {"category":"ability","title":"passive","tags":"trigger,passive",
     "body":"Förmågan är alltid aktiv och kräver ingen trigger.\nGäller konstant så länge minionen/strukturen är på fältet."},

    # ── Nya ability-effekter ─────────────────────────────────────────────────
    {"category":"ability","title":"return_to_hand","tags":"bounce,defense",
     "body":"Skickar minionen tillbaka till ägarens hand.\nAnvänds vanligen med trigger on_damage eller on_attack.\nAll buffar som applicerats på fältet försvinner."},
    {"category":"ability","title":"vanish_after_attack","tags":"vanish,evasion",
     "body":"Minionen försvinner från fältet efter sin attack och återkommer i BACK_LINE i nästa tur.\nability_arg = duration:1_turn."},
    {"category":"ability","title":"phantom_damage","tags":"damage,piercing",
     "body":"Minionen delar ut X skada som \"phantom\" — skadan beräknas separat och kan penetrera visst försvar.\nability_value = phantomskada."},
    {"category":"ability","title":"swap_sides","tags":"control,combat",
     "body":"Om minionen överlever sin attack byter den och målet sida — de kontrolleras nu av respektive motståndare.\nability_arg = condition:self_survives."},
    {"category":"ability","title":"consume","tags":"combat,growth",
     "body":"När minionen dödar en fiende äter den upp dem och absorberar stats.\nability_arg styr vilka stats som tas (attack/health/both)."},
    {"category":"ability","title":"tribe_buff_attack","tags":"passive,buff,tribal",
     "body":"Passiv aura: minionen får +X attack per vänlig minion av viss subtyp på fältet.\nability_arg = subtype:<typ>,max:<X>."},
    {"category":"ability","title":"give_stealth","tags":"stealth,evasion",
     "body":"Ger minionen STEALTH under en angiven period (ex denna attack).\nability_trigger = on_attack → aktiv under attackfasen."},
    {"category":"ability","title":"reduce_spell_cost","tags":"passive,mana,spell",
     "body":"Passiv aura: spells i ägarens hand kostar X mana mindre.\nability_value = kostnadsreduktion."},
    {"category":"ability","title":"gain_mana","tags":"mana,resource",
     "body":"Ger spelaren X extra mana.\nKan triggas av on_attack, on_core_hit, on_draw, on_tribe_death etc.\nability_arg kan ange \"next_turn\" eller \"extra\"."},
    {"category":"ability","title":"heal_on_kill","tags":"sustain,combat",
     "body":"Minionen återfår X HP varje gång den dödar en fiende i strid.\nability_value = HP att återfå."},
    {"category":"ability","title":"aoe_damage","tags":"damage,aoe",
     "body":"Delar ut X skada till alla mål i en grupp (ex all_enemy_minions).\nability_trigger anger när effekten utlöses.\nability_target_mode anger gruppen."},
    {"category":"ability","title":"buff_attack_if_first","tags":"buff,combat,conditional",
     "body":"Om minionen är den första att attackera denna tur får den +X attack under turen.\nability_arg = condition:first_attacker,duration:1_turn."},
    {"category":"ability","title":"dies_after_damage","tags":"sacrifice,aggressive",
     "body":"Minionen dör omedelbart efter att den delar ut skada (oavsett om den träffas tillbaka).\nability_trigger = on_deal_damage."},
    {"category":"ability","title":"draw_card","tags":"card-draw",
     "body":"Drar X kort från decket.\nability_trigger anger när draget sker (ex on_tribe_death, on_core_hit)."},
    {"category":"ability","title":"spawn_mine","tags":"spawn,trap,structure",
     "body":"Spawnar en 0/1-struktur (mina) i FRONT_LINE. Minan attackerar den första angriparen och delar ut X skada.\nability_value = skada. ability_arg = stats/typ/beteende."},
    {"category":"ability","title":"fear_to_backline","tags":"control,fear",
     "body":"Tvingar alla fiendeминions att dra sig tillbaka till BACK_LINE och förlora sin attackdeklaration.\nability_trigger = on_attack. ability_target_mode = all_enemy_minions."},
    {"category":"ability","title":"block_cost","tags":"evasion,cost",
     "body":"Motspelaren måste betala X mana för att blockera den här minionen.\nOm motspelaren inte kan eller vill betala kan minionen inte blockas.\nability_value = manakostnad."},
    {"category":"ability","title":"shock_aura","tags":"damage,aura,combat",
     "body":"Alla fiender som möter minionen i strid tar X skada innan slag löses.\nability_value = preshock-skada."},
    {"category":"ability","title":"grab","tags":"control,combat",
     "body":"Om minionen delar ut skada till ett mål som överlever kan det målet inte blockera under resten av attackfasen.\nability_trigger = on_deal_damage. ability_arg = condition:target_survives."},

    # ── Structure ability-ids ────────────────────────────────────────────────
    {"category":"ability","title":"resurrect_weakened","tags":"resurrect,structure",
     "body":"När en vänlig minion med X eller fler attack dör återkommer den i BACK_LINE med 1 attack och 1 HP.\ntrigger_value = min attack-krav. ability_arg = new_attack:1."},
    {"category":"ability","title":"deny_mana_gain","tags":"control,mana,structure",
     "body":"Passiv: Fienden kan inte tjäna extra mana från korteffekter eller triggers.\nPåverkar inte det naturliga manasystemet (tur+1)."},
    {"category":"ability","title":"self_destroy_spawn","tags":"structure,spawn,conditional",
     "body":"Strukturen förstör sig själv och spawnar en kraftfull enhet när ett räknarvillkor uppfylls (ex 5 döda på en tur).\ntrigger_value = count-gräns. ability_arg = spawn:<stats/typ>,count_per_turn."},
    {"category":"ability","title":"force_kill_own_minion","tags":"control,structure",
     "body":"Var N:e tur tvingas fienden döda en av sina egna minions.\ntrigger_value = N (turfrekvens). ability_arg = target:enemy."},
    {"category":"ability","title":"spawn_token","tags":"spawn,structure,trigger",
     "body":"Spawnar en token när en specifik trigger sker.\nability_arg = attack/hp/namn/keywords för token."},
    {"category":"ability","title":"move_to_backline","tags":"movement,structure",
     "body":"En attackerande vänlig minion placeras i BACK_LINE direkt efter sin attack (istället för att stanna i FRONT_LINE).\ntrigger = on_friendly_attack."},
    {"category":"ability","title":"vanish_and_spawn","tags":"vanish,spawn,structure",
     "body":"När en vänlig minion dör vanishar den (försvinner permanent) och en ny token spawnas i hennes ställe.\nability_arg = spawn:<stats/typ>."},
    {"category":"ability","title":"vanish_spawn_undead","tags":"vanish,spawn,structure",
     "body":"När ägaren drar en minion vanishar den kortet och spawnar ett Undead-kort med angivna stats istället.\nability_arg = spawn:<stats/typ>."},
    {"category":"ability","title":"block_flying_core_attack","tags":"defense,structure",
     "body":"Passiv: FLYING-minions kan inte attackera ägarens core. De kan fortfarande attackera minions."},
    {"category":"ability","title":"grow_then_spawn","tags":"structure,passive,spawn",
     "body":"Strukturen kan inte repareras. Varje tur läggs 1 armor till. När armor når max förstörs strukturen och spawnar en kraftfull minion.\ntrigger_value = max armor. ability_arg = add_defense:1,spawn:<stats/typ>."},
    {"category":"ability","title":"aura_enemy_debuff","tags":"aura,debuff,structure",
     "body":"Passiv aura: alla fiendeминions på fältet får -X i en stat (attack eller HP).\nability_arg = stat:<stat>,value:<X>."},
    {"category":"ability","title":"reveal_card","tags":"information,structure",
     "body":"Varje gång fienden drar ett kort avslöjas det kortet för ägaren.\ntrigger = on_enemy_draw."},
    {"category":"ability","title":"protect_backline_retaliate","tags":"defense,damage,structure",
     "body":"Egna minions i BACK_LINE tar X mindre skada. Dessutom tar den första attackeraren X skada som retaliation.\nability_value = skademinskning och retaliationskada."},
    {"category":"ability","title":"scare_no_damage","tags":"control,scare,structure",
     "body":"Den första fiendeminion som attackerar varje tur blir SCARE:ad — skrämd till BACK_LINE och delar ut 0 skada denna attack.\ntrigger = on_first_attacker."},
]

to_insert = [d for d in new_docs if d["title"] not in existing]
print(f"Nya att lägga till: {len(to_insert)}")

if to_insert:
    body = json.dumps(to_insert).encode()
    req = urllib.request.Request(f"{URL}/game_docs", data=body, headers=HDRS, method="POST")
    try:
        urllib.request.urlopen(req)
        print("OK — alla docs insatta")
    except urllib.error.HTTPError as e:
        print(f"ERROR: {e.code} {e.read().decode()[:400]}")
else:
    print("Inget att lägga till (allt finns redan)")
