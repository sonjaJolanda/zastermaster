import { app, page, route } from "@wasp.sh/spec";
import { App } from "./src/App" with { type: "ref" };
import { AnalysePage } from "./src/pages/AnalysePage" with { type: "ref" };
import { EinstellungenPage } from "./src/pages/EinstellungenPage" with {
  type: "ref",
};
import { TransaktionenPage } from "./src/pages/TransaktionenPage" with {
  type: "ref",
};
import { UploadPage } from "./src/pages/UploadPage" with { type: "ref" };

export default app({
  name: "ZasterMaster",
  title: "Zaster Master",
  wasp: { version: "^0.24.0" },
  head: [
    "<link rel='icon' href='/favicon.ico' />",
    "<link rel='preconnect' href='https://fonts.googleapis.com' />",
    "<link rel='preconnect' href='https://fonts.gstatic.com' />",
    "<link href='https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap' rel='stylesheet' />",
  ],
  client: {
    rootComponent: App,
  },
  spec: [
    //#region Pages
    route("TransaktionenRoute", "/", page(TransaktionenPage)),
    route("UploadRoute", "/upload", page(UploadPage)),
    route("EinstellungenRoute", "/einstellungen", page(EinstellungenPage)),
    route("AnalyseRoute", "/analyse", page(AnalysePage)),
    //#endregion
  ],
});
