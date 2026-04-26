#!/usr/bin/env python3
"""Patch all cards in Supabase with effect_ids, ability_ids, keywords."""

import json
import urllib.request
import urllib.error

URL  = "https://uofhyrawyjhqbdztagae.supabase.co/rest/v1"
KEY  = ("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
        ".eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZmh5cmF3eWpocWJkenRhZ2FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MTgwMDEsImV4cCI6MjA5MjA5NDAwMX0"
        ".ihOsMlG6LBe71Ta13T1Pomzv38zX3Vw8YIw9Pn2FfjU")
HDRS = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json", "Prefer": "return=minimal"}


def patch(table, card_id, data):
    url = f"{URL}/{table}?card_id=eq.{card_id}"
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, headers=HDRS, method="PATCH")
    try:
        urllib.request.urlopen(req)
        return True
    except urllib.error.HTTPError as e:
        print(f"  ERROR {table} {card_id}: {e.code} {e.read().decode()[:200]}")
        return False


def patch_cards(card_id, data):
    url = f"{URL}/cards?id=eq.{card_id}"
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, headers=HDRS, method="PATCH")
    try:
        urllib.request.urlopen(req)
        return True
    except urllib.error.HTTPError as e:
        print(f"  ERROR cards {card_id}: {e.code} {e.read().decode()[:200]}")
        return False


# ─────────────────────────────────────────────
# 1. KEYWORD FIXES on cards table
# ─────────────────────────────────────────────
print("=== 1. KEYWORD FIXES ===")
kw_updates = {
    "A00020": "SCARE",
    "A00021": "FLYING",
    "A00022": "RAPID",
    "A00067": "RAPID",
    "A00084": "STUN",
    "A00087": "FLYING",
    "A00091": "RAPID,STUN",
    "A00092": "RANGE",
    "A00095": "RANGE,GUARDIAN",
    "A00096": "RANGE",
    "A00098": "CANT_ATTACK,CANT_BLOCK",
    "A00111": "SCARE",
}
for cid, kw in kw_updates.items():
    ok = patch_cards(cid, {"keywords": kw})
    print(f"  {'OK' if ok else 'FAIL'} {cid} → keywords: {kw}")


# ─────────────────────────────────────────────
# 2. SPELL CARDS — effect_id, value, target_mode, effect_arg
# ─────────────────────────────────────────────
print("\n=== 2. SPELL CARDS ===")
spells = {
    "A00007": {"effect_id": "draw_random_spell",         "effect_value": 1,  "target_mode": "self",                "effect_arg": ""},
    "A00017": {"effect_id": "buff_attack_temporary",     "effect_value": 3,  "target_mode": "any_minion",          "effect_arg": "fire,dies_after_turn"},
    "A00018": {"effect_id": "bounce_attackers",          "effect_value": 0,  "target_mode": "all_enemy_attackers", "effect_arg": ""},
    "A00025": {"effect_id": "clone_minion",              "effect_value": 0,  "target_mode": "any_minion",          "effect_arg": "set_stats:2/2"},
    "A00026": {"effect_id": "destroy_structure",         "effect_value": 0,  "target_mode": "any_structure",       "effect_arg": ""},
    "A00028": {"effect_id": "on_death_splash",           "effect_value": 2,  "target_mode": "any_minion",          "effect_arg": "splash:closest"},
    "A00029": {"effect_id": "debuff_stats",              "effect_value": -1, "target_mode": "any_minion",          "effect_arg": "-1/-1,aura"},
    "A00030": {"effect_id": "sacrifice_tribe_buff_hp",   "effect_value": 0,  "target_mode": "friendly_minion",     "effect_arg": "subtype:Skeleton,max:5"},
    "A00031": {"effect_id": "give_spell_absorb",         "effect_value": 0,  "target_mode": "friendly_minion",     "effect_arg": ""},
    "A00032": {"effect_id": "sacrifice_tribe_draw",      "effect_value": 0,  "target_mode": "self",                "effect_arg": "subtype:Skeleton"},
    "A00033": {"effect_id": "sacrifice_minion_heal",     "effect_value": 5,  "target_mode": "friendly_minion",     "effect_arg": ""},
    "A00034": {"effect_id": "spawn_tokens",              "effect_value": 3,  "target_mode": "self",                "effect_arg": "1/1/BurningSkeleton/dies_after_turn/burning_damage:1"},
    "A00035": {"effect_id": "vanish_to_lantern",         "effect_value": 0,  "target_mode": "any_minion",          "effect_arg": "structure:0/4,restore_on_destroy"},
    "A00039": {"effect_id": "cant_block",                "effect_value": 1,  "target_mode": "enemy_minion",        "effect_arg": ""},
    "A00040": {"effect_id": "skip_turn_vanish",          "effect_value": 1,  "target_mode": "self",                "effect_arg": "immune_damage"},
    "A00042": {"effect_id": "gain_mana",                 "effect_value": 2,  "target_mode": "self",                "effect_arg": "this_turn"},
    "A00043": {"effect_id": "resurrect_dead_this_turn",  "effect_value": 0,  "target_mode": "self",                "effect_arg": ""},
    "A00047": {"effect_id": "transform_minion",          "effect_value": 0,  "target_mode": "any_minion",          "effect_arg": "max_attack:2,into:0/1/Toad"},
    "A00048": {"effect_id": "recurring_debuff",          "effect_value": -1, "target_mode": "any_minion",          "effect_arg": "-1/-1,per_turn"},
    "A00049": {"effect_id": "conditional_spawn",         "effect_value": 0,  "target_mode": "self",                "effect_arg": "condition:hp_below:5,spawn:5/7/Djinn/GUARDIAN"},
    "A00050": {"effect_id": "vanish_and_damage",         "effect_value": 2,  "target_mode": "attacked_minion",     "effect_arg": "damage_target:first_attacker"},
    "A00051": {"effect_id": "punish_card_play",          "effect_value": 1,  "target_mode": "enemy_hero",          "effect_arg": "per_card,next_turn"},
    "A00052": {"effect_id": "trap_minion",               "effect_value": 1,  "target_mode": "any_minion",          "effect_arg": "on_death_spawn:2/1/Spectre/friendly"},
    "A00053": {"effect_id": "banish_grave_spawn",        "effect_value": 2,  "target_mode": "enemy_grave",         "effect_arg": "spawn:1/2/Skeleton"},
    "A00054": {"effect_id": "pay_life_reduce_cost",      "effect_value": 3,  "target_mode": "self",                "effect_arg": "cost_reduction:1,this_turn"},
    "A00057": {"effect_id": "mass_reanimate_as_spirit",  "effect_value": 5,  "target_mode": "friendly_grave",      "effect_arg": "spawn:3/5/Spirit,buff_all_attack:1"},
    "A00058": {"effect_id": "on_death_spawn_spirit",     "effect_value": 0,  "target_mode": "friendly_minion",     "effect_arg": "spawn:4/1/Spirit/RAPID,vanish_after"},
    "A00059": {"effect_id": "absorb_convert_to_attack",  "effect_value": 0,  "target_mode": "friendly_minion",     "effect_arg": "next_turn"},
    "A00060": {"effect_id": "stasis_minion",             "effect_value": 1,  "target_mode": "friendly_damaged",    "effect_arg": "untargetable"},
    "A00061": {"effect_id": "lock_then_release",         "effect_value": 2,  "target_mode": "any_minion",          "effect_arg": "buff:3/3,force_attack_core"},
    "A00062": {"effect_id": "give_stealth",              "effect_value": 1,  "target_mode": "friendly_minion",     "effect_arg": ""},
    "A00063": {"effect_id": "core_trap",                 "effect_value": 3,  "target_mode": "self",                "effect_arg": "max_core_damage:1,retaliate_all_attackers"},
    "A00064": {"effect_id": "survive_lethal",            "effect_value": 0,  "target_mode": "friendly_minion",     "effect_arg": "condition:exact_lethal"},
    "A00065": {"effect_id": "buff_attack_reduce_hp",     "effect_value": 3,  "target_mode": "any_minion",          "effect_arg": "set_hp:1"},
    "A00068": {"effect_id": "force_attack_hero",         "effect_value": 0,  "target_mode": "enemy_minion",        "effect_arg": ""},
    "A00069": {"effect_id": "draw_next_turn",            "effect_value": 1,  "target_mode": "self",                "effect_arg": ""},
    "A00076": {"effect_id": "vanish_cleanse",            "effect_value": 1,  "target_mode": "friendly_minion",     "effect_arg": "remove_all_debuffs"},
    "A00077": {"effect_id": "shuffle_tribe_on_death",    "effect_value": 0,  "target_mode": "self",                "effect_arg": "subtype:Undead,this_turn"},
    "A00078": {"effect_id": "draw_card",                 "effect_value": 1,  "target_mode": "self",                "effect_arg": ""},
    "A00085": {"effect_id": "buff_tribe_attack",         "effect_value": 1,  "target_mode": "all_friendly_tribe",  "effect_arg": "subtype:Goblin"},
    "A00086": {"effect_id": "buff_stats",                "effect_value": 1,  "target_mode": "friendly_minion",     "effect_arg": "+1/+2"},
    "A00093": {"effect_id": "aoe_damage_wave",           "effect_value": 3,  "target_mode": "all_enemy_attackers", "effect_arg": "friendly_value:2,core_value:1"},
    "A00105": {"effect_id": "buff_attackers",            "effect_value": 2,  "target_mode": "all_friendly_attackers", "effect_arg": "this_turn"},
    "A00106": {"effect_id": "damage_and_cant_block",     "effect_value": 1,  "target_mode": "any_minion",          "effect_arg": "this_turn"},
    "A00107": {"effect_id": "deal_damage",               "effect_value": 3,  "target_mode": "random_attacker",     "effect_arg": ""},
}
for cid, data in spells.items():
    ok = patch("spell_cards", cid, data)
    print(f"  {'OK' if ok else 'FAIL'} {cid} → {data['effect_id']}")


# ─────────────────────────────────────────────
# 3. MINION CARDS — ability_id, trigger, value, arg
# ─────────────────────────────────────────────
print("\n=== 3. MINION CARDS ===")
minions = {
    "A00014": {"ability_id": "return_to_hand",        "ability_trigger": "on_damage",        "ability_value": 0,  "ability_arg": ""},
    "A00027": {"ability_id": "gain_mana",              "ability_trigger": "on_attack",        "ability_value": 1,  "ability_arg": ""},
    "A00036": {"ability_id": "vanish_after_attack",   "ability_trigger": "on_attack",        "ability_value": 1,  "ability_arg": "duration:1_turn"},
    "A00037": {"ability_id": "phantom_damage",        "ability_trigger": "passive",          "ability_value": 2,  "ability_arg": ""},
    "A00038": {"ability_id": "deal_damage",           "ability_trigger": "activate",         "ability_value": 1,  "ability_cost": 1, "ability_target_mode": "any_minion", "ability_arg": "discard_cost:1"},
    "A00041": {"ability_id": "swap_sides",            "ability_trigger": "on_attack",        "ability_value": 0,  "ability_arg": "condition:self_survives"},
    "A00044": {"ability_id": "consume",               "ability_trigger": "on_attack",        "ability_value": 0,  "ability_arg": "gain_stats_on_kill"},
    "A00045": {"ability_id": "tribe_buff_attack",     "ability_trigger": "passive",          "ability_value": 1,  "ability_arg": "subtype:Skeleton,max:3"},
    "A00046": {"ability_id": "give_stealth",          "ability_trigger": "on_attack",        "ability_value": 1,  "ability_arg": ""},
    "A00066": {"ability_id": "gain_mana",             "ability_trigger": "on_core_hit",      "ability_value": 1,  "ability_arg": ""},
    "A00070": {"ability_id": "reduce_spell_cost",     "ability_trigger": "passive",          "ability_value": 1,  "ability_arg": ""},
    "A00081": {"ability_id": "buff_attack_if_first",  "ability_trigger": "on_attack",        "ability_value": 1,  "ability_arg": "condition:first_attacker,duration:1_turn"},
    "A00082": {"ability_id": "aoe_damage",            "ability_trigger": "on_core_hit",      "ability_value": 2,  "ability_target_mode": "all_enemy_minions", "ability_arg": ""},
    "A00083": {"ability_id": "heal_on_kill",          "ability_trigger": "on_kill",          "ability_value": 1,  "ability_arg": ""},
    "A00087": {"ability_id": "dies_after_damage",     "ability_trigger": "on_deal_damage",   "ability_value": 0,  "ability_arg": ""},
    "A00089": {"ability_id": "draw_card",             "ability_trigger": "on_tribe_death",   "ability_value": 1,  "ability_arg": "subtype:Goblin"},
    "A00090": {"ability_id": "gain_mana",             "ability_trigger": "on_tribe_death",   "ability_value": 1,  "ability_arg": "subtype:Goblin,next_turn"},
    "A00094": {"ability_id": "spawn_mine",            "ability_trigger": "activate",         "ability_value": 2,  "ability_cost": 1, "ability_arg": "0/1/Mine/attacks_first_attacker"},
    "A00095": {"ability_id": "deal_damage",           "ability_trigger": "on_attack",        "ability_value": 1,  "ability_target_mode": "first_attacker", "ability_arg": ""},
    "A00096": {"ability_id": "deal_damage",           "ability_trigger": "on_attack",        "ability_value": 1,  "ability_target_mode": "random_enemy_minion", "ability_arg": ""},
    "A00097": {"ability_id": "fear_to_backline",      "ability_trigger": "on_attack",        "ability_value": 0,  "ability_target_mode": "all_enemy_minions", "ability_arg": ""},
    "A00099": {"ability_id": "gain_mana",             "ability_trigger": "on_draw",          "ability_value": 1,  "ability_arg": ""},
    "A00100": {"ability_id": "block_cost",            "ability_trigger": "passive",          "ability_value": 1,  "ability_arg": "enemy_must_pay"},
    "A00101": {"ability_id": "shock_aura",            "ability_trigger": "passive",          "ability_value": 1,  "ability_arg": "before_battle"},
    "A00102": {"ability_id": "grab",                  "ability_trigger": "on_deal_damage",   "ability_value": 0,  "ability_arg": "condition:target_survives,cant_block_this_phase"},
    "A00110": {"ability_id": "gain_mana",             "ability_trigger": "on_survive_turn",  "ability_value": 1,  "ability_arg": "extra"},
}
for cid, data in minions.items():
    ok = patch("minion_cards", cid, data)
    print(f"  {'OK' if ok else 'FAIL'} {cid} → {data['ability_id']}/{data['ability_trigger']}")


# ─────────────────────────────────────────────
# 4. STRUCTURE CARDS — trigger_id, ability_id, value, arg
# ─────────────────────────────────────────────
print("\n=== 4. STRUCTURE CARDS ===")
structures = {
    "A00005": {"trigger_id": "on_friendly_minion_death", "ability_id": "resurrect_weakened",    "trigger_value": 2, "ability_arg": "min_attack:2,new_attack:1"},
    "A00008": {"trigger_id": "on_play_spell",            "ability_id": "draw_card",              "trigger_value": 1, "ability_arg": ""},
    "A00009": {"trigger_id": "passive",                  "ability_id": "deny_mana_gain",         "trigger_value": 0, "ability_arg": "target:enemy"},
    "A00010": {"trigger_id": "on_minion_death_count",    "ability_id": "self_destroy_spawn",     "trigger_value": 5, "ability_arg": "spawn:5/5/Demon,count_per_turn"},
    "A00011": {"trigger_id": "on_every_n_turns",         "ability_id": "force_kill_own_minion",  "trigger_value": 2, "ability_arg": "target:enemy"},
    "A00012": {"trigger_id": "on_core_attack",           "ability_id": "spawn_token",            "trigger_value": 0, "ability_arg": "1/1/ZombeeBee/FLYING/TOXIC"},
    "A00015": {"trigger_id": "on_friendly_attack",       "ability_id": "move_to_backline",       "trigger_value": 0, "ability_arg": "after_attack"},
    "A00023": {"trigger_id": "on_friendly_minion_death", "ability_id": "vanish_and_spawn",       "trigger_value": 0, "ability_arg": "spawn:1/1/Skeleton"},
    "A00071": {"trigger_id": "on_draw_minion",           "ability_id": "vanish_spawn_undead",    "trigger_value": 0, "ability_arg": "spawn:2/2/Undead"},
    "A00074": {"trigger_id": "passive",                  "ability_id": "block_flying_core_attack","trigger_value": 0, "ability_arg": ""},
    "A00075": {"trigger_id": "on_enemy_play_minion",     "ability_id": "spawn_token",            "trigger_value": 0, "ability_arg": "0/1/Caterpillar/dies_after:2_turns"},
    "A00079": {"trigger_id": "on_turn_end",              "ability_id": "grow_then_spawn",        "trigger_value": 5, "ability_arg": "add_defense:1,max:5,spawn:5/5/Zombie,cant_repair"},
    "A00080": {"trigger_id": "passive",                  "ability_id": "aura_enemy_debuff",      "trigger_value": -1,"ability_arg": "stat:health"},
    "A00088": {"trigger_id": "on_enemy_attack",          "ability_id": "deal_damage",            "trigger_value": 2, "ability_target_mode": "random_attacker", "ability_arg": ""},
    "A00103": {"trigger_id": "on_enemy_draw",            "ability_id": "reveal_card",            "trigger_value": 0, "ability_arg": ""},
    "A00104": {"trigger_id": "passive",                  "ability_id": "reduce_spell_cost",      "trigger_value": 2, "ability_arg": "target:owner"},
    "A00108": {"trigger_id": "on_enemy_play_spell",      "ability_id": "deal_damage",            "trigger_value": 1, "ability_target_mode": "enemy_hero", "ability_arg": ""},
    "A00109": {"trigger_id": "on_enemy_attack",          "ability_id": "protect_backline_retaliate","trigger_value": 1, "ability_arg": "backline_reduction:1"},
    "A00111": {"trigger_id": "on_first_attacker",        "ability_id": "scare_no_damage",        "trigger_value": 0, "ability_arg": ""},
    "A00112": {"trigger_id": "activate",                 "ability_id": "deal_damage",            "trigger_value": 2, "ability_cost": 0, "ability_arg": "discard_cost:1"},
}
for cid, data in structures.items():
    ok = patch("structure_cards", cid, data)
    print(f"  {'OK' if ok else 'FAIL'} {cid} → {data['trigger_id']}/{data['ability_id']}")

print("\nDone!")
