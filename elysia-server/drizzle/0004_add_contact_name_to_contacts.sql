-- Add contact_name column to lead_contacts table

ALTER TABLE lead_contacts 
  ADD COLUMN IF NOT EXISTS contact_name VARCHAR(255);--> statement-breakpoint
COMMENT ON COLUMN lead_contacts.contact_name IS '담당자 이름';

