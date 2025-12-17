import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// BMS store configurations from the Python scripts
const BMS_STORES = [
  { schema: "gardensbms2", name: "Gardens", host: "wizardzgardens.jetlinestores.co.za" },
  { schema: "waterfrontbms2", name: "Waterfront", host: "wizardzwaterfront.jetlinestores.co.za" },
  { schema: "centurycitybms2", name: "Century City", host: "centurycity.jetlinestores.co.za" },
  { schema: "albertonbms2", name: "Alberton", host: "alberton.jetlinestores.co.za" },
  { schema: "bedfordviewbms2", name: "Bedfordview", host: "bedfordview.jetlinestores.co.za" },
  { schema: "blackheathbms2", name: "Blackheath", host: "blackheath.jetlinestores.co.za" },
  { schema: "boksburgbms2", name: "Boksburg", host: "boksburg.jetlinestores.co.za" },
  { schema: "benonibms2", name: "Benoni", host: "benoni.jetlinestores.co.za" },
  { schema: "bryanstonbms2", name: "Bryanston", host: "bryanston.jetlinestores.co.za" },
  { schema: "durbanbms2", name: "Durban", host: "durban.jetlinestores.co.za" },
  { schema: "foxstreetbms2", name: "Foxstreet", host: "foxstreet.jetlinestores.co.za" },
  { schema: "hillcrestbms2", name: "Hillcrest", host: "hillcrest.jetlinestores.co.za" },
  { schema: "kyalamibms2", name: "Kyalami", host: "kyalami.jetlinestores.co.za" },
  { schema: "melrosebms2", name: "Melrose", host: "melrose.jetlinestores.co.za" },
  { schema: "menlynbms2", name: "Menlyn", host: "menlyn.jetlinestores.co.za" },
  { schema: "parktownbms2", name: "Parktown", host: "parktown.jetlinestores.co.za" },
  { schema: "pietermaritzburgbms2", name: "Pietermaritzburg", host: "pietermaritzburg.jetlinestores.co.za" },
  { schema: "sunninghillbms2", name: "Sunninghill", host: "sunninghill.jetlinestores.co.za" },
  { schema: "polokwanebms2", name: "Polokwane", host: "polokwane.jetlinestores.co.za" },
  { schema: "rivoniabms2", name: "Rivonia", host: "rivonia.jetlinestores.co.za" },
  { schema: "rosebankbms2", name: "Rosebank", host: "rosebank.jetlinestores.co.za" },
  { schema: "rustenburgbms2", name: "Rustenburg", host: "rustenburg.jetlinestores.co.za" },
  { schema: "sandownbms2", name: "Sandown", host: "sandown.jetlinestores.co.za" },
  { schema: "illovobms2", name: "Illovo", host: "illovo.jetlinestores.co.za" },
  { schema: "montanabms2", name: "Montana", host: "montana.jetlinestores.co.za" },
  { schema: "brooklynbms2", name: "Brooklyn", host: "brooklyn.jetlinestores.co.za" },
  { schema: "potchbms2", name: "Potchefstroom", host: "potchefstroom.jetlinestores.co.za" },
  { schema: "woodmeadbms2", name: "Woodmead", host: "woodmead.jetlinestores.co.za" },
  { schema: "georgebms2", name: "George", host: "george.jetlinestores.co.za" },
  { schema: "modderfonteinbms2", name: "Modderfontein", host: "modderfontein.jetlinestores.co.za" },
  { schema: "greenpointbms2", name: "Greenpoint", host: "greenpoint.jetlinestores.co.za" },
  { schema: "randburgbms2", name: "Randburg", host: "randburg.jetlinestores.co.za" },
  { schema: "hydeparkbms2", name: "Hydepark", host: "hydepark.jetlinestores.co.za" },
  { schema: "fourwaysbms2", name: "Fourways", host: "fourways.jetlinestores.co.za" },
  { schema: "centurionbms2", name: "Centurion", host: "centurion.jetlinestores.co.za" },
  { schema: "nelspruitbms2", name: "Nelspruit", host: "nelspruit.jetlinestores.co.za" },
  { schema: "witsbms2", name: "Wits", host: "wits.jetlinestores.co.za" },
  { schema: "constantiabms2", name: "Constantia", host: "constantia.jetlinestores.co.za" },
  { schema: "stellenboschbms2", name: "Stellenbosch", host: "stellenbosch.jetlinestores.co.za" },
  { schema: "tygervalleybms2", name: "Tygervalley", host: "tygervalley.jetlinestores.co.za" },
  { schema: "midrandbms2", name: "Midrand", host: "midrand.jetlinestores.co.za" },
  { schema: "mmabathobms2", name: "Mmabatho", host: "mmabatho.jetlinestores.co.za" },
];

// Mapping from bms_machine_info.json company names to BMS schema
const NAME_TO_SCHEMA: Record<string, { schema: string; host: string }> = {};
BMS_STORES.forEach((store) => {
  NAME_TO_SCHEMA[store.name] = { schema: store.schema, host: store.host };
});

// Additional mappings for names that don't match exactly
NAME_TO_SCHEMA["Century City"] = { schema: "centurycitybms2", host: "centurycity.jetlinestores.co.za" };
NAME_TO_SCHEMA["Fixtrade"] = { schema: "fixtradebms2", host: "fixtrade.jetlinestores.co.za" };

async function main() {
  console.log("Updating company BMS configurations...");

  // Get all companies
  const companies = await prisma.company.findMany();
  console.log(`Found ${companies.length} companies`);

  let updated = 0;
  let notFound = 0;

  for (const company of companies) {
    const mapping = NAME_TO_SCHEMA[company.name];

    if (mapping) {
      await prisma.company.update({
        where: { id: company.id },
        data: {
          bmsSchema: mapping.schema,
          bmsHost: mapping.host,
        },
      });
      console.log(`  Updated ${company.name}: ${mapping.schema} @ ${mapping.host}`);
      updated++;
    } else {
      // Try to derive schema from name
      const derivedSchema = company.name.toLowerCase().replace(/\s+/g, "") + "bms2";
      const derivedHost = company.name.toLowerCase().replace(/\s+/g, "") + ".jetlinestores.co.za";

      await prisma.company.update({
        where: { id: company.id },
        data: {
          bmsSchema: derivedSchema,
          bmsHost: derivedHost,
        },
      });
      console.log(`  Derived ${company.name}: ${derivedSchema} @ ${derivedHost}`);
      notFound++;
    }
  }

  // Also create BmsConnection entries
  console.log("\nCreating BMS connection entries...");
  for (const store of BMS_STORES) {
    await prisma.bmsConnection.upsert({
      where: { schema: store.schema },
      create: {
        schema: store.schema,
        host: store.host,
        port: 3306,
        isActive: true,
      },
      update: {
        host: store.host,
        isActive: true,
      },
    });
  }

  console.log(`\nDone! Updated ${updated} companies, derived ${notFound} companies`);
  console.log(`Created ${BMS_STORES.length} BMS connection entries`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
