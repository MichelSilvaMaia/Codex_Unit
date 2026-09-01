import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/server/errors/app-error";
import { approveReservation, createReservation, rejectReservation, setReservationUrgency, submitReservationForApproval } from "@/server/reservations/reservation-service";

const suite = process.env.RUN_DB_INTEGRATION === "1" ? describe : describe.skip;
suite("PostgreSQL approval workflow", () => {
  const ids: string[] = [];
  afterAll(async () => { if (ids.length) await prisma.reservation.deleteMany({ where: { id: { in: ids } } }); await prisma.$disconnect(); });
  async function fixture(hour: number) {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: "empresa-demonstracao" } });
    const user = await prisma.user.findUniqueOrThrow({ where: { email: process.env.SEED_ADMIN_EMAIL ?? "admin@example.test" } });
    const customer = await prisma.customer.findUniqueOrThrow({ where: { tenantId_normalizedDocument: { tenantId: tenant.id, normalizedDocument: "DEMO0001" } } });
    const unit = await prisma.unit.findUniqueOrThrow({ where: { tenantId_code: { tenantId: tenant.id, code: "BASE-SP" } } });
    const resource = await prisma.resource.findUniqueOrThrow({ where: { tenantId_code: { tenantId: tenant.id, code: "CAB-001" } } });
    const permissions = new Set<string>(["reservations.create", "reservations.submit", "reservations.approve", "reservations.reject"]);
    const context = { tenantId: tenant.id, user: { id: user.id }, permissions };
    const reservation = await createReservation(context, { customerId: customer.id, unitId: unit.id, title: "Workflow approval", startAtLocal: `2031-03-10T${hour}:00`, endAtLocal: `2031-03-10T${hour + 1}:00`, resourceIds: [resource.id], status: "DRAFT" });
    ids.push(reservation.id); return { context, reservation };
  }
  it("explicitly allows a manager to submit and approve their own reservation", async () => {
    const { context, reservation } = await fixture(10);
    await submitReservationForApproval(context, reservation.id);
    const approved = await approveReservation(context, reservation.id);
    expect(approved).toMatchObject({ status: "APPROVED", createdByUserId: context.user.id, submittedByUserId: context.user.id, approvedByUserId: context.user.id });
    expect(await prisma.reservationApproval.count({ where: { reservationId: reservation.id, decision: "APPROVED" } })).toBe(1);
  });
  it("denies approval without the specific permission", async () => {
    const { context, reservation } = await fixture(12); await submitReservationForApproval(context, reservation.id);
    await expect(approveReservation({ ...context, permissions: new Set<string>() }, reservation.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("does not approve or mark urgent across authorization boundaries", async () => {
    const { context, reservation } = await fixture(16); await submitReservationForApproval(context, reservation.id);
    await expect(approveReservation({ ...context, tenantId: "00000000-0000-4000-8000-000000000099" }, reservation.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(setReservationUrgency({ ...context, permissions: new Set<string>() }, reservation.id, { isUrgent: true, reason: "Atendimento imediato" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("accepts only one concurrent approve versus reject decision", async () => {
    const { context, reservation } = await fixture(14); await submitReservationForApproval(context, reservation.id);
    const results = await Promise.allSettled([approveReservation(context, reservation.id), rejectReservation(context, reservation.id, { reason: "Necessidade não comprovada" })]);
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    const failed = results.find(({ status }) => status === "rejected") as PromiseRejectedResult;
    expect(failed.reason).toBeInstanceOf(AppError); expect(failed.reason.code).toBe("CONFLICT");
    expect(await prisma.reservationStatusHistory.count({ where: { reservationId: reservation.id, toStatus: { in: ["APPROVED", "REJECTED"] } } })).toBe(1);
  });
});
