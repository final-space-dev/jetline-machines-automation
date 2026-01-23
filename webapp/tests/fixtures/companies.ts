export const mockCompany = {
  id: "test-company-1",
  name: "Test Store Menlyn",
  bmsSchema: "menlynbms2",
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockCompanies = [
  mockCompany,
  {
    id: "test-company-2",
    name: "Test Store Sandton",
    bmsSchema: "sandtonbms2",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "test-company-3",
    name: "Test Store Cape Town",
    bmsSchema: "capetownbms2",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export const createMockCompany = (overrides: Partial<typeof mockCompany> = {}) => ({
  ...mockCompany,
  ...overrides,
  id: overrides.id || `test-company-${Date.now()}`,
});
