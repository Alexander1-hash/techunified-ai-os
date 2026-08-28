import {createClient as createSupabaseClient} from '@supabase/supabase-js'
export function createAdminClient(){const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!key)throw new Error('server_configuration_missing');return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,key,{auth:{autoRefreshToken:false,persistSession:false}})}
