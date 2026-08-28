import {createClient} from '@/lib/supabase/server';
export async function getCurrentUser(){const {data:{user}}=await (await createClient()).auth.getUser();return user}
export async function getCurrentProfile(){const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)return null;const {data}=await client.from('profiles').select('id,organization_id,full_name,avatar_url,role').eq('id',user.id).maybeSingle();return data}
export async function getCurrentOrganization(){const profile=await getCurrentProfile();if(!profile?.organization_id)return null;const client=await createClient();const {data}=await client.from('organizations').select('id,name,description,industry,website,timezone').eq('id',profile.organization_id).maybeSingle();return data}
