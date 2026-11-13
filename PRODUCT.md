# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Groups of friends, late teens to 30s, at evening gatherings (sahras) in Jordan. One phone is passed around the circle; nobody installs anything or creates an account.

## Product Purpose
الكذّاب is a pass-the-phone social deduction party game. Every player secretly sees the same word except one, the liar, who sees only the category and must bluff. Players question each other, vote on who the liar is, and the liar gets a last chance to guess the word. Success is a round that produces laughter and argument, and a group that asks for "جولة كمان".

## Positioning
Written for a Jordanian friend group, not translated: Levantine/Jordanian dialect throughout, and word lists drawn from local life (food, places, occasions, school, slang). Adult and bold words are a core part of the game, not a hidden extra.

## Operating Context
- One shared phone, held and passed between players in a room, often in dim light and noisy surroundings.
- Secrecy matters: the screen must not leak the word or the liar's role to people looking over a shoulder.
- Rounds are short (a few minutes); groups play many rounds in a row and keep a running score.
- Must work offline after the first visit (outdoor trips, weak signal).

## Capabilities and Constraints
- 3 to 12 players; themed word categories plus a custom "كلماتي" category the group types in.
- Hold-to-peek role reveal, guided question round, optional timer, secret phone vote or quick open vote, liar's final guess from 8 options, running scoreboard saved on the device.
- Existing codebase: plain HTML/CSS/JS in `kazzab/site/`, built by `kazzab/build.mjs`, deployed to the Vercel project `game` (https://game-gamma-green.vercel.app).
- Content default: adult-first. Bold/adult word categories are on by default (user decision). The current build still ships them as an opt-in "جريئة +18" category that is off by default, so the code does not yet match this decision.

## Brand Commitments
- Name: الكذّاب. The earlier name "برّا السالفة" belongs to an existing app and is not used.
- Voice: casual Jordanian/Levantine Arabic (شو، هسا، يلا، بدّك), playful and teasing, never formal MSA.

## Evidence on Hand
No testimonials, player counts, ratings or press exist. Do not invent any.

## Product Principles
1. The phone is passed, not owned: every screen says whose turn it is and is safe to hand over.
2. Secrecy before speed: never risk showing the word or the role to the wrong person.
3. Words make the game: a word must be known by everyone at the table and askable about.
4. Speak like the table speaks: local dialect and references over generic Arabic.
5. One more round: getting from a finished round into the next one takes one tap.

## Accessibility & Inclusion
Right-to-left Arabic throughout. Text and buttons must stay readable and tappable in dim rooms, at arm's length, on small phones.
