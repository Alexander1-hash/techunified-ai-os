"use client";
import {createContext,useContext,useEffect,useMemo,useState} from 'react';
import type {Session,User} from '@supabase/supabase-js';
import {createClient} from '@/lib/supabase/client';

type AuthContextValue={session:Session|null;user:User|null;profile:Record<string,unknown>|null;organization:Record<string,unknown>|null;role:string;loading:boolean;signOut:()=>Promise<void>};
const AuthContext=createContext<AuthContextValue>({session:null,user:null,profile:null,organization:null,role:'Viewer',loading:true,signOut:async()=>{}});
export function AuthProvider({children}:{children:React.ReactNode}){const [session,setSession]=useState<Session|null>(null);const [profile,setProfile]=useState<Record<string,unknown>|null>(null);const [organization,setOrganization]=useState<Record<string,unknown>|null>(null);const [loading,setLoading]=useState(true);useEffect(()=>{const supabase=createClient();let active=true;supabase.auth.getSession().then(({data})=>{if(active){setSession(data.session);setLoading(false)}});const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{setSession(next);setLoading(false)});return()=>{active=false;subscription.unsubscribe()}},[]);const signOut=async()=>{await createClient().auth.signOut();setSession(null);window.location.assign('/login')};const value=useMemo(()=>({session,user:session?.user??null,profile,organization,role:String(profile?.role??'Viewer'),loading,signOut}),[session,profile,organization,loading]);return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>}
export const useAuth=()=>useContext(AuthContext);
