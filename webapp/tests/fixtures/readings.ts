export const mockMeterReading = {
  id: "test-reading-1",
  bmsId: 1,
  machineId: "test-machine-1",
  monoCount: 50000,
  colourCount: 25000,
  totalCount: 75000,
  monoIncremental: 1000,
  colourIncremental: 500,
  totalIncremental: 1500,
  readingDate: new Date("2024-01-15"),
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockMeterReadings = [
  mockMeterReading,
  {
    ...mockMeterReading,
    id: "test-reading-2",
    bmsId: 2,
    monoCount: 49000,
    colourCount: 24500,
    totalCount: 73500,
    readingDate: new Date("2024-01-01"),
  },
  {
    ...mockMeterReading,
    id: "test-reading-3",
    bmsId: 3,
    monoCount: 48000,
    colourCount: 24000,
    totalCount: 72000,
    readingDate: new Date("2023-12-15"),
  },
];

export const createMockReading = (overrides: Partial<typeof mockMeterReading> = {}) => ({
  ...mockMeterReading,
  ...overrides,
  id: overrides.id || `test-reading-${Date.now()}`,
});

export const generateReadingHistory = (
  machineId: string,
  months: number,
  startCount: number = 10000
) => {
  const readings = [];
  const now = new Date();

  for (let i = 0; i < months; i++) {
    const readingDate = new Date(now);
    readingDate.setMonth(readingDate.getMonth() - i);

    const monoCount = startCount + (months - i) * 1000;
    const colourCount = Math.floor(monoCount * 0.5);

    readings.push({
      id: `generated-reading-${machineId}-${i}`,
      bmsId: i + 1,
      machineId,
      monoCount,
      colourCount,
      totalCount: monoCount + colourCount,
      monoIncremental: 1000,
      colourIncremental: 500,
      totalIncremental: 1500,
      readingDate,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  return readings;
};
