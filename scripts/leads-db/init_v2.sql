-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create leads table with TEXT types (no length restrictions)
CREATE TABLE IF NOT EXISTS leads (
    id BIGSERIAL PRIMARY KEY,
    country TEXT NOT NULL,
    full_name TEXT,
    first_name TEXT,
    last_name TEXT,
    birth_year TEXT,
    birth_date TEXT,
    gender TEXT,
    industry TEXT,
    job_title TEXT,
    sub_role TEXT,
    skills TEXT,
    years_experience TEXT,
    inferred_salary TEXT,
    emails TEXT,
    mobile TEXT,
    phone_numbers TEXT,
    linkedin_url TEXT,
    facebook_url TEXT,
    twitter_url TEXT,
    github_url TEXT,
    linkedin_connections TEXT,
    company_name TEXT,
    company_industry TEXT,
    company_website TEXT,
    company_size TEXT,
    company_linkedin_url TEXT,
    company_facebook_url TEXT,
    company_twitter_url TEXT,
    location TEXT,
    location_country TEXT,
    location_continent TEXT,
    company_location_name TEXT,
    company_location_street_address TEXT,
    company_location_address_line_2 TEXT,
    company_location_postal_code TEXT,
    countries TEXT,
    interests TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    embedding vector(1536)
);

-- Indexes
CREATE INDEX idx_leads_country ON leads(country);
CREATE INDEX idx_leads_company_website ON leads(company_website) WHERE company_website IS NOT NULL AND company_website != '';
CREATE INDEX idx_leads_emails ON leads(emails) WHERE emails IS NOT NULL AND emails != '';

-- View
CREATE OR REPLACE VIEW leads_stats AS
SELECT country, COUNT(*) as total_leads,
    COUNT(CASE WHEN company_website IS NOT NULL AND company_website != '' THEN 1 END) as with_website,
    COUNT(CASE WHEN emails IS NOT NULL AND emails != '' THEN 1 END) as with_email
FROM leads GROUP BY country ORDER BY total_leads DESC;
