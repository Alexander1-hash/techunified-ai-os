export type Status='Running'|'Paused'|'Draft'|'Needs Attention'|'Indexed'|'Processing'|'Failed';
export type Role='Owner'|'Admin'|'Manager'|'Member'|'Viewer';
export interface Department { id:string; name:string; description:string; agents:number; active:number; icon:string; status:string }
export interface Agent { id:string; name:string; department:string; purpose:string; status:Status; model:string; lastActivity:string; tasks:number }
export interface Activity { actor:string; action:string; department:string; status:string; time:string }
export const nav=[['Dashboard','/dashboard','⌂'],['AI Studio','/studio','✹'],['History','/studio/history','◷'],['Credits','/studio/credits','◈'],['Company Brain','/brain','◉'],['Business Analyst','/business-analyst','▥'],['AI Agents','/agents','✦'],['Departments','/departments','◈'],['Workflows','/workflows','⌁'],['Knowledge','/knowledge','▤'],['Analytics','/analytics','▥'],['Activity','/activity','◷'],['Integrations','/integrations','⊞'],['Settings','/settings','⚙'],['About','/about','◌']];
export const modelTypes=['GPT-4o','Claude 3.5 Sonnet','Gemini 1.5 Pro'];
