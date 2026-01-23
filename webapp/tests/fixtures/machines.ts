export const mockMachine = {
  id: "test-machine-1",
  serialNumber: "TEST001",
  bmsId: 1,
  status: "ACTIVE" as const,
  monoBalance: 50000,
  colourBalance: 25000,
  rentalStartDate: new Date("2023-01-01"),
  rentalEndDate: new Date("2026-01-01"),
  createdAt: new Date(),
  updatedAt: new Date(),
  companyId: "test-company-1",
  categoryId: "test-category-1",
  printerModelId: "test-model-1",
  company: {
    id: "test-company-1",
    name: "Test Store",
    bmsSchema: "testbms",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  category: {
    id: "test-category-1",
    name: "Colour",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  printerModel: {
    id: "test-model-1",
    name: "Test Model 500",
    makeName: "Test Make",
    dutyCycle: 100000,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

export const mockMachines = [
  mockMachine,
  {
    ...mockMachine,
    id: "test-machine-2",
    serialNumber: "TEST002",
    bmsId: 2,
    monoBalance: 75000,
    colourBalance: 30000,
  },
  {
    ...mockMachine,
    id: "test-machine-3",
    serialNumber: "TEST003",
    bmsId: 3,
    status: "INACTIVE" as const,
    monoBalance: 100000,
    colourBalance: 50000,
  },
];

export const createMockMachine = (overrides: Partial<typeof mockMachine> = {}) => ({
  ...mockMachine,
  ...overrides,
  id: overrides.id || `test-machine-${Date.now()}`,
});
