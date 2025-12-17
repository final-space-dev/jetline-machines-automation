import { PrismaClient } from "@prisma/client";
import { promises as fs } from "fs";
import path from "path";

const prisma = new PrismaClient();

interface BMSMachineInfo {
  category: string | null;
  install_date: string | null;
  bms_company: string;
  model_name?: string | null;
  make_name?: string | null;
}

async function main() {
  console.log("Starting seed...");

  // Try to load BMS machine info from parent directory
  const bmsInfoPath = path.join(process.cwd(), "..", "bms_machine_info.json");

  try {
    const fileContent = await fs.readFile(bmsInfoPath, "utf-8");
    const bmsData: Record<string, BMSMachineInfo> = JSON.parse(fileContent);

    console.log(`Found ${Object.keys(bmsData).length} machines in BMS data`);

    // Create categories first
    const categoriesSet = new Set<string>();
    Object.values(bmsData).forEach((info) => {
      if (info.category) categoriesSet.add(info.category);
    });

    console.log(`Creating ${categoriesSet.size} categories...`);
    for (const categoryName of categoriesSet) {
      await prisma.category.upsert({
        where: { name: categoryName },
        create: { name: categoryName },
        update: {},
      });
    }

    // Create companies
    const companiesMap = new Map<string, string>();
    const companiesSet = new Set<string>();
    Object.values(bmsData).forEach((info) => {
      companiesSet.add(info.bms_company);
    });

    console.log(`Creating ${companiesSet.size} companies...`);
    for (const bmsSchema of companiesSet) {
      // Extract readable name from schema (e.g., "menlynbms2" -> "Menlyn")
      const name = bmsSchema
        .replace(/bms\d*$/, "")
        .replace(/_/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .trim()
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ") || bmsSchema;

      const company = await prisma.company.upsert({
        where: { bmsSchema },
        create: { name, bmsSchema },
        update: { name },
      });
      companiesMap.set(bmsSchema, company.id);
    }

    // Get all categories for lookup
    const categories = await prisma.category.findMany();
    const categoryMap = new Map(categories.map((c) => [c.name, c.id]));

    // Create machines
    console.log("Creating machines...");
    let machineCount = 0;
    for (const [serial, info] of Object.entries(bmsData)) {
      const companyId = companiesMap.get(info.bms_company);
      if (!companyId) continue;

      const categoryId = info.category ? categoryMap.get(info.category) : null;

      await prisma.machine.upsert({
        where: { serialNumber: serial },
        create: {
          serialNumber: serial,
          companyId,
          categoryId,
          installDate: info.install_date ? new Date(info.install_date) : null,
          modelName: info.model_name || null,
          makeName: info.make_name || null,
          status: "ACTIVE",
          currentBalance: 0,
        },
        update: {
          companyId,
          categoryId,
          installDate: info.install_date ? new Date(info.install_date) : null,
          modelName: info.model_name || null,
          makeName: info.make_name || null,
        },
      });
      machineCount++;
    }

    console.log(`Created/updated ${machineCount} machines`);

  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      console.log("No bms_machine_info.json found, creating sample data...");

      // Create sample categories
      const colorA3 = await prisma.category.create({ data: { name: "Colour" } });
      const monoA4 = await prisma.category.create({ data: { name: "Black and White" } });
      const office = await prisma.category.create({ data: { name: "Office Machine" } });

      // Create sample companies
      const menlyn = await prisma.company.create({
        data: { name: "Menlyn", bmsSchema: "menlynbms2", region: "Gauteng" },
      });
      const sandton = await prisma.company.create({
        data: { name: "Sandton", bmsSchema: "sandtonbms", region: "Gauteng" },
      });
      const capeTown = await prisma.company.create({
        data: { name: "Cape Town", bmsSchema: "capetownbms", region: "Western Cape" },
      });

      // Create sample printer models
      const versalink = await prisma.printerModel.create({
        data: { name: "Xerox VersaLink C7025", makeName: "Xerox", isColor: true, monthlyDutyCycle: 10000 },
      });
      const altalink = await prisma.printerModel.create({
        data: { name: "Xerox AltaLink B8170", makeName: "Xerox", isColor: false, monthlyDutyCycle: 50000 },
      });

      // Create sample machines
      await prisma.machine.createMany({
        data: [
          {
            serialNumber: "XRX001234",
            companyId: menlyn.id,
            categoryId: colorA3.id,
            modelId: versalink.id,
            modelName: "Xerox VersaLink C7025",
            makeName: "Xerox",
            installDate: new Date("2023-06-15"),
            currentBalance: 45000,
            status: "ACTIVE",
          },
          {
            serialNumber: "XRX005678",
            companyId: menlyn.id,
            categoryId: monoA4.id,
            modelId: altalink.id,
            modelName: "Xerox AltaLink B8170",
            makeName: "Xerox",
            installDate: new Date("2022-03-10"),
            currentBalance: 120000,
            status: "ACTIVE",
          },
          {
            serialNumber: "XRX009012",
            companyId: sandton.id,
            categoryId: colorA3.id,
            modelId: versalink.id,
            modelName: "Xerox VersaLink C7025",
            makeName: "Xerox",
            installDate: new Date("2024-01-20"),
            currentBalance: 8500,
            status: "ACTIVE",
          },
          {
            serialNumber: "XRX003456",
            companyId: capeTown.id,
            categoryId: monoA4.id,
            modelId: altalink.id,
            modelName: "Xerox AltaLink B8170",
            makeName: "Xerox",
            installDate: new Date("2021-11-05"),
            currentBalance: 250000,
            status: "MAINTENANCE",
          },
        ],
      });

      console.log("Sample data created successfully");
    } else {
      throw error;
    }
  }

  console.log("Seed completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
