import { z } from "zod";
import { CanvasClient } from "../canvasClient.js";
import { getPortflowJwt } from "../portflow/auth.js";
import {
  listSnapshots,
  getSnapshot,
  submitSnapshotToCanvas,
  listSections,
  createSection,
  listCollections,
  createCollection,
  updateCollection,
  createFreeTextEvidence,
  listGoals,
  getPortfolioId,
} from "../portflow/client.js";
import { formatDate } from "../utils/formatDate.js";

const courseIdParam = z
  .string()
  .regex(/^\d+$/, "courseId mag alleen cijfers bevatten");

const snapshotIdParam = z
  .string()
  .regex(/^\d+$/, "snapshotId mag alleen cijfers bevatten");

const listSnapshotsSchema = z.object({ courseId: courseIdParam });

const getSnapshotSchema = z.object({
  courseId: courseIdParam,
  snapshotId: snapshotIdParam,
});

const submitSnapshotSchema = z.object({
  courseId: courseIdParam,
  snapshotId: snapshotIdParam,
});

async function handleListSnapshots(
  client: CanvasClient,
  args: Record<string, string>
): Promise<string> {
  const { courseId } = listSnapshotsSchema.parse(args);
  const jwt = await getPortflowJwt(client, courseId);
  const snapshots = await listSnapshots(jwt);

  if (snapshots.length === 0) {
    return "Geen snapshots gevonden in Portflow.";
  }

  const lines = snapshots.map((s) => {
    const date = formatDate(s.created_at);
    const submissions =
      s.lti_submission_count > 0
        ? ` | ${s.lti_submission_count}x ingeleverd`
        : "";
    return `- [${s.id}] ${s.name} — ${date}${submissions} (code: ${s.snapshot_code})`;
  });

  return `Portflow snapshots (${snapshots.length} totaal):\n${lines.join("\n")}`;
}

async function handleGetSnapshot(
  client: CanvasClient,
  args: Record<string, string>
): Promise<string> {
  const { courseId, snapshotId } = getSnapshotSchema.parse(args);
  const jwt = await getPortflowJwt(client, courseId);
  const snap = await getSnapshot(jwt, snapshotId);

  const created = formatDate(snap.created_at);
  const updated = formatDate(snap.updated_at);
  const desc = snap.description?.trim() ? `\nOmschrijving: ${snap.description}` : "";
  const submissionInfo =
    snap.lti_submission_count > 0
      ? `\nCanvas inleveringen: ${snap.lti_submission_count}`
      : "\nNog niet ingeleverd bij Canvas";
  const showcase = snap.showcase_url
    ? `\nPublieke URL: ${snap.showcase_url}`
    : "";

  return [
    `Snapshot: ${snap.name}`,
    `ID: ${snap.id} | Code: ${snap.snapshot_code} | Versie: ${snap.version_number}`,
    `Aangemaakt: ${created} | Bijgewerkt: ${updated}`,
    desc,
    submissionInfo,
    showcase,
  ]
    .filter(Boolean)
    .join("\n");
}

async function handleSubmitSnapshot(
  client: CanvasClient,
  args: Record<string, string>
): Promise<string> {
  const { courseId, snapshotId } = submitSnapshotSchema.parse(args);
  const jwt = await getPortflowJwt(client, courseId);

  await submitSnapshotToCanvas(jwt, snapshotId);

  return `Snapshot ${snapshotId} succesvol ingeleverd bij de Canvas opdracht in cursus ${courseId}.`;
}

const updateCollectionSchema = z.object({
  courseId: courseIdParam,
  portfolioId: z.string().regex(/^\d+$/).optional(),
  sectionName: z.string().min(1),
  collectionName: z.string().min(1),
  description: z.string().optional(),
  subtitle: z.string().optional(),
  color: z.string().optional(),
});

async function handleUpdateCollection(
  client: CanvasClient,
  args: Record<string, string>
): Promise<string> {
  const { courseId, portfolioId: portfolioIdStr, sectionName, collectionName, description, subtitle, color } =
    updateCollectionSchema.parse(args);
  const jwt = await getPortflowJwt(client, courseId);

  let portfolioId: number;
  if (portfolioIdStr) {
    portfolioId = parseInt(portfolioIdStr, 10);
  } else {
    portfolioId = await getPortfolioId(jwt);
  }

  const sections = await listSections(jwt, portfolioId);
  const section = sections.find((s) => s.name.toLowerCase() === sectionName.toLowerCase());
  if (!section) {
    return `Sectie "${sectionName}" niet gevonden. Beschikbare secties: ${sections.map((s) => s.name).join(", ")}`;
  }

  const collections = await listCollections(jwt, portfolioId);
  const collection = collections.find(
    (c) => c.name.toLowerCase() === collectionName.toLowerCase() && c.section_id === section.id
  );
  if (!collection) {
    return `Collectie "${collectionName}" niet gevonden in sectie "${sectionName}".`;
  }

  const updates: Record<string, string> = {};
  if (description !== undefined) updates.description = description;
  if (subtitle !== undefined) updates.subtitle = subtitle;
  if (color !== undefined) updates.color = color;

  if (Object.keys(updates).length === 0) {
    return "Geen velden opgegeven om bij te werken (description, subtitle of color).";
  }

  await updateCollection(jwt, portfolioId, collection.id, updates);

  const updated = Object.keys(updates).join(", ");
  return `Collectie "${collection.name}" (ID: ${collection.id}) bijgewerkt. Gewijzigde velden: ${updated}.`;
}

const listGoalsSchema = z.object({ courseId: courseIdParam, portfolioId: z.string().regex(/^\d+$/).optional() });

async function handleListGoals(client: CanvasClient, args: Record<string, string>): Promise<string> {
  const { courseId, portfolioId: portfolioIdStr } = listGoalsSchema.parse(args);
  const jwt = await getPortflowJwt(client, courseId);
  const portfolioId = portfolioIdStr ? parseInt(portfolioIdStr, 10) : await getPortfolioId(jwt);
  const goals = await listGoals(jwt, portfolioId);

  if (goals.length === 0) return "Geen goals gevonden in dit portfolio.";

  const repoGoals = goals.filter((g) => g.type === "repository");
  const portGoals = goals.filter((g) => g.type === "portfolio");

  const fmt = (gs: typeof goals) =>
    gs.map((g) => `  [${g.id}] ${g.name} — ${g.evidence_count} bewijs, ${g.sub_goals_count} sub-goals`).join("\n");

  const parts: string[] = [];
  if (repoGoals.length > 0) parts.push(`**Competenties (dit semester):**\n${fmt(repoGoals)}`);
  if (portGoals.length > 0) parts.push(`**Portfolio goals (vorige semesters):**\n${fmt(portGoals)}`);
  return parts.join("\n\n");
}

const addEvidenceSchema = z.object({
  courseId: courseIdParam,
  portfolioId: z.string().regex(/^\d+$/, "portfolioId mag alleen cijfers bevatten").optional(),
  name: z.string().min(1, "Naam is verplicht").max(200),
  content: z.string().min(1, "Inhoud is verplicht"),
  sectionName: z.string().optional(),
  collectionName: z.string().optional(),
  goalIds: z.string().optional(),
  goalJustification: z.string().optional(),
});

async function handleAddEvidence(
  client: CanvasClient,
  args: Record<string, string>
): Promise<string> {
  const {
    courseId,
    portfolioId: portfolioIdStr,
    name,
    content,
    sectionName,
    collectionName,
    goalIds: goalIdsStr,
    goalJustification,
  } = addEvidenceSchema.parse(args);
  const jwt = await getPortflowJwt(client, courseId);

  let portfolioId: number;
  if (portfolioIdStr) {
    portfolioId = parseInt(portfolioIdStr, 10);
  } else {
    portfolioId = await getPortfolioId(jwt);
  }

  // Verwerk comma-separated goalIds
  const goalIds: number[] =
    goalIdsStr
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map(Number)
      .filter((n) => !isNaN(n)) ?? [];

  let collectionIds: number[] = [];

  if (sectionName || collectionName) {
    const sections = await listSections(jwt, portfolioId);

    let sectionId!: number;
    if (sectionName) {
      const existing = sections.find(
        (s) => s.name.toLowerCase() === sectionName.toLowerCase()
      );
      if (existing) {
        sectionId = existing.id;
      } else {
        const newSection = await createSection(jwt, portfolioId, sectionName);
        sectionId = newSection.id;
      }
    } else {
      sectionId = sections[0]?.id;
    }

    if (collectionName && sectionId) {
      const collections = await listCollections(jwt, portfolioId);
      const existingCol = collections.find(
        (c) =>
          c.name.toLowerCase() === collectionName.toLowerCase() &&
          c.section_id === sectionId
      );
      if (existingCol) {
        collectionIds = [existingCol.id];
      } else {
        const newCol = await createCollection(jwt, portfolioId, collectionName, sectionId);
        collectionIds = [newCol.id];
      }
    }
  }

  const evidence = await createFreeTextEvidence(jwt, portfolioId, name, content, {
    collectionIds,
    goalIds,
    goalJustification,
  });

  const parts: string[] = [
    `Bewijs "${evidence.name}" (ID: ${evidence.id}) aangemaakt.`,
    `Type: ${evidence.latest_version_type} | Aangemaakt: ${evidence.created_at}`,
  ];
  if (collectionIds.length > 0)
    parts.push(`Gekoppeld aan ${collectionIds.length} collectie(s).`);
  if (goalIds.length > 0)
    parts.push(
      `Gelinkt aan ${goalIds.length} goal(s)${goalJustification ? " met justification" : ""}.`
    );
  return parts.join("\n");
}

export const portflowTools = [
  {
    name: "portflow_list_goals",
    description:
      "Haal alle Portflow goals (competenties) op voor het portfolio. Geeft ID, naam en het aantal gekoppelde bewijzen. Gebruik de IDs bij portflow_add_evidence om bewijs aan goals te koppelen.",
    inputSchema: {
      type: "object" as const,
      properties: {
        courseId: { type: "string", description: "Canvas cursus-ID (bijv. 15807)." },
        portfolioId: { type: "string", description: "Optioneel: portfolio ID." },
      },
      required: ["courseId"],
    },
    schema: listGoalsSchema,
    handler: handleListGoals,
  },
  {
    name: "portflow_list_snapshots",
    description:
      "Haal alle Portflow snapshots (frozen portfolios) op voor de ingelogde gebruiker. Geeft ID, naam, aanmaakdatum en het aantal Canvas-inleveringen terug.",
    inputSchema: {
      type: "object" as const,
      properties: {
        courseId: {
          type: "string",
          description:
            "Canvas cursus-ID om de Portflow sessie te starten (bijv. 15807).",
        },
      },
      required: ["courseId"],
    },
    schema: listSnapshotsSchema,
    handler: handleListSnapshots,
  },
  {
    name: "portflow_get_snapshot",
    description:
      "Haal de details op van een specifiek Portflow snapshot op basis van het snapshot-ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        courseId: {
          type: "string",
          description: "Canvas cursus-ID voor de Portflow sessie.",
        },
        snapshotId: {
          type: "string",
          description: "Het numerieke ID van het snapshot (zie portflow_list_snapshots).",
        },
      },
      required: ["courseId", "snapshotId"],
    },
    schema: getSnapshotSchema,
    handler: handleGetSnapshot,
  },
  {
    name: "portflow_submit_snapshot",
    description:
      "Lever een Portflow snapshot in bij de Canvas opdracht die is gekoppeld aan de huidige sessie. Let op: de Canvas opdracht wordt bepaald door de LTI launch in de opgegeven cursus — gebruik de cursus waaraan de Portflow opdracht is gekoppeld.",
    inputSchema: {
      type: "object" as const,
      properties: {
        courseId: {
          type: "string",
          description:
            "Canvas cursus-ID van de cursus waar de opdracht in staat (bijv. 15807).",
        },
        snapshotId: {
          type: "string",
          description: "Het numerieke ID van het snapshot dat ingeleverd moet worden.",
        },
      },
      required: ["courseId", "snapshotId"],
    },
    schema: submitSnapshotSchema,
    handler: handleSubmitSnapshot,
  },
  {
    name: "portflow_add_evidence",
    description:
      "Voeg een stuk vrije tekst toe als bewijs (evidence) aan een Portflow portfolio. Optioneel in een bestaande of nieuwe sectie + collectie. Bewijs wordt zichtbaar in de Portflow UI.",
    inputSchema: {
      type: "object" as const,
      properties: {
        courseId: {
          type: "string",
          description: "Canvas cursus-ID om de Portflow sessie te starten (bijv. 15807).",
        },
        portfolioId: {
          type: "string",
          description: "Optioneel: het numerieke ID van het portfolio (standaard: automatisch ophalen).",
        },
        name: {
          type: "string",
          description: "Naam/titel van het bewijs (max 200 tekens).",
        },
        content: {
          type: "string",
          description: "HTML-inhoud van het bewijs, bijv. '<p>Mijn reflectie...</p>'.",
        },
        sectionName: {
          type: "string",
          description: "Optioneel: naam van de sectie om het bewijs in te plaatsen. Wordt aangemaakt als niet bestaat.",
        },
        collectionName: {
          type: "string",
          description: "Optioneel: naam van de collectie binnen de sectie. Wordt aangemaakt als niet bestaat.",
        },
        goalIds: {
          type: "string",
          description: "Optioneel: comma-separated lijst van goal-IDs om het bewijs aan te koppelen (bijv. '471123,471120'). Gebruik portflow_list_goals voor de beschikbare IDs.",
        },
        goalJustification: {
          type: "string",
          description: "Optioneel: motivatie waarom dit bewijs bijdraagt aan de opgegeven goals. Wordt opgeslagen bij de goal-koppeling. Vereist dat ook collectionName en goalIds zijn opgegeven.",
        },
      },
      required: ["courseId", "name", "content"],
    },
    schema: addEvidenceSchema,
    handler: handleAddEvidence,
  },
  {
    name: "portflow_update_collection",
    description:
      "Werk de beschrijving, ondertitel of kleur van een bestaande Portflow collectie bij. Zoekt de collectie op via secties- en collectienaam. Gebruik dit om de collection description te schrijven.",
    inputSchema: {
      type: "object" as const,
      properties: {
        courseId: {
          type: "string",
          description: "Canvas cursus-ID om de Portflow sessie te starten (bijv. 15807).",
        },
        portfolioId: {
          type: "string",
          description: "Optioneel: het numerieke ID van het portfolio.",
        },
        sectionName: {
          type: "string",
          description: "Naam van de sectie waarin de collectie staat (bijv. 'Open Learning FT Semester 3 – Fall 26').",
        },
        collectionName: {
          type: "string",
          description: "Naam van de collectie die bijgewerkt moet worden (bijv. 'Personal project').",
        },
        description: {
          type: "string",
          description: "Nieuwe HTML-beschrijving voor de collectie.",
        },
        subtitle: {
          type: "string",
          description: "Nieuwe ondertitel voor de collectie (korte tekst, plain text).",
        },
        color: {
          type: "string",
          description: "Nieuwe kleur als hex-code (bijv. '#cddc39').",
        },
      },
      required: ["courseId", "sectionName", "collectionName"],
    },
    schema: updateCollectionSchema,
    handler: handleUpdateCollection,
  },
];
