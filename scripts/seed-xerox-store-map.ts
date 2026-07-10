import { syncXeroxStoreMap } from "../src/lib/xerox-sync";

syncXeroxStoreMap()
  .then((result) => {
    console.log("Store map sync complete:", result);
    process.exit(0);
  })
  .catch((err) => {
    console.error("Store map sync failed:", err);
    process.exit(1);
  });
