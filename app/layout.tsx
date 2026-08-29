import './globals.css'; import {AppShell} from '@/components/app-shell'; import {AuthProvider} from '@/components/auth-provider';
export const metadata={title:'TechUnified AI OS — Intelligent AI Operating System',description:'TechUnified AI OS is building a unified platform for AI-powered workflows, automation, media generation, agents, and productivity.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" className="bg-background"><body><AuthProvider><AppShell>{children}</AppShell></AuthProvider></body></html>}
