-- SQLite cannot add CHECK clauses without rebuilding tables. These immutable write
-- guards preserve equivalent constraints for the expand-only initial release.
CREATE TRIGGER `crm_lead_stage_check_insert`
BEFORE INSERT ON `crm_lead_episodes`
FOR EACH ROW WHEN NEW.lifecycle_stage NOT IN ('received','source_identified','assigned','contact_attempted','meaningful_connection','requirement_identified','qualified','follow_up_active','appointment_suggested','appointment_booked','appointment_confirmed','arrived','consultation','treatment_advised','financial_counseling','procedure_booked','admission','treatment_completed','revenue_recorded','lost','expired')
BEGIN SELECT RAISE(ABORT, 'invalid lifecycle stage'); END;--> statement-breakpoint
CREATE TRIGGER `crm_task_status_check_insert`
BEFORE INSERT ON `crm_tasks`
FOR EACH ROW WHEN NEW.status NOT IN ('open','in_progress','completed','cancelled')
BEGIN SELECT RAISE(ABORT, 'invalid task status'); END;--> statement-breakpoint
CREATE TRIGGER `crm_message_channel_check_insert`
BEFORE INSERT ON `crm_message_attempts`
FOR EACH ROW WHEN NEW.channel NOT IN ('whatsapp','rcs','mms','call')
BEGIN SELECT RAISE(ABORT, 'invalid communication channel'); END;--> statement-breakpoint
CREATE TRIGGER `crm_revenue_currency_check_insert`
BEFORE INSERT ON `crm_revenue_ledger`
FOR EACH ROW WHEN length(NEW.currency) != 3 OR NEW.amount_minor = 0
BEGIN SELECT RAISE(ABORT, 'revenue requires nonzero minor amount and ISO currency'); END;
