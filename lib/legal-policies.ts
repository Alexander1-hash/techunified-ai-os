export type LegalPolicy = {
  slug: string
  title: string
  shortTitle: string
  summary: string
  version: string
  effectiveDate: string
  sections: { heading: string; paragraphs: string[] }[]
}

export const LEGAL_VERSION = "1.0"

export const LEGAL_POLICIES: LegalPolicy[] = [
  {
    slug: "terms",
    title: "Terms of Service",
    shortTitle: "Terms & Conditions",
    summary: "The rules governing access to and use of TechUnified AI OS.",
    version: LEGAL_VERSION,
    effectiveDate: "October 8, 2026",
    sections: [
      { heading: "1. Agreement", paragraphs: [
        "These Terms of Service govern your access to and use of TechUnified AI OS, including its workspace, Company Brain, Business Analyst, AI agents, workflows, analytics, decision-support features, integrations, and related services. By creating an account, accessing a workspace, or using the service, you agree to these Terms.",
        "If you use TechUnified AI OS on behalf of a company or other organization, you represent that you are authorized to bind that organization. In that case, references to "you" include both you and the organization you represent."
      ]},
      { heading: "2. Your account and workspace", paragraphs: [
        "You are responsible for providing accurate account information, protecting your authentication credentials, and keeping access to your workspace under appropriate control. You must promptly notify TechUnified if you believe an account or workspace has been compromised.",
        "Workspace owners and administrators are responsible for managing members, permissions, connected data sources, integrations, and instructions given to AI features within their workspace."
      ]},
      { heading: "3. Acceptable use", paragraphs: [
        "You may use the service only for lawful business and organizational purposes and in accordance with these Terms and the Acceptable Use Policy. You must not use the service to facilitate fraud, unlawful surveillance, unauthorized access, harmful activity, abuse of other users, or infringement of another person's rights.",
        "You remain responsible for the data, instructions, files, credentials, and other material that you submit to or connect with the service."
      ]},
      { heading: "4. AI features and outputs", paragraphs: [
        "TechUnified AI OS uses AI to analyze information, generate content, identify patterns, recommend actions, and support business decisions. AI output may be incomplete, inaccurate, outdated, or inappropriate for a particular situation.",
        "You are responsible for reviewing important AI outputs before relying on them, especially where an output could materially affect people, finances, legal obligations, security, compliance, or business operations. AI features are decision support, not a substitute for appropriate human judgment."
      ]},
      { heading: "5. Your data and our service", paragraphs: [
        "You retain your rights in data that you submit to the service, subject to the permissions required to operate the service and the rights you grant under these Terms. You authorize TechUnified to process workspace data as necessary to provide, secure, maintain, improve, and support the service, subject to the Privacy Policy and applicable agreements.",
        "You must have the necessary rights and permissions to provide any data you connect to TechUnified AI OS."
      ]},
      { heading: "6. Availability and changes", paragraphs: [
        "We may update, improve, suspend, or discontinue features as the product evolves. We will make reasonable efforts to maintain service availability, but we do not promise that the service will be uninterrupted or error-free.",
        "We may update these Terms from time to time. Material changes may be communicated through the workspace inbox or other reasonable channels. Continued use after an updated effective date constitutes acceptance where legally permitted."
      ]},
      { heading: "7. Fees and subscriptions", paragraphs: [
        "If a paid plan, subscription, usage charge, or other commercial arrangement applies to your workspace, the applicable pricing, billing cycle, usage limits, and payment terms presented to you or agreed with TechUnified will govern those charges.",
        "Unless otherwise stated in a written agreement, taxes, third-party charges, and expenses arising from services you independently connect to TechUnified are your responsibility."
      ]},
      { heading: "8. Suspension and termination", paragraphs: [
        "We may suspend or restrict access where reasonably necessary to protect the service, users, data, or third parties, to address security risks, to enforce these Terms, or where required by law.",
        "You may stop using the service at any time. Termination does not remove obligations that by their nature should continue, including provisions concerning intellectual property, acceptable use, confidentiality, limitations of liability, and dispute-related matters."
      ]},
      { heading: "9. Disclaimers and liability", paragraphs: [
        "To the maximum extent permitted by applicable law, TechUnified AI OS is provided on an as-available basis and without warranties beyond those that cannot legally be excluded. We do not guarantee that AI-generated information, analytics, forecasts, recommendations, or automation results will be accurate or suitable for every purpose.",
        "To the extent permitted by law, TechUnified will not be responsible for indirect, incidental, special, consequential, or punitive losses arising from use of the service. Nothing in these Terms excludes liability that cannot lawfully be excluded."
      ]},
      { heading: "10. Governing terms", paragraphs: [
        "These Terms are intended to establish the baseline contractual rules for TechUnified AI OS. Any enterprise agreement, order form, data processing agreement, or other written agreement that expressly overrides a provision of these Terms will control for the subject matter it covers.",
        "These Terms should be reviewed with qualified legal counsel before being used as a final commercial agreement for a specific jurisdiction or enterprise contract."
      ]}
    ]
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    shortTitle: "Privacy Policy",
    summary: "How TechUnified AI OS handles account, workspace, and service information.",
    version: LEGAL_VERSION,
    effectiveDate: "October 8, 2026",
    sections: [
      { heading: "1. Scope", paragraphs: [
        "This Privacy Policy describes how TechUnified AI OS may collect, use, store, secure, and disclose information in connection with the service. It applies to account information, workspace information, technical information, and information processed when you use connected features."
      ]},
      { heading: "2. Information we may process", paragraphs: [
        "Depending on how you use the service, this may include your name, email address, profile information, organization and workspace details, authentication information, support communications, usage events, device and browser information, IP address or approximate location information, and information you or your organization intentionally connect to the service.",
        "Workspace data may include business records, documents, knowledge sources, instructions, workflow information, analytics inputs, and other content that your organization chooses to process through TechUnified AI OS."
      ]},
      { heading: "3. How information is used", paragraphs: [
        "We may use information to provide and personalize the service, authenticate users, operate workspaces, run requested AI and automation features, maintain security, troubleshoot problems, communicate service information, measure reliability and performance, prevent abuse, and comply with legal obligations.",
        "We may also use aggregated or de-identified information where permitted to understand product performance and improve the service, provided it is handled so it is not reasonably used to identify an individual."
      ]},
      { heading: "4. AI processing", paragraphs: [
        "When you use AI features, relevant prompts, instructions, workspace context, and other permitted inputs may be processed by the AI systems or providers required to deliver those features. The exact processing path may vary by feature and integration.",
        "You should not submit highly sensitive information unless your workspace and applicable agreement are designed to support that processing and you have the necessary authority to do so."
      ]},
      { heading: "5. Sharing and service providers", paragraphs: [
        "We may use service providers that help us host infrastructure, authenticate users, store data, process AI requests, deliver communications, monitor reliability, or provide other technical services. Such providers may process information only as needed to perform their services and subject to applicable contractual or legal controls.",
        "We may disclose information where required by law, to protect rights and safety, to prevent fraud or abuse, or as part of a corporate transaction such as a merger, acquisition, financing, or sale of assets."
      ]},
      { heading: "6. Retention and security", paragraphs: [
        "We retain information for as long as reasonably necessary for the purposes described in this Policy, contractual requirements, legitimate business needs, dispute resolution, security, and legal obligations. Retention periods may differ by data type and workspace configuration.",
        "We use reasonable technical and organizational safeguards designed to protect information. No internet service can guarantee absolute security."
      ]},
      { heading: "7. Your choices and rights", paragraphs: [
        "Depending on your location and applicable law, you may have rights to access, correct, delete, restrict, object to, or obtain a copy of certain personal information. Workspace administrators may control organization data and may be the appropriate contact for requests concerning workspace content.",
        "Requests should be made through the support or privacy channel made available by TechUnified for your account or organization."
      ]},
      { heading: "8. Updates", paragraphs: [
        "We may update this Policy as the service, laws, or data practices change. Material changes may be communicated through the workspace inbox or another reasonable method. The version and effective date shown on this page identify the current published version."
      ]}
    ]
  },
  {
    slug: "acceptable-use",
    title: "Acceptable Use Policy",
    shortTitle: "Acceptable Use",
    summary: "Activities that are prohibited or restricted when using TechUnified AI OS.",
    version: LEGAL_VERSION,
    effectiveDate: "October 8, 2026",
    sections: [
      { heading: "1. Lawful use", paragraphs: [
        "You may use TechUnified AI OS only for lawful purposes and in compliance with applicable laws, regulations, contracts, and third-party rights."
      ]},
      { heading: "2. Prohibited activity", paragraphs: [
        "You must not use the service to facilitate fraud, phishing, credential theft, unauthorized access, malware distribution, exploitation of systems, unlawful surveillance, harassment, threats, impersonation, or deliberate harm.",
        "You must not use the service to process or expose another person's private information without appropriate authority, or to bypass access controls, rate limits, security measures, or usage restrictions."
      ]},
      { heading: "3. High-impact uses", paragraphs: [
        "AI recommendations and automated actions should not be used as the sole basis for decisions that materially affect a person's legal rights, employment, access to essential services, safety, or similarly high-impact interests without appropriate human review and applicable safeguards."
      ]},
      { heading: "4. Content and intellectual property", paragraphs: [
        "You must have the rights and permissions needed for content, documents, datasets, credentials, and other material you connect to TechUnified. Do not upload or connect material that you are prohibited from sharing or processing."
      ]},
      { heading: "5. Security and abuse reporting", paragraphs: [
        "Do not intentionally interfere with the service, probe or attack infrastructure without authorization, or attempt to gain access to another workspace. Suspected security vulnerabilities or abuse should be reported through the support channel provided by TechUnified."
      ]},
      { heading: "6. Enforcement", paragraphs: [
        "We may investigate suspected violations and may limit, suspend, or terminate access where reasonably necessary to protect users, the service, or third parties, subject to applicable law and contractual commitments."
      ]}
    ]
  },
  {
    slug: "ai-safety",
    title: "AI Usage & Safety Policy",
    shortTitle: "AI Usage & Safety",
    summary: "How to use TechUnified AI features responsibly and with human oversight.",
    version: LEGAL_VERSION,
    effectiveDate: "October 8, 2026",
    sections: [
      { heading: "1. AI is decision support", paragraphs: [
        "TechUnified AI OS is designed to help people understand business information, generate analysis, coordinate workflows, and make better-informed decisions. AI output should be treated as an assistive result rather than an automatically correct statement of fact."
      ]},
      { heading: "2. Verify important outputs", paragraphs: [
        "Review important outputs against source information before taking consequential action. This is especially important for financial, legal, security, compliance, personnel, customer, and operational decisions.",
        "Where an AI-generated recommendation leads to an external action, organizations should use appropriate approval gates, permissions, and monitoring."
      ]},
      { heading: "3. Data minimization", paragraphs: [
        "Use the minimum information necessary for an AI task. Avoid entering secrets, passwords, private keys, authentication codes, or other credentials into prompts unless a specifically designed secure integration requires them."
      ]},
      { heading: "4. Automation and agents", paragraphs: [
        "AI agents and workflows may operate within the permissions and tools configured by a workspace. Workspace administrators are responsible for reviewing agent instructions, connected tools, action permissions, and approval requirements before enabling consequential automation."
      ]},
      { heading: "5. No guaranteed outcomes", paragraphs: [
        "AI output may contain errors, omissions, unsupported conclusions, or unexpected behavior. TechUnified does not guarantee that an AI feature will achieve a particular business result or eliminate the need for professional expertise."
      ]},
      { heading: "6. Responsible use", paragraphs: [
        "Users should not use AI features to generate or facilitate unlawful, abusive, deceptive, discriminatory, or harmful activity. The Acceptable Use Policy applies to AI-generated and AI-assisted activity as well as ordinary use of the platform."
      ]}
    ]
  },
  {
    slug: "data-handling",
    title: "Data & Workspace Policy",
    shortTitle: "Data & Workspace",
    summary: "Rules for workspace data, connected sources, permissions, and organizational responsibility.",
    version: LEGAL_VERSION,
    effectiveDate: "October 8, 2026",
    sections: [
      { heading: "1. Workspace ownership", paragraphs: [
        "A workspace represents an organization or business environment. Workspace administrators control membership, permissions, connected sources, and organization-level configuration within the capabilities provided by the service."
      ]},
      { heading: "2. Connected sources", paragraphs: [
        "When you connect a data source, you authorize TechUnified AI OS to access and process the information required for the feature you enabled. You are responsible for ensuring that the connection is authorized and that the source may lawfully be used for the intended purpose."
      ]},
      { heading: "3. Permissions", paragraphs: [
        "Users should receive only the access appropriate to their role. Administrators should review connected integrations and AI agent permissions regularly and remove access that is no longer needed."
      ]},
      { heading: "4. Data quality", paragraphs: [
        "Company Brain, analytics, forecasting, and AI recommendations depend on the quality, completeness, and timeliness of source information. TechUnified may surface gaps or inconsistencies, but the organization remains responsible for the underlying records it provides."
      ]},
      { heading: "5. Export, deletion, and lifecycle", paragraphs: [
        "Available export and deletion capabilities may vary by feature, plan, integration, and applicable agreement. Workspace administrators are responsible for maintaining their own retention requirements and backups where appropriate.",
        "Deletion or disconnection of a source may not immediately remove every derived record, log, backup, or legally retained copy. Applicable retention rules and product architecture determine the lifecycle of each data class."
      ]},
      { heading: "6. Security responsibility", paragraphs: [
        "TechUnified maintains security controls for the service, while customers remain responsible for account credentials, endpoint security, authorized users, source permissions, and the instructions they configure."
      ]}
    ]
  },
  {
    slug: "account",
    title: "Workspace & Account Policy",
    shortTitle: "Workspace & Account",
    summary: "Account responsibilities, workspace administration, access, and lifecycle rules.",
    version: LEGAL_VERSION,
    effectiveDate: "October 8, 2026",
    sections: [
      { heading: "1. Account responsibility", paragraphs: [
        "Each user is responsible for maintaining the confidentiality of their authentication methods and for activity performed through their account. Do not share credentials or allow unauthorized people to use your account."
      ]},
      { heading: "2. Workspace administration", paragraphs: [
        "Workspace owners and administrators may invite or remove members, assign roles, configure integrations, and manage organization settings. Administrators should use least-privilege access and review membership periodically."
      ]},
      { heading: "3. Organizational access", paragraphs: [
        "If your account belongs to an organization, the organization may control access to workspace content and may have administrative visibility into activity and data according to its configuration, contracts, and applicable law."
      ]},
      { heading: "4. Account lifecycle", paragraphs: [
        "When a user leaves an organization, the organization should promptly remove access. TechUnified may retain records needed for security, auditing, legal compliance, billing, or other legitimate service purposes."
      ]},
      { heading: "5. Security incidents", paragraphs: [
        "If you suspect unauthorized access, credential compromise, or misuse of a connected integration, secure the affected account or integration and notify the appropriate workspace administrator and TechUnified support channel as soon as reasonably possible."
      ]}
    ]
  },
  {
    slug: "billing",
    title: "Subscription & Billing Terms",
    shortTitle: "Subscription & Billing",
    summary: "Baseline terms for paid plans, usage, renewals, and billing.",
    version: LEGAL_VERSION,
    effectiveDate: "October 8, 2026",
    sections: [
      { heading: "1. Plans and pricing", paragraphs: [
        "TechUnified may offer free, paid, usage-based, enterprise, or other commercial plans. The price and included features shown for your workspace or agreed in an order form control the applicable commercial relationship."
      ]},
      { heading: "2. Billing", paragraphs: [
        "Where a paid subscription applies, you authorize the applicable payment method or invoicing arrangement to be used for charges presented at purchase or agreed in writing. Taxes and other charges may apply where required."
      ]},
      { heading: "3. Renewals and changes", paragraphs: [
        "Subscriptions may renew according to the billing cycle presented at purchase unless cancelled or otherwise governed by an enterprise agreement. We may change pricing or plan features with reasonable notice, subject to applicable law and contractual commitments."
      ]},
      { heading: "4. Usage limits", paragraphs: [
        "Plans may include limits on users, storage, AI usage, automation, integrations, or other resources. Exceeding an included limit may require an upgrade, additional usage charge, or temporary restriction as described in the applicable plan."
      ]},
      { heading: "5. Refunds and cancellation", paragraphs: [
        "Refund, credit, and cancellation rules may vary by plan, purchase channel, enterprise agreement, and applicable law. Any specific refund commitment presented at purchase or contained in a written agreement will control."
      ]}
    ]
  }
]

export function getLegalPolicy(slug: string) {
  return LEGAL_POLICIES.find((policy) => policy.slug === slug) ?? null
}
