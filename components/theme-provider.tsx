"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
export type Theme = "system" | "light" | "dark";
const ThemeContext = createContext<{theme:Theme;resolvedTheme:"light"|"dark";setTheme:(v:Theme)=>void}|null>(null);
const KEY="techunified-theme";
const system=()=>typeof window!=="undefined"&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";
export function ThemeProvider({children}:{children:React.ReactNode}){
 const [theme,setThemeState]=useState<Theme>("system");
 const [resolvedTheme,setResolvedTheme]=useState<"light"|"dark">("dark");
 useEffect(()=>{const v=localStorage.getItem(KEY);if(v==="light"||v==="dark"||v==="system")setThemeState(v)},[]);
 useEffect(()=>{const apply=()=>{const v=theme==="system"?system():theme;setResolvedTheme(v);document.documentElement.dataset.theme=v;document.documentElement.style.colorScheme=v};apply();if(theme!=="system")return;const m=window.matchMedia("(prefers-color-scheme: light)");m.addEventListener("change",apply);return()=>m.removeEventListener("change",apply)},[theme]);
 const setTheme=(v:Theme)=>{setThemeState(v);localStorage.setItem(KEY,v)};
 return <ThemeContext.Provider value={useMemo(()=>({theme,resolvedTheme,setTheme}),[theme,resolvedTheme])}>{children}</ThemeContext.Provider>
}
export const useTheme=()=>{const v=useContext(ThemeContext);if(!v)throw new Error("useTheme must be used inside ThemeProvider");return v};
