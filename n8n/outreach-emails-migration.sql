-- ============================================================
-- Holigenix Growth Engine — outreach_emails table
-- Run this in Supabase SQL Editor for project shrxkkbgmckbezmlssbg
-- ============================================================

-- Outreach email log — tracks every email drafted/sent by the Outreach Agent
CREATE TABLE IF NOT EXISTS outreach_emails (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_name  TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  company_name  TEXT,
  subject       TEXT NOT NULL,
  body          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'pending', 'sent', 'send_failed', 'bounced', 'replied')),
  campaign_type TEXT NOT NULL
                CHECK (campaign_type IN ('introductory', 'follow_up', 'nurture', 'thank_you', 're_engagement')),
  sent_at       TIMESTAMPTZ,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_outreach_emails_contact
  ON outreach_emails (contact_email, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_outreach_emails_status
  ON outreach_emails (status, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_outreach_emails_campaign
  ON outreach_emails (campaign_type, sent_at DESC);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_outreach_emails_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_outreach_emails_updated ON outreach_emails;
CREATE TRIGGER trg_outreach_emails_updated
  BEFORE UPDATE ON outreach_emails
  FOR EACH ROW
  EXECUTE FUNCTION update_outreach_emails_updated_at();

-- Enable RLS (service key bypasses, but good practice)
ALTER TABLE outreach_emails ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access on outreach_emails"
  ON outreach_emails
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- Also ensure crm_referral_sources has the columns the workflow needs
-- Run only if your existing table is missing these columns:
-- ============================================================
-- ALTER TABLE crm_referral_sources ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;
-- ALTER TABLE crm_referral_sources ADD COLUMN IF NOT EXISTS outreach_count INTEGER DEFAULT 0;
