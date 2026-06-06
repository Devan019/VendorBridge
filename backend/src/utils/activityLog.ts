import prisma from "../utils/prisma";

/**
 * Write one ActivityLog row.
 *
 * @param entity_type  e.g. "RFQ" | "PurchaseOrder" | "Invoice" | "Quotation" | "Approval"
 * @param entity_id    UUID of the affected record
 * @param action       Short verb phrase, e.g. "CREATED", "STATUS_CHANGED:SENT", "APPROVED"
 * @param performed_by User ID who triggered the action
 */
export async function logActivity(
  entity_type: string,
  entity_id: string,
  action: string,
  performed_by: string
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: { entity_type, entity_id, action, performed_by },
    });
  } catch (err) {
    // Fire-and-forget: never crash the request if logging fails
    console.error("[activityLog] Failed to write log:", err);
  }
}
