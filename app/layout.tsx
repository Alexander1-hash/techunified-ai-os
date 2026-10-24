import "./globals.css"
import { AppShell } from "@/components/app-shell"
import { AuthProvider } from "@/components/auth-provider"
import { ThemeProvider } from "@/components/theme-provider"
export const metadata={title:"TechUnifedAIOS — Your company. One intelligent operating system.",description:"TechUnifedAIOS brings company knowledge, AI agents, workflows, automation, and business intelligence into one operating system."}
const themeScript=`try{const s=localStorage.getItem("techunified-theme");const t=s==="light"||s==="dark"?s:matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t}catch{}`
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" suppressHydrationWarning><head><link rel="preconnect" href="https://rsms.me"/><link rel="stylesheet" href="https://rsms.me/inter/inter.css"/></head><body><script dangerouslySetInnerHTML={{__html:themeScript}}/><ThemeProvider><AuthProvider><AppShell>{children}</AppShell></AuthProvider></ThemeProvider></body></html>}
