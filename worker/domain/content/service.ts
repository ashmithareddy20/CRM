import { ApiError } from "../../api/errors";

export type TemplateStatus = "draft" | "reviewed" | "approved" | "active" | "retired";
export interface Template { id: string; tenantId: string; key: string; purpose: string; channel: string; status: TemplateStatus; createdByMembershipId: string; }
export interface TemplateVersion { id: string; tenantId: string; templateId: string; versionNumber: number; contentCiphertext: string; contentHash: string; variables: readonly string[]; assetIds: readonly string[]; createdByMembershipId: string; approvedAt?: Date; }
export interface ContentAsset { id: string; tenantId: string; objectKey: string; contentHash: string; mediaType: string; status: "quarantined" | "scanned" | "approved" | "rejected"; }
export interface TemplateRepository {
  getTemplate(tenantId: string, templateId: string): Promise<Template | undefined>;
  createTemplate(template: Template): Promise<void>;
  listVersions(tenantId: string, templateId: string): Promise<TemplateVersion[]>;
  addVersion(version: TemplateVersion): Promise<void>;
  approveVersion(input: { tenantId: string; versionId: string; approverMembershipId: string; at: Date }): Promise<TemplateVersion | undefined>;
  updateTemplateStatus(tenantId: string, templateId: string, status: TemplateStatus): Promise<void>;
  getAsset(tenantId: string, assetId: string): Promise<ContentAsset | undefined>;
  addAsset(asset: ContentAsset): Promise<void>;
}
const id = () => crypto.randomUUID();
const VARIABLE = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/;
const PRIVATE_KEY = /^[a-zA-Z0-9][a-zA-Z0-9/_-]{2,511}$/;
const MEDIA = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

/** Content bytes stay private; this service stores only an R2 object key and approved immutable snapshots. */
export class ContentService {
  constructor(private readonly repository: TemplateRepository) {}
  async createTemplate(input: Omit<Template, "id" | "status">): Promise<Template> {
    const template = { ...input, id: id(), status: "draft" as const };
    await this.repository.createTemplate(template);
    return template;
  }
  async addVersion(input: { tenantId: string; templateId: string; authorMembershipId: string; contentCiphertext: string; contentHash: string; variables?: readonly string[]; assetIds?: readonly string[] }): Promise<TemplateVersion> {
    const template = await this.repository.getTemplate(input.tenantId, input.templateId);
    if (!template || template.status === "retired") throw new ApiError("NOT_FOUND", 404, "Template is unavailable");
    if (!input.contentHash || input.contentHash.length > 256 || !input.contentCiphertext) throw new ApiError("VALIDATION_FAILED", 422, "Template content is required");
    const variables = input.variables ?? [];
    if (variables.some((value) => !VARIABLE.test(value))) throw new ApiError("VALIDATION_FAILED", 422, "Template variables are unsafe", { variables: "Use simple approved variable names" });
    const assetIds = input.assetIds ?? [];
    for (const assetId of assetIds) {
      const asset = await this.repository.getAsset(input.tenantId, assetId);
      if (!asset || asset.status !== "approved") throw new ApiError("VALIDATION_FAILED", 422, "Template references an unapproved asset", { assetIds: "Every asset must be approved" });
    }
    const versions = await this.repository.listVersions(input.tenantId, input.templateId);
    const version = { id: id(), tenantId: input.tenantId, templateId: input.templateId, versionNumber: Math.max(0, ...versions.map((item) => item.versionNumber)) + 1, contentCiphertext: input.contentCiphertext, contentHash: input.contentHash, variables, assetIds, createdByMembershipId: input.authorMembershipId };
    await this.repository.addVersion(version);
    return version;
  }
  async approve(input: { tenantId: string; templateId: string; versionId: string; approverMembershipId: string; at: Date }): Promise<TemplateVersion> {
    const versions = await this.repository.listVersions(input.tenantId, input.templateId);
    const version = versions.find((item) => item.id === input.versionId);
    if (!version) throw new ApiError("NOT_FOUND", 404, "Template version is unavailable");
    if (version.createdByMembershipId === input.approverMembershipId) throw new ApiError("FORBIDDEN", 403, "A template author cannot approve their own version");
    const approved = await this.repository.approveVersion({ tenantId: input.tenantId, versionId: input.versionId, approverMembershipId: input.approverMembershipId, at: input.at });
    if (!approved) throw new ApiError("CONFLICT", 409, "Template version approval changed concurrently");
    await this.repository.updateTemplateStatus(input.tenantId, input.templateId, "approved");
    return approved;
  }
  async activate(tenantId: string, templateId: string, versionId: string): Promise<void> {
    const version = (await this.repository.listVersions(tenantId, templateId)).find((item) => item.id === versionId);
    if (!version?.approvedAt) throw new ApiError("VALIDATION_FAILED", 422, "Only an approved immutable version can be activated");
    await this.repository.updateTemplateStatus(tenantId, templateId, "active");
  }
  async registerPrivateAsset(input: Omit<ContentAsset, "id">): Promise<ContentAsset> {
    if (!PRIVATE_KEY.test(input.objectKey) || input.objectKey.startsWith("http")) throw new ApiError("VALIDATION_FAILED", 422, "Asset must use a private object key", { objectKey: "A private R2 key is required" });
    if (!MEDIA.has(input.mediaType)) throw new ApiError("VALIDATION_FAILED", 422, "Asset media type is not allowed", { mediaType: "Unsupported media type" });
    const asset = { ...input, id: id() };
    await this.repository.addAsset(asset);
    return asset;
  }
}

export class MemoryTemplateRepository implements TemplateRepository {
  readonly templates: Template[] = []; readonly versions: TemplateVersion[] = []; readonly assets: ContentAsset[] = [];
  async getTemplate(tenantId: string, templateId: string) { return this.templates.find((item) => item.tenantId === tenantId && item.id === templateId); }
  async createTemplate(template: Template) { this.templates.push(template); }
  async listVersions(tenantId: string, templateId: string) { return this.versions.filter((item) => item.tenantId === tenantId && item.templateId === templateId); }
  async addVersion(version: TemplateVersion) { this.versions.push(version); }
  async approveVersion(input: { tenantId: string; versionId: string; approverMembershipId: string; at: Date }) { const value = this.versions.find((item) => item.tenantId === input.tenantId && item.id === input.versionId); if (value && !value.approvedAt) value.approvedAt = input.at; return value; }
  async updateTemplateStatus(tenantId: string, templateId: string, status: TemplateStatus) { const value = await this.getTemplate(tenantId, templateId); if (value) value.status = status; }
  async getAsset(tenantId: string, assetId: string) { return this.assets.find((item) => item.tenantId === tenantId && item.id === assetId); }
  async addAsset(asset: ContentAsset) { this.assets.push(asset); }
}
