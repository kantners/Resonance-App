// Session Study routes (HANDOFF §4–5, §9.1; amendments A1–A4, C11).
// Every route uses requireAuth; practitioner routes also require a
// practitioners row and ownership of the protocol; client routes require
// being the enrollment's client. Responses go through server/study/serialize.
import type { Express, Request } from "express";
import { z } from "zod";
import {
  zStudyArms, zAnalysisScale, zPosture,
  type StudyProtocol, type StudyArm, type Practitioner, type User,
} from "@shared/schema";
import { STUDY_TEMPLATES } from "@shared/studyTemplates";
import {
  allocationHash, buildAllocationList, nextAllocationRow, pairedContrast, parseContrast,
  practitionerResultsVisible, qualityPanel, RULE_VERSION, type AllocationRow, type SessionRecord,
} from "../rules";
import { badRequest, conflict, forbidden, idParam, notFound, requireAuth, userId } from "../http";
import {
  toClientEnrollment, toClientSession, toInviteProtocol, toPractitionerEnrollment,
  toPractitionerProtocol, toPractitionerSession,
} from "../study/serialize";
import { type SessionContext, UniqueViolation } from "../storage/types";
import type { RouteDeps } from ".";

const zIsoInstant = z.string().refine(s => !Number.isNaN(Date.parse(s)) && /T/.test(s), "Expected an ISO date-time");
const zContrast = z.string().regex(/^[A-D]-[A-D]$/, 'Expected a contrast like "A-B"');

const zProtocolFields = z.object({
  question: z.string().trim().min(1).max(500),
  primaryOutcome: z.string().trim().min(1).max(500),
  primaryContrast: zContrast,
  secondaryContrast: zContrast.nullable().optional(),
  conditions: zStudyArms,
  targetClients: z.number().int().min(2).max(1000),
  minDaysBetween: z.number().int().min(0).max(365).nullable().optional(),
  withholdingProcedure: z.string().max(5000).default(""),
  commitmentText: z.string().trim().min(1).max(5000),
  closingReikiForAll: z.boolean().default(true),
  consentVersion: z.string().trim().min(1).max(40).default("1"),
  analysisScale: zAnalysisScale.default("ln"),
  readingDevice: z.string().trim().max(120).nullable().optional(),
});

const zProtocolCreate = zProtocolFields.extend({ supersedesId: z.number().int().positive().optional() }).strict();

const zReading = z.object({
  takenAt: zIsoInstant,
  rmssdMs: z.number().positive().max(400),
  hrBpm: z.number().min(20).max(220),
  posture: zPosture,
  breathsPerMin: z.number().positive().max(60).nullable().optional(),
  readingDevice: z.string().trim().min(1).max(120),
}).strict();

const zClientPatch = z.object({
  preReading: zReading.optional(),
  postReading: zReading.optional(),
  relaxPre: z.number().int().min(0).max(10).optional(),
  relaxPost: z.number().int().min(0).max(10).optional(),
  clientGuess: z.string().min(1).max(20).optional(),
}).strict();

const zPractitionerPatch = z.object({
  intentionHeldRating: z.number().int().min(0).max(10).nullable().optional(),
  driftCount: z.number().int().min(0).max(1000).optional(),
  checklist: z.record(z.boolean()).nullable().optional(),
  deviations: z.string().max(5000).nullable().optional(),
  stonesNotes: z.string().max(5000).nullable().optional(),
  clientReport: z.string().max(5000).nullable().optional(),
  closingReikiGiven: z.boolean().nullable().optional(),
  completed: z.boolean().optional(),
}).strict();

const zTouchProfile = z.record(z.string().min(1).max(40), z.enum(["hands_on", "hovering", "no_touch"]))
  .refine(p => Object.keys(p).length > 0, "The touch profile needs at least one area");

const arms = (p: StudyProtocol): StudyArm[] => JSON.parse(p.conditions);

function validateContrasts(conditions: StudyArm[], primary: string, secondary?: string | null) {
  const codes = new Set(conditions.map(a => a.code));
  for (const c of [primary, secondary].filter(Boolean) as string[]) {
    const [x, y] = parseContrast(c);
    if (!codes.has(x as any) || !codes.has(y as any)) throw badRequest(`Contrast ${c} refers to an arm that doesn't exist`);
  }
}

export function registerStudyRoutes(app: Express, deps: RouteDeps) {
  const { storage } = deps;

  async function practitionerOf(req: Request): Promise<Practitioner> {
    const p = await storage.getPractitionerByUserId(userId(req));
    if (!p) throw forbidden("Practitioner mode isn't set up for this account");
    return p;
  }

  async function ownProtocol(req: Request): Promise<{ practitioner: Practitioner; protocol: StudyProtocol }> {
    const practitioner = await practitionerOf(req);
    const protocol = await storage.getProtocol(idParam(req));
    if (!protocol || protocol.practitionerId !== practitioner.id) throw notFound("Protocol not found");
    return { practitioner, protocol };
  }

  async function isDemoProtocol(p: StudyProtocol): Promise<boolean> {
    const pr = await storage.getPractitioner(p.practitionerId);
    const u = pr ? await storage.getUserById(pr.userId) : null;
    return !!u?.isDemo;
  }

  /** The session and the caller's role on it; 404 for anyone else (no existence leak). */
  async function sessionFor(req: Request, sessionId: number): Promise<{ ctx: SessionContext; role: "practitioner" | "client" }> {
    const uid = userId(req);
    const ctx = await storage.getSessionContext(sessionId);
    if (!ctx) throw notFound("Session not found");
    const practitioner = await storage.getPractitionerByUserId(uid);
    if (practitioner && ctx.protocol.practitionerId === practitioner.id) return { ctx, role: "practitioner" };
    if (ctx.enrollment.clientUserId === uid) return { ctx, role: "client" };
    throw notFound("Session not found");
  }

  function assertActive(ctx: SessionContext) {
    if (!ctx.protocol.lockedAt) throw conflict("The protocol isn't locked");
    if (ctx.protocol.completedAt) throw conflict("The study is complete");
    if (ctx.enrollment.withdrawnAt) throw conflict("This client has withdrawn");
  }

  // ── Practitioner setup and templates ──────────────────────────────────────
  app.post("/api/practitioner", requireAuth, async (req, res) => {
    const { practiceName } = z.object({ practiceName: z.string().trim().max(120).nullable().optional() }).strict().parse(req.body ?? {});
    try {
      res.json(await storage.createPractitioner(userId(req), practiceName ?? null));
    } catch (e) {
      if (e instanceof UniqueViolation) throw conflict("Practitioner mode is already set up");
      throw e;
    }
  });

  app.get("/api/study/templates", requireAuth, (_req, res) => {
    res.json(STUDY_TEMPLATES);
  });

  // ── Protocols (practitioner) ──────────────────────────────────────────────
  app.post("/api/study/protocols", requireAuth, async (req, res) => {
    const practitioner = await practitionerOf(req);
    const body = zProtocolCreate.parse(req.body);
    validateContrasts(body.conditions, body.primaryContrast, body.secondaryContrast);
    let version = 1;
    if (body.supersedesId) {
      const prev = await storage.getProtocol(body.supersedesId);
      if (!prev || prev.practitionerId !== practitioner.id) throw notFound("Protocol not found");
      if (!prev.lockedAt) throw conflict("Edit the draft instead; only locked protocols get a new version");
      version = prev.version + 1;
    }
    const { supersedesId, conditions, ...fields } = body;
    const protocol = await storage.createProtocol({
      ...fields,
      practitionerId: practitioner.id,
      version,
      supersedesId: supersedesId ?? null,
      conditions: JSON.stringify(conditions),
      design: "crossover",
      secondaryContrast: fields.secondaryContrast ?? null,
      minDaysBetween: fields.minDaysBetween ?? null,
      readingDevice: fields.readingDevice ?? null,
    });
    res.status(201).json(toPractitionerProtocol(protocol));
  });

  app.patch("/api/study/protocols/:id", requireAuth, async (req, res) => {
    const { protocol } = await ownProtocol(req);
    if (protocol.lockedAt) throw conflict("A locked protocol can't change. Create a new version instead.");
    const patch = zProtocolFields.partial().strict().parse(req.body);
    const conditions = patch.conditions ?? arms(protocol);
    validateContrasts(conditions, patch.primaryContrast ?? protocol.primaryContrast, patch.secondaryContrast ?? protocol.secondaryContrast);
    const { conditions: c, ...rest } = patch;
    const updated = await storage.updateDraftProtocol(protocol.id, { ...rest, ...(c ? { conditions: JSON.stringify(c) } : {}) });
    if (!updated) throw conflict("A locked protocol can't change. Create a new version instead.");
    res.json(toPractitionerProtocol(updated));
  });

  app.get("/api/study/protocols", requireAuth, async (req, res) => {
    const practitioner = await practitionerOf(req);
    res.json((await storage.listProtocols(practitioner.id)).map(toPractitionerProtocol));
  });

  app.get("/api/study/protocols/:id", requireAuth, async (req, res) => {
    const { protocol } = await ownProtocol(req);
    const [enrollments, contexts] = await Promise.all([storage.listEnrollments(protocol.id), storage.listSessionContexts(protocol.id)]);
    res.json({
      protocol: toPractitionerProtocol(protocol),
      isDemo: await isDemoProtocol(protocol),
      enrollments: enrollments.map(toPractitionerEnrollment),
      progress: progress(protocol, enrollments.filter(e => !e.withdrawnAt).length, contexts),
    });
  });

  app.post("/api/study/protocols/:id/lock", requireAuth, async (req, res) => {
    const { protocol } = await ownProtocol(req);
    if (protocol.lockedAt) throw conflict("The protocol is already locked");
    if (!protocol.withholdingProcedure.trim()) throw badRequest("Write the withholding procedure before locking the protocol");
    if (!protocol.readingDevice?.trim()) throw badRequest("Name the reading device (device + app) before locking the protocol");
    const conditions = zStudyArms.parse(arms(protocol));
    validateContrasts(conditions, protocol.primaryContrast, protocol.secondaryContrast);

    // A1: the whole allocation list, generated once, hashed with a secret nonce.
    const list = buildAllocationList(conditions.map(a => a.code), protocol.targetClients, deps.randomInt);
    const nonce = deps.randomHex(16);
    const locked = await storage.lockProtocol(protocol.id, {
      lockedAt: deps.now(),
      allocationList: JSON.stringify(list),
      allocationNonce: nonce,
      allocationSha256: allocationHash(nonce, list),
    });
    if (!locked) throw conflict("The protocol is already locked");
    res.json(toPractitionerProtocol(locked));
  });

  app.post("/api/study/protocols/:id/complete", requireAuth, async (req, res) => {
    const { protocol } = await ownProtocol(req);
    const done = await storage.completeProtocol(protocol.id, deps.now());
    if (!done) throw conflict(protocol.completedAt ? "The study is already complete" : "The protocol isn't locked");
    res.json(toPractitionerProtocol(done));
  });

  app.get("/api/study/protocols/:id/sessions", requireAuth, async (req, res) => {
    const { protocol } = await ownProtocol(req);
    const contexts = await storage.listSessionContexts(protocol.id);
    res.json(contexts.map(c => toPractitionerSession(c.session, c.protocol, c.enrollment.clientCode)));
  });

  app.get("/api/study/protocols/:id/results", requireAuth, async (req, res) => {
    const { protocol } = await ownProtocol(req);
    const [enrollments, contexts] = await Promise.all([storage.listEnrollments(protocol.id), storage.listSessionContexts(protocol.id)]);
    res.json(await results(protocol, enrollments.filter(e => !e.withdrawnAt).length, contexts));
  });

  app.get("/api/study/protocols/:id/export", requireAuth, async (req, res) => {
    const { protocol, practitioner } = await ownProtocol(req);
    const part = z.enum(["all", "methods", "sessions", "deviations", "results"]).default("all").parse(req.query.part ?? "all");
    const [enrollments, contexts] = await Promise.all([storage.listEnrollments(protocol.id), storage.listSessionContexts(protocol.id)]);
    const r = await results(protocol, enrollments.filter(e => !e.withdrawnAt).length, contexts);
    const demo = await isDemoProtocol(protocol);
    const text = exportText(part, protocol, practitioner, contexts, r, enrollments.filter(e => e.withdrawnAt).length, demo);
    const ext = part === "methods" || part === "all" ? "txt" : "csv";
    res.setHeader("Content-Type", ext === "csv" ? "text/csv; charset=utf-8" : "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="resonance-study-${protocol.id}-v${protocol.version}-${part}.${ext}"`);
    res.send(text);
  });

  // ── Invite and enrollment (client) ────────────────────────────────────────
  app.get("/api/study/invite/:id", requireAuth, async (req, res) => {
    const protocol = await storage.getProtocol(idParam(req));
    if (!protocol || !protocol.lockedAt) throw notFound("Study not found");
    const pr = await storage.getPractitioner(protocol.practitionerId);
    res.json(toInviteProtocol(protocol, pr?.displayCode ?? "Practitioner", pr?.practiceName ?? null));
  });

  app.post("/api/study/enrollments", requireAuth, async (req, res) => {
    const uid = userId(req);
    const body = z.object({
      protocolId: z.number().int().positive(),
      consentVersion: z.string().min(1).max(40),
      touchProfile: zTouchProfile,
    }).strict().parse(req.body);

    const protocol = await storage.getProtocol(body.protocolId);
    if (!protocol) throw notFound("Study not found");
    if (!protocol.lockedAt) throw conflict("This study isn't open: its protocol hasn't been locked");
    if (protocol.completedAt) throw conflict("This study is complete");
    if (body.consentVersion !== protocol.consentVersion) throw conflict("The consent text has changed. Please read the current version.");

    const client = (await storage.getUserById(uid)) as User;
    const practitioner = await storage.getPractitioner(protocol.practitionerId);
    if (practitioner?.userId === uid) throw conflict("A practitioner can't enroll in their own study");
    // C11: demo accounts never join real studies, and real clients never join demo studies.
    if (client.isDemo !== (await isDemoProtocol(protocol))) {
      throw forbidden(client.isDemo ? "Demo accounts can't join a real study" : "This is a demo study; real accounts can't join it");
    }

    const list: AllocationRow[] = JSON.parse(protocol.allocationList ?? "[]");
    for (let attempt = 0; attempt < 5; attempt++) {
      const existing = await storage.listEnrollments(protocol.id);
      if (existing.some(e => e.clientUserId === uid)) throw conflict("You're already enrolled in this study");
      // A1: take the next unused row of the list fixed at lock; never generate one.
      const row = nextAllocationRow(list, new Set(existing.map(e => e.allocationIndex)));
      if (!row) throw conflict("This study is full");
      const now = deps.now();
      try {
        const enrollment = await storage.createEnrollmentWithSessions({
          protocolId: protocol.id,
          clientUserId: uid,
          clientCode: `C-${String(row.index + 1).padStart(3, "0")}`,
          consentVersion: body.consentVersion,
          consentedAt: now,
          touchProfile: JSON.stringify(body.touchProfile),
          touchProfileLockedAt: now,
          allocationIndex: row.index,
          conditionSequence: JSON.stringify(row.sequence),
          sequenceBlock: row.block,
        }, row.sequence);
        res.status(201).json({ enrollmentId: enrollment.id, clientCode: enrollment.clientCode });
        return;
      } catch (e) {
        if (e instanceof UniqueViolation && e.constraint !== "enrollment_protocol_client") continue;  // row taken concurrently
        if (e instanceof UniqueViolation) throw conflict("You're already enrolled in this study");
        throw e;
      }
    }
    throw conflict("Enrollment is busy; please try again");
  });

  app.get("/api/study/enrollments/mine", requireAuth, async (req, res) => {
    const uid = userId(req);
    const out = [];
    for (const e of await storage.listEnrollmentsForClient(uid)) {
      const protocol = (await storage.getProtocol(e.protocolId))!;
      const contexts = (await storage.listSessionContexts(protocol.id)).filter(c => c.enrollment.id === e.id);
      const pr = await storage.getPractitioner(protocol.practitionerId);
      out.push({
        enrollment: toClientEnrollment(e),
        study: toInviteProtocol(protocol, pr?.displayCode ?? "Practitioner", pr?.practiceName ?? null),
        sessions: contexts.map(c => toClientSession(c.session, c.protocol)),
      });
    }
    res.json(out);
  });

  // Withdraw and delete study data (§6). The row stays as an anonymised tombstone.
  app.delete("/api/study/enrollments/:id", requireAuth, async (req, res) => {
    const e = await storage.getEnrollment(idParam(req));
    if (!e || e.clientUserId !== userId(req)) throw notFound("Enrollment not found");
    await storage.withdrawEnrollment(e.id, deps.now());
    res.json({ ok: true, withdrawn: true });
  });

  // ── Sessions ──────────────────────────────────────────────────────────────
  app.get("/api/study/sessions/:id", requireAuth, async (req, res) => {
    const { ctx, role } = await sessionFor(req, idParam(req));
    res.json(role === "practitioner"
      ? toPractitionerSession(ctx.session, ctx.protocol, ctx.enrollment.clientCode)
      : toClientSession(ctx.session, ctx.protocol));
  });

  // §4.3: the practitioner learns the condition only here, and only after the
  // face-up pre-reading is stored. Every reveal is logged.
  app.post("/api/study/sessions/:id/start", requireAuth, async (req, res) => {
    const { ctx, role } = await sessionFor(req, idParam(req));
    if (role !== "practitioner") throw notFound("Session not found");
    assertActive(ctx);
    const s = ctx.session;
    if (s.preRmssdMs == null || s.prePosture !== "face_up") {
      throw conflict("Take the face-up pre-reading before revealing the condition");
    }
    const revealed = (await storage.markRevealed(s.id, deps.now()))!;
    console.info(`[study] reveal session=${s.id} protocol=${ctx.protocol.id} client=${ctx.enrollment.clientCode} at=${revealed.conditionRevealedAt?.toISOString()}`);
    const arm = arms(ctx.protocol).find(a => a.code === s.condition)!;
    res.json({
      sessionId: s.id,
      condition: s.condition,
      label: arm.label,
      touch: arm.touch,
      intention: arm.intention,
      breathPacing: arm.breathPacing,
      conditionRevealedAt: revealed.conditionRevealedAt,
      // Shown before every session where intention is withheld (B and C in the template).
      ...(arm.intention ? {} : { withholdingProcedure: ctx.protocol.withholdingProcedure }),
    });
  });

  // Practitioner fields only.
  app.patch("/api/study/sessions/:id", requireAuth, async (req, res) => {
    const { ctx, role } = await sessionFor(req, idParam(req));
    if (role !== "practitioner") throw notFound("Session not found");
    assertActive(ctx);
    const { completed, checklist, ...fields } = zPractitionerPatch.parse(req.body);
    if (!ctx.session.conditionRevealedAt) throw conflict("Start the session before recording it");
    const patch: Record<string, unknown> = { ...fields };
    if (checklist !== undefined) patch.checklist = checklist == null ? null : JSON.stringify(checklist);
    if (completed !== undefined) {
      if (completed && ctx.session.postRmssdMs == null) throw conflict("The post-reading is needed before the session is complete");
      patch.completedAt = completed ? deps.now() : null;
    }
    const s = await storage.updateSession(ctx.session.id, patch);
    res.json(toPractitionerSession(s!, ctx.protocol, ctx.enrollment.clientCode));
  });

  // Client fields: readings, relaxation, and the guess from the client's own device.
  app.patch("/api/study/sessions/:id/client", requireAuth, async (req, res) => {
    const { ctx, role } = await sessionFor(req, idParam(req));
    if (role !== "client") throw notFound("Session not found");
    assertActive(ctx);
    const body = zClientPatch.parse(req.body);
    const s = ctx.session;
    const patch: Record<string, unknown> = {};

    if (body.preReading) {
      if (s.conditionRevealedAt) throw conflict("The pre-reading can't change after the session has started");
      const r = body.preReading;
      Object.assign(patch, { preTakenAt: r.takenAt, preRmssdMs: r.rmssdMs, preHrBpm: r.hrBpm, prePosture: r.posture,
        preBreathsPerMin: r.breathsPerMin ?? null, preReadingDevice: r.readingDevice });
    }
    if (body.postReading) {
      if (!s.conditionRevealedAt) throw conflict("The post-reading comes after the session");
      const r = body.postReading;
      Object.assign(patch, { postTakenAt: r.takenAt, postRmssdMs: r.rmssdMs, postHrBpm: r.hrBpm, postPosture: r.posture,
        postBreathsPerMin: r.breathsPerMin ?? null, postReadingDevice: r.readingDevice });
    }
    if (body.relaxPre !== undefined) patch.relaxPre = body.relaxPre;
    if (body.relaxPost !== undefined) patch.relaxPost = body.relaxPost;
    if (body.clientGuess !== undefined) {
      if (s.postRmssdMs == null && !body.postReading) throw conflict("The guess comes after the post-reading");
      const allowed = new Set([...arms(ctx.protocol).map(a => a.code as string), "not_sure"]);
      if (!allowed.has(body.clientGuess)) throw badRequest("Unknown guess");
      patch.clientGuess = body.clientGuess;
    }
    const updated = await storage.updateSession(s.id, patch);
    res.json(toClientSession(updated!, ctx.protocol));
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  function progress(protocol: StudyProtocol, activeClients: number, contexts: SessionContext[]) {
    const active = contexts.filter(c => !c.enrollment.withdrawnAt);
    const byEnrollment = new Map<number, SessionContext[]>();
    for (const c of active) byEnrollment.set(c.enrollment.id, [...(byEnrollment.get(c.enrollment.id) ?? []), c]);
    const clientsComplete = [...byEnrollment.values()].filter(cs => cs.every(c => c.session.completedAt)).length;
    const visits = arms(protocol).length;
    return {
      clientsEnrolled: activeClients,
      clientsComplete,
      targetClients: protocol.targetClients,
      sessionsComplete: active.filter(c => c.session.completedAt).length,
      targetSessions: protocol.targetClients * visits,
    };
  }

  async function results(protocol: StudyProtocol, activeClients: number, contexts: SessionContext[]) {
    // Only sessions whose condition has been revealed can carry readings on
    // both sides, so nothing here exposes an unrevealed condition (A4).
    const records: SessionRecord[] = contexts
      .filter(c => c.session.conditionRevealedAt != null || c.protocol.completedAt != null)
      .map(c => ({
        id: c.session.id, enrollmentId: c.enrollment.id, clientCode: c.enrollment.clientCode,
        practitionerId: c.protocol.practitionerId, condition: c.session.condition,
        preRmssdMs: c.session.preRmssdMs, postRmssdMs: c.session.postRmssdMs,
        preReadingDevice: c.session.preReadingDevice, postReadingDevice: c.session.postReadingDevice,
        clientGuess: c.session.completedAt ? c.session.clientGuess : null,
        intentionHeldRating: c.session.intentionHeldRating, driftCount: c.session.driftCount,
        deviations: c.session.deviations, withdrawn: c.enrollment.withdrawnAt != null,
      }));
    const scale = protocol.analysisScale as "linear" | "ln";   // A2: from the locked protocol, never the env flag
    return {
      protocolId: protocol.id,
      version: protocol.version,
      analysisScale: scale,
      readingDevice: protocol.readingDevice,
      allocationSha256: protocol.allocationSha256,
      ruleVersion: RULE_VERSION,
      isDemo: await isDemoProtocol(protocol),
      progress: progress(protocol, activeClients, contexts),
      primary: pairedContrast(records, protocol.primaryContrast, scale, protocol.targetClients),
      secondary: protocol.secondaryContrast ? pairedContrast(records, protocol.secondaryContrast, scale, protocol.targetClients) : null,
      quality: qualityPanel(records, protocol.primaryContrast, protocol.readingDevice),
      perPractitionerVisible: practitionerResultsVisible(records, protocol.primaryContrast),
    };
  }
}

// ─── Export (§4.6): CSV + methods text ────────────────────────────────────────
function csvCell(v: unknown): string {
  if (v == null) return "";
  const s = v instanceof Date ? v.toISOString() : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const csv = (rows: unknown[][]) => rows.map(r => r.map(csvCell).join(",")).join("\n") + "\n";

function exportText(
  part: "all" | "methods" | "sessions" | "deviations" | "results",
  p: StudyProtocol, practitioner: Practitioner, contexts: SessionContext[], r: any, withdrawn: number, demo: boolean,
): string {
  const banner = demo
    ? "ILLUSTRATIVE DATA. No primary data reported. This export was generated from demo data.\n\n"
    : "";
  const armsList: StudyArm[] = JSON.parse(p.conditions);
  const methods = [
    `Resonance Session Study: methods`,
    `Protocol ${p.id}, version ${p.version}${p.supersedesId ? ` (supersedes protocol ${p.supersedesId})` : ""}; ${practitioner.displayCode}`,
    `Locked: ${p.lockedAt?.toISOString() ?? "not locked"}; completed: ${p.completedAt?.toISOString() ?? "not complete"}`,
    ``,
    `Question: ${p.question}`,
    `Primary outcome: ${p.primaryOutcome}`,
    `Conditions:`,
    ...armsList.map(a => `  ${a.code}: ${a.label} (touch ${a.touch ? "yes" : "no"}, intention ${a.intention ? "on" : "withheld"}, breath pacing ${a.breathPacing ? "yes" : "no"})`),
    `Primary contrast: ${p.primaryContrast}; secondary: ${p.secondaryContrast ?? "none"}`,
    `Target: ${p.targetClients} clients; minimum days between sessions: ${p.minDaysBetween ?? "not set"}`,
    `Consent version: ${p.consentVersion}`,
    `Reading device (fixed at lock): ${p.readingDevice ?? "not set"}`,
    `Analysis scale (fixed at lock): ${p.analysisScale === "ln" ? "ln(rMSSD); effects reported as percent change" : "rMSSD in ms"}`,
    `Allocation method: every ordering of the conditions in shuffled blocks (2 arms: AB/BA; 3 arms: all 6 orderings; 4 arms: a Williams balanced Latin square), `
      + `generated with a cryptographic RNG for the full target when the protocol was locked. Enrollment takes the next unused row.`,
    `Allocation list SHA-256 (over canonical JSON of {nonce, list}): ${p.allocationSha256 ?? "not locked"}`,
    ...(p.completedAt
      ? [`Allocation nonce: ${p.allocationNonce}`, `Allocation list: ${p.allocationList}`]
      : [`The allocation list and nonce are published once the study is complete, so the hash can be checked.`]),
    `Closing Reiki for every client after all measurements: ${p.closingReikiForAll ? "yes" : "no"}`,
    `Withdrawn clients (excluded from analysis, data deleted): ${withdrawn}`,
    `Analysis code version: Resonance rules ${RULE_VERSION}`,
    ``,
    `Withholding procedure:`,
    p.withholdingProcedure,
    ``,
    `Practitioner's commitment:`,
    p.commitmentText,
    ``,
    `Results are findings observed in our sessions, not general claims.`,
  ].join("\n") + "\n";

  const sessions = csv([
    ["client_code", "visit", "condition", "condition_revealed_at", "pre_taken_at", "pre_rmssd_ms", "pre_hr_bpm", "pre_posture",
      "pre_breaths_per_min", "pre_reading_device", "post_taken_at", "post_rmssd_ms", "post_hr_bpm", "post_posture",
      "post_breaths_per_min", "post_reading_device", "relax_pre", "relax_post", "client_guess", "intention_held_rating",
      "drift_count", "has_deviation", "closing_reiki_given", "completed_at"],
    ...contexts.filter(c => !c.enrollment.withdrawnAt).map(({ session: s, enrollment: e, protocol }) => {
      const revealed = s.conditionRevealedAt != null || protocol.completedAt != null;
      return [e.clientCode, s.visitNumber, revealed ? s.condition : "", s.conditionRevealedAt, s.preTakenAt, s.preRmssdMs,
        s.preHrBpm, s.prePosture, s.preBreathsPerMin, s.preReadingDevice, s.postTakenAt, s.postRmssdMs, s.postHrBpm,
        s.postPosture, s.postBreathsPerMin, s.postReadingDevice, s.relaxPre, s.relaxPost, s.completedAt ? s.clientGuess : "",
        s.intentionHeldRating, s.driftCount, (s.deviations ?? "").trim() ? "yes" : "no", s.closingReikiGiven, s.completedAt];
    }),
  ]);

  const deviations = csv([
    ["client_code", "visit", "deviation"],
    ...contexts.filter(c => (c.session.deviations ?? "").trim()).map(c => [c.enrollment.clientCode, c.session.visitNumber, c.session.deviations]),
  ]);

  const fmt = (c: any) => c && c.ci ? [c.contrast, c.ci.n, c.ci.mean, c.ci.low, c.ci.high, c.verdictText] : [c?.contrast ?? "", 0, "", "", "", "Too early to tell."];
  const results = csv([
    ["contrast", "n_clients", "mean_difference", "ci95_low", "ci95_high", "verdict"],
    fmt(r.primary),
    ...(r.secondary ? [fmt(r.secondary)] : []),
    [],
    ["blinding_correct", "blinding_guesses", "chance", "mean_intention_held", "total_drift", "sessions_with_deviations", "device_mismatches"],
    [r.quality.blinding.correct, r.quality.blinding.guesses, r.quality.blinding.chance, r.quality.meanIntentionHeld,
      r.quality.totalDrift, r.quality.sessionsWithDeviations, r.quality.deviceMismatches.length],
  ]);

  const sections = { methods, sessions, deviations, results };
  if (part !== "all") return banner + sections[part];
  return banner + [
    `=== methods.txt ===`, methods,
    `=== sessions.csv ===`, sessions,
    `=== deviations.csv ===`, deviations,
    `=== results.csv ===`, results,
  ].join("\n");
}
