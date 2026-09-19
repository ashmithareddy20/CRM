-- D1/SQLite cannot add composite foreign keys to pre-existing tables. These guards
-- enforce the tenant relation for the cross-tenant links most frequently written
-- by command handlers; every repository also scopes reads and writes by tenant_id.
CREATE TRIGGER `crm_lead_contact_tenant_insert`
BEFORE INSERT ON `crm_lead_episodes`
FOR EACH ROW WHEN NOT EXISTS (SELECT 1 FROM crm_contacts c WHERE c.id = NEW.contact_id AND c.tenant_id = NEW.tenant_id)
BEGIN SELECT RAISE(ABORT, 'lead contact must belong to tenant'); END;--> statement-breakpoint
CREATE TRIGGER `crm_lead_assignment_tenant_insert`
BEFORE INSERT ON `crm_lead_episodes`
FOR EACH ROW WHEN NEW.assigned_membership_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM crm_memberships m WHERE m.id = NEW.assigned_membership_id AND m.tenant_id = NEW.tenant_id)
BEGIN SELECT RAISE(ABORT, 'lead membership must belong to tenant'); END;--> statement-breakpoint
CREATE TRIGGER `crm_task_lead_tenant_insert`
BEFORE INSERT ON `crm_tasks`
FOR EACH ROW WHEN NEW.lead_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM crm_lead_episodes l WHERE l.id = NEW.lead_id AND l.tenant_id = NEW.tenant_id)
BEGIN SELECT RAISE(ABORT, 'task lead must belong to tenant'); END;--> statement-breakpoint
CREATE TRIGGER `crm_transition_lead_tenant_insert`
BEFORE INSERT ON `crm_lifecycle_transitions`
FOR EACH ROW WHEN NOT EXISTS (SELECT 1 FROM crm_lead_episodes l WHERE l.id = NEW.lead_id AND l.tenant_id = NEW.tenant_id)
BEGIN SELECT RAISE(ABORT, 'transition lead must belong to tenant'); END;--> statement-breakpoint
CREATE TRIGGER `crm_outbox_tenant_required`
BEFORE INSERT ON `crm_transactional_outbox`
FOR EACH ROW WHEN NEW.tenant_id IS NULL OR length(NEW.tenant_id) = 0
BEGIN SELECT RAISE(ABORT, 'outbox tenant is required'); END;
