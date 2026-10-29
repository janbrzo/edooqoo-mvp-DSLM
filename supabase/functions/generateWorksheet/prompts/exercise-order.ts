/**
 * Single source of truth for the exercise order used in every prompt block.
 * No media: the requested order, unchanged. Picture or audio attached:
 * picture > audio > others (same rule as sortRequestedTypesForMedia in quality.ts).
 */
export const getOrderedExercises = (
  selectedExercises: string[],
  exerciseCount: number,
  hasSelectedImage?: boolean,
  hasSelectedAudio?: boolean,
): string[] => {
  const requested = [...selectedExercises].slice(0, exerciseCount);
  if (!hasSelectedImage && !hasSelectedAudio) return requested;
  const isAudio = (ex: string) => ex.endsWith("-audio") || ex === "listening-comprehension";
  const pictureExercises = requested.filter((ex) => ex.endsWith("-picture"));
  const audioExercises = requested.filter((ex) => isAudio(ex));
  const otherExercises = requested.filter((ex) => !ex.endsWith("-picture") && !isAudio(ex));
  return [...pictureExercises, ...audioExercises, ...otherExercises];
};
