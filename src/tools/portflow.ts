import { z } from "zod";
import { CanvasClient } from "../canvasClient.js";
import { getPortflowJwt } from "../portflow/auth.js";
import {
  listSnapshots,
  getSnapshot,
  submitSnapshotToCanvas,
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

export const portflowTools = [
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
];
