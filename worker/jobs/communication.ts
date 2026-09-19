import { CommunicationService, type DispatchInput, type DispatchResult } from "../domain/communication/service";

/** Queue handler seam: consumers load the opaque touch reference, then call this with freshly-read state. */
export async function dispatchCommunicationTouch(service: CommunicationService, input: DispatchInput): Promise<DispatchResult> {
  return service.dispatch(input);
}

/** Explicit pause commands are used by webhooks/lifecycle events; no reminder or agent bypass exists here. */
export async function pauseCommunicationForEvent(service: CommunicationService, input: { tenantId: string; contactId: string; reason: "reply" | "booking" | "conversion" | "consent_loss" | "invalid_contact" }): Promise<void> {
  await service.pause(input.tenantId, input.contactId, input.reason);
}
