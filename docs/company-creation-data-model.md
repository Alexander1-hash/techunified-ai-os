# Company Creation Data Model

## company_creation_projects

The company-building workspace: organization, creator, company name, business idea, jurisdiction, stage, progress, and metadata.

## company_creation_agreements

Immutable snapshots of the commercial terms presented to the user: project, version, jurisdiction, proposed equity percentage, terms snapshot, acceptance timestamp, accepting user, and status.

The terms snapshot must preserve exactly what the user was shown at acceptance time.

## company_creation_tasks

Each operational step becomes a trackable task, such as registration, trademark search, domain purchase, business email, accounting setup, or payment setup. Providers are referenced by stable provider keys.

## Future tables

- company_creation_providers
- company_creation_orders
- company_creation_payments
- company_creation_assets
- company_creation_audit_events
- company_creation_documents
- company_creation_equity_records
