import type { Story } from './types';

export interface StoryGroup {
  authorName: string;
  authorIsMe: boolean;
  /** Stories de ce voisin, de la plus récente à la plus ancienne. */
  items: Story[];
  /** Position de sa première story dans la liste ordonnée. */
  firstIndex: number;
}

/**
 * Regroupe les stories par voisin.
 *
 * Deux stories du même voisin font une seule bulle, pas deux : c'est ce que
 * tout le monde attend d'une story, et une rangée de bulles répétées au même
 * nom ne dit rien de plus. L'ordre d'arrivée est conservé — le voisin qui
 * vient de publier reste en tête.
 */
export function groupStories(stories: Story[]): { ordered: Story[]; groups: StoryGroup[] } {
  const parAuteur = new Map<string, Story[]>();
  for (const story of stories) {
    const clé = `${story.authorIsMe ? 'moi' : story.authorName}`;
    const liste = parAuteur.get(clé);
    if (liste) liste.push(story);
    else parAuteur.set(clé, [story]);
  }

  const ordered: Story[] = [];
  const groups: StoryGroup[] = [];
  for (const items of parAuteur.values()) {
    groups.push({
      authorName: items[0]!.authorName,
      authorIsMe: items[0]!.authorIsMe,
      items,
      firstIndex: ordered.length,
    });
    ordered.push(...items);
  }

  return { ordered, groups };
}
