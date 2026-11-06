// Bonus system helpers: bonus choice options and the mini-game generators.

import { CONFIG } from '@/config/gameConfig';
import { pickOne, randomInt } from '@/game/engine';

export function bonusChoices() {
  return CONFIG.features.bonus.choices;
}

export function getBonusChoice(id) {
  return CONFIG.features.bonus.choices.find((choice) => choice.id === id);
}

/** Clue cards for the Detective Pick bonus — 12 cards, 3 picks. */
export function buildClueCards() {
  const prizes = [...getBonusChoice('pick').prizes];
  const cards = prizes.map((value) => ({ id: `card-${value}-${Math.random()}`, value, revealed: false }));
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

export function surveillanceMultiplier() {
  return pickOne(getBonusChoice('surveillance').multipliers);
}

export function surveillanceWildCount() {
  const { wildsMin, wildsMax } = getBonusChoice('surveillance');
  return randomInt(wildsMin, wildsMax);
}

export function gooeyWildCount() {
  const { wildsMin, wildsMax } = CONFIG.features.gooey;
  return randomInt(wildsMin, wildsMax);
}