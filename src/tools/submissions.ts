import { CanvasClient } from "../canvasClient.js";
import { fetchAllPages } from "../pagination.js";
import { formatDate } from "../utils/formatDate.js";
import { sanitizeText } from "../utils/sanitizeText.js";

interface SubmissionComment {
  author_name: string;
  created_at: string;
  comment: string;
}

interface CanvasSubmission {
  id: number;
  assignment_id: number;
  workflow_state: string;
  submitted_at: string | null;
  score: number | null;
  grade: string | null;
  late: boolean;
  missing: boolean;
  submission_comments?: SubmissionComment[];
  assignment?: {
    name: string;
    points_possible: number | null;
  };
}

const stateLabel: Record<string, string> = {
  submitted: "Ingeleverd",
  graded: "Beoordeeld",
  pending_review: "Wacht op beoordeling",
  unsubmitted: "Nog niet ingeleverd",
};

export async function listSubmissions(client: CanvasClient, courseId: string): Promise<string> {
  const submissions = await fetchAllPages<CanvasSubmission>(
    client,
    `/api/v1/courses/${courseId}/students/submissions`,
    {
      "student_ids[]": "self",
      "include[]": "assignment",
    } as Record<string, string>
  );

  const relevant = submissions.filter((s) => s.workflow_state !== "unsubmitted");

  if (relevant.length === 0) {
    return `Geen ingeleverde opdrachten gevonden voor cursus ${courseId}.`;
  }

  const lines = relevant.map((s) => {
    const name = sanitizeText(s.assignment?.name ?? `Opdracht ${s.assignment_id}`, 200);
    const state = stateLabel[s.workflow_state] ?? s.workflow_state;
    const grade = s.grade !== null ? ` | Cijfer: ${s.grade}` : "";
    const score =
      s.score !== null && s.assignment?.points_possible
        ? ` (${s.score}/${s.assignment.points_possible})`
        : "";
    const submittedAt = s.submitted_at ? ` | Ingeleverd: ${formatDate(s.submitted_at)}` : "";
    const late = s.late ? " ⚠ te laat" : "";
    return `- ${name}\n  Status: ${state}${grade}${score}${submittedAt}${late}`;
  });

  return `Indieningen voor cursus ${courseId} (${relevant.length}):\n\n${lines.join("\n")}`;
}

export async function getSubmission(
  client: CanvasClient,
  courseId: string,
  assignmentId: string
): Promise<string> {
  const s = await client.get<CanvasSubmission>(
    `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/self`,
    { "include[]": "submission_comments" } as Record<string, string>
  );

  if (s.workflow_state === "unsubmitted") {
    return `Je hebt opdracht ${assignmentId} nog niet ingeleverd.`;
  }

  const state = stateLabel[s.workflow_state] ?? s.workflow_state;
  const grade = s.grade !== null ? `Cijfer: ${s.grade}` : "Nog geen cijfer";
  const submittedAt = s.submitted_at ? formatDate(s.submitted_at) : "onbekend";
  const late = s.late ? " (te laat ingeleverd)" : "";

  const lines = [
    `Status: ${state}`,
    `Ingeleverd: ${submittedAt}${late}`,
    `${grade}`,
  ];

  const comments = s.submission_comments ?? [];
  if (comments.length > 0) {
    lines.push("", "Feedback:");
    for (const c of comments) {
      const date = formatDate(c.created_at);
      const author = sanitizeText(c.author_name, 100);
      const comment = sanitizeText(c.comment, 1000);
      lines.push(`  [${date}] ${author}: ${comment}`);
    }
  } else {
    lines.push("", "Geen feedbackopmerkingen.");
  }

  return lines.join("\n");
}

export const submissionTools = [
  {
    name: "canvas_list_submissions",
    description:
      "Haal alle eigen indieningen op voor een Canvas cursus, inclusief status en cijfer. Laat zien welke opdrachten ingeleverd en beoordeeld zijn.",
    inputSchema: {
      type: "object" as const,
      properties: {
        courseId: {
          type: "string",
          description: "Het Canvas course ID.",
        },
      },
      required: ["courseId"],
    },
    handler: (client: CanvasClient, args: Record<string, string>) =>
      listSubmissions(client, args.courseId),
  },
  {
    name: "canvas_get_submission",
    description:
      "Haal de details van je eigen indiening voor één opdracht op, inclusief cijfer en feedbackopmerkingen van de docent.",
    inputSchema: {
      type: "object" as const,
      properties: {
        courseId: {
          type: "string",
          description: "Het Canvas course ID.",
        },
        assignmentId: {
          type: "string",
          description: "Het Canvas assignment ID. Gebruik canvas_list_assignments om dit te vinden.",
        },
      },
      required: ["courseId", "assignmentId"],
    },
    handler: (client: CanvasClient, args: Record<string, string>) =>
      getSubmission(client, args.courseId, args.assignmentId),
  },
];
