export type Status='Running'|'Paused'|'Draft'|'Needs Attention'|'Indexed'|'Processing'|'Failed';
export type Role='Owner'|'Admin'|'Manager'|'Member'|'Viewer';
export interface Department { id:string; name:string; description:string; agents:number; active:number; icon:string; status:string }
export interface Agent { id:string; name:string; department:string; purpose:string; status:Status; model:string; lastActivity:string; tasks:number }
export interface Activity { actor:string; action:string; department:string; status:string; time:string }
const departmentRows: [string,string,string,number,number,string,string][]=[['sales','Sales','Pipeline intelligence and revenue systems',20,14,'↗','Operational'],['marketing','Marketing','Demand generation and brand systems',22,16,'✦','Operational'],['operations','Operations','Process automation and execution',18,12,'◈','Operational'],['finance','Finance','Financial planning and controls',19,11,'◒','Operational'],['customer-success','Customer Success','Retention and customer intelligence',18,13,'♡','Operational'],['intelligence','Intelligence','Market and business intelligence',20,15,'⌁','Operational'],['engineering','Engineering','Product and technical systems',20,16,'⌘','Operational']];
export const departments:Department[]=[];
export const agents:Agent[]=[];
export const activity:Activity[]=[];
export const nav=[['Dashboard','/dashboard','⌂'],['AI Studio','/studio','✹'],['History','/studio/history','◷'],['Credits','/studio/credits','◈'],['Company Brain','/brain','◉'],['Business Analyst','/business-analyst','▥'],['AI Agents','/agents','✦'],['Departments','/departments','◈'],['Workflows','/workflows','⌁'],['Knowledge','/knowledge','▤'],['Analytics','/analytics','▥'],['Activity','/activity','◷'],['Integrations','/integrations','⊞'],['Settings','/settings','⚙'],['About','/about','◌']];
export const modelTypes=['GPT-4o','Claude 3.5 Sonnet','Gemini 1.5 Pro'];
