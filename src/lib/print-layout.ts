export const chunkItems = <T,>(items: T[], size: number): T[][] => {
  if (size <= 0) return items.length ? [items] : [];

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};
