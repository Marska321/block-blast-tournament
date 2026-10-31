export type PraiseId = "nice" | "great" | "lekker" | "duidelik" | "aweh" | "amazing" | "brilliant" | "perfect";
export interface PraiseCue { id: PraiseId; text: string; color: string; speak: boolean }

const phrases: Record<PraiseId, { text: string; color: string }> = {
  nice: { text: "Nice!", color: "#ffbb86" },
  great: { text: "Great!", color: "#acdfff" },
  lekker: { text: "Lekker!", color: "#96e5ce" },
  duidelik: { text: "Duidelik!", color: "#ffda78" },
  aweh: { text: "Aweh!", color: "#96e5ce" },
  amazing: { text: "Amazing!", color: "#ffda78" },
  brilliant: { text: "Brilliant!", color: "#ffbb86" },
  perfect: { text: "Perfect!", color: "#ffda78" },
};
const rotation: PraiseId[] = ["nice", "great", "lekker", "duidelik", "aweh", "amazing", "brilliant"];

export function createPraisePicker(random: () => number = Math.random) {
  let bag: PraiseId[] = [];
  let previous: PraiseId | undefined;
  return (lines: number, combo: number, allClear = false): PraiseCue => {
    let id: PraiseId;
    if (allClear && previous !== "perfect") id = "perfect";
    else {
      // A shuffled bag gives each word equal airtime, including ordinary single
      // clears. This cosmetic randomness never touches the seeded game engine.
      if (!bag.length) {
        bag = [...rotation];
        for (let i = bag.length - 1; i > 0; i--) {
          const j = Math.floor(random() * (i + 1));
          [bag[i], bag[j]] = [bag[j], bag[i]];
        }
        // Avoid a repeat across the boundary between two shuffled bags.
        if (bag[0] === previous) [bag[0], bag[1]] = [bag[1], bag[0]];
      }
      id = bag.shift()!;
    }
    previous = id;
    return { id, ...phrases[id], speak: allClear || lines >= 2 || combo >= 2 };
  };
}

// Text and any future recorded voice always share the same selected cue.
export const getPraise = createPraisePicker();
