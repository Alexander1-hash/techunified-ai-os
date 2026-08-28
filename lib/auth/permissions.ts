export type Role='Owner'|'Admin'|'Manager'|'Member'|'Viewer';
const rank:Record<Role,number>={Viewer:0,Member:1,Manager:2,Admin:3,Owner:4};
export function hasRole(role:Role|undefined,minimum:Role){return !!role&&rank[role]>=rank[minimum]}
export const canManageAgents=(role?:Role)=>hasRole(role,'Manager');
export const canCreateWorkflow=(role?:Role)=>hasRole(role,'Manager');
export const canUploadKnowledge=(role?:Role)=>hasRole(role,'Member');
export const canManageIntegrations=(role?:Role)=>hasRole(role,'Admin');
export const canManageOrganization=(role?:Role)=>hasRole(role,'Admin');
export const canViewAnalytics=(role?:Role)=>hasRole(role,'Member');
