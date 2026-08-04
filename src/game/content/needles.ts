import type { NeedleDefinition, NeedleId } from '../core/types';

export const NEEDLES: Record<NeedleId, NeedleDefinition> = {
  dawn: {
    id: 'dawn',
    nameKey: 'needle.dawn.name',
    descriptionKey: 'needle.dawn.description',
    glyph: '✦',
    color: 0xffd75a,
    maxLength: 285,
    needleSpeed: 2900,
    anchorPull: 118,
    tensionRate: 1,
    captureTolerance: 1,
    projectileCapacity: 4,
    baseChordRepeats: 0
  },
  twin: {
    id: 'twin',
    nameKey: 'needle.twin.name',
    descriptionKey: 'needle.twin.description',
    glyph: '✣',
    color: 0xff7f91,
    maxLength: 245,
    needleSpeed: 3300,
    anchorPull: 142,
    tensionRate: 1.18,
    captureTolerance: 0.92,
    projectileCapacity: 3,
    baseChordRepeats: 1
  },
  moon: {
    id: 'moon',
    nameKey: 'needle.moon.name',
    descriptionKey: 'needle.moon.description',
    glyph: '◒',
    color: 0x9fd8ff,
    maxLength: 350,
    needleSpeed: 2450,
    anchorPull: 88,
    tensionRate: 0.82,
    captureTolerance: 1.22,
    projectileCapacity: 5,
    baseChordRepeats: 0
  }
};

export const NEEDLE_LIST = Object.values(NEEDLES);
