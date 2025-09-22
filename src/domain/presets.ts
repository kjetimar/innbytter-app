export const presets = {
  football5: { sport:'football', onFieldCount:5, halves:2, halfLengthMin:25, subIntervalMin:5, keeperRarity:2 },
  football7: { sport:'football', onFieldCount:7, halves:2, halfLengthMin:25, subIntervalMin:5, keeperRarity:2 },
  handball:  { sport:'handball', onFieldCount:7, halves:2, halfLengthMin:20, subIntervalMin:5, keeperRarity:2 },
} as const;
