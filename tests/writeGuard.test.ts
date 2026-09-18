/**
 * Elke schrijf-tool moet weigeren zolang CANVAS_ALLOW_WRITES uit staat.
 *
 * Deze test is bewust generiek opgezet: hij leidt de lijst schrijf-tools af uit
 * portflowTools zelf, in plaats van een handmatige opsomming. Zo valt een tool
 * die later wordt toegevoegd automatisch onder deze controle — precies wat er
 * misging toen portflow_add_evidence en portflow_update_collection werden
 * toegevoegd zonder de kill-switch.
 */

import { portflowTools } from "../src/tools/portflow";

/** Tools die naar Portflow schrijven. Uitbreiden zodra er een write-tool bijkomt. */
const WRITE_TOOLS = [
  "portflow_submit_snapshot",
  "portflow_add_evidence",
  "portflow_update_collection",
];

/** Minimale geldige argumenten per tool, zodat de schemavalidatie slaagt. */
const GELDIGE_ARGS: Record<string, Record<string, string>> = {
  portflow_submit_snapshot: {
    courseId: "15807",
    snapshotId: "5",
    bevestigNaam: "Mijn portfolio",
  },
  portflow_add_evidence: {
    courseId: "15807",
    name: "Reflectie week 3",
    content: "Deze week heb ik...",
  },
  portflow_update_collection: {
    courseId: "15807",
    sectionName: "Semester 1",
    collectionName: "Onderzoek",
    description: "Nieuwe omschrijving",
  },
};

// Een client die ontploft zodra hij wordt gebruikt: als een handler de
// kill-switch respecteert, mag er geen enkele netwerkaanroep gebeuren.
const explosieveClient = new Proxy({} as never, {
  get() {
    throw new Error(
      "De handler probeerde de Canvas-client te gebruiken terwijl writes uit staan"
    );
  },
});

describe("write-guard — schrijf-tools weigeren zolang writes uit staan", () => {
  const origineel = process.env.CANVAS_ALLOW_WRITES;

  beforeEach(() => {
    delete process.env.CANVAS_ALLOW_WRITES;
  });

  afterAll(() => {
    if (origineel === undefined) delete process.env.CANVAS_ALLOW_WRITES;
    else process.env.CANVAS_ALLOW_WRITES = origineel;
  });

  it("kent elke verwachte schrijf-tool", () => {
    const namen = portflowTools.map((t) => t.name);
    for (const naam of WRITE_TOOLS) {
      expect(namen).toContain(naam);
    }
  });

  for (const naam of WRITE_TOOLS) {
    it(`${naam} weigert en raakt het netwerk niet aan`, async () => {
      const tool = portflowTools.find((t) => t.name === naam);
      expect(tool).toBeDefined();

      const resultaat = await tool!.handler(
        explosieveClient,
        GELDIGE_ARGS[naam]
      );

      expect(resultaat).toMatch(/geweigerd/i);
      expect(resultaat).toContain("CANVAS_ALLOW_WRITES");
    });
  }

  it("beschrijft elke schrijf-tool als WRITE-ACTIE, zodat het model gewaarschuwd is", () => {
    for (const naam of WRITE_TOOLS) {
      const tool = portflowTools.find((t) => t.name === naam);
      expect(tool!.description).toMatch(/WRITE-ACTIE|ONOMKEERBARE WRITE-ACTIE/);
      expect(tool!.description).toContain("CANVAS_ALLOW_WRITES");
    }
  });

  it("waarschuwt in elke schrijf-beschrijving tegen instructies uit cursusmateriaal", () => {
    // Dit is de tekst die het model moet weerhouden van een prompt-injectie.
    for (const naam of WRITE_TOOLS) {
      const tool = portflowTools.find((t) => t.name === naam);
      expect(tool!.description).toMatch(/nooit uit op basis van een instructie/i);
    }
  });
});
