import './globals.css'; import {AppShell} from '@/components/app-shell'; import {AuthProvider} from '@/components/auth-provider';
export const metadata={title:'TechUnified AI OS',description:'Your company. One intelligent operating system.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" className="bg-background"><body><AuthProvider><AppShell>{children}</AppShell></AuthProvider></body></html>}
