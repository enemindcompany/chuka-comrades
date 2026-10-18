import { auth } from "./firebase";
const base = () => `${String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "")}/functions/v1/community-api`;
async function request<T>(resource: string, method: "GET" | "POST", body?: Record<string, unknown>): Promise<T> {
  const user=auth.currentUser;if(!user)throw new Error("Sign in first.");
  const supabaseUrl=String(import.meta.env.VITE_SUPABASE_URL??"").trim();
  const key=String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY??"").trim();
  const endpoint=base();
  if(!supabaseUrl||!key)throw new Error("Community services are not configured. Check .env.local.");
  let res:Response;try{res=await fetch(`${endpoint}?resource=${encodeURIComponent(resource)}`,{method,headers:{Authorization:`Bearer ${await user.getIdToken()}`,apikey:key,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{})})}catch{throw new Error("Could not connect to community-api. Deploy the function and check FRONTEND_ORIGINS.")}
  const data=await res.json().catch(()=>({})) as {error?:string;subscription?:T;profile?:T;players?:T;tournaments?:T;ownPlayer?:T;player?:T};if(!res.ok)throw new Error(data.error||`Community request failed (${res.status}).`);return (data.subscription!==undefined?data.subscription:data.profile!==undefined?data.profile:data) as T;
}
export interface HookupSubscription {id:string;firebase_uid:string;email:string;payment_reference:string;status:"pending"|"active"|"rejected"|"expired";submitted_at:string;starts_at:string|null;expires_at:string|null;}
export interface EfootballPlayer {id:string;player_name:string;squad_image_url:string;bio:string;whatsapp_number:string;created_at:string;payment_reference?:string;payment_status?:"pending"|"active"|"rejected";submitted_at?:string;account_for_sale?:boolean;account_price_ksh?:number|null;}
export interface EfootballTournament {id:string;created_by:string;organizer_name:string;title:string;details:string;tournament_number:string;event_date:string|null;contact:string;image_url?:string|null;created_at:string;}

export interface HookupProfile { firebase_uid:string; display_name:string; age:number; gender:"Woman"|"Man"|"Non-binary"|"Prefer not to say"; looking_for:"Women"|"Men"|"Everyone"; preferred_age_min:number; preferred_age_max:number; preferred_area:string; interests:string; about:string; updated_at:string; }
export interface HookupPageData { subscription:HookupSubscription|null; ownProfile:HookupProfile|null; profiles:HookupProfile[]; active:boolean; }
export async function getHookupPageData():Promise<HookupPageData>{
 const user=auth.currentUser;if(!user)throw new Error("Sign in first.");const supabaseUrl=String(import.meta.env.VITE_SUPABASE_URL??"").trim();const key=String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY??"").trim();if(!supabaseUrl||!key)throw new Error("Community services are not configured. Check .env.local.");
 let res:Response;try{res=await fetch(`${base()}?resource=hookup`,{headers:{Authorization:`Bearer ${await user.getIdToken()}`,apikey:key}})}catch{throw new Error("Could not connect to community-api. Deploy the function and check FRONTEND_ORIGINS.")}
 const data=await res.json().catch(()=>({})) as {error?:string;subscription?:HookupSubscription|null;ownProfile?:HookupProfile|null;profiles?:HookupProfile[];active?:boolean};if(!res.ok)throw new Error(data.error||`Community request failed (${res.status}).`);return {subscription:data.subscription??null,ownProfile:data.ownProfile??null,profiles:data.profiles??[],active:data.active===true};
}
export async function saveHookupProfile(input:Omit<HookupProfile,"firebase_uid"|"updated_at">){return await request<HookupProfile>("hookup","POST",{action:"save-profile",...input});}
export async function getHookupSubscription(){return await request<HookupSubscription|null>("hookup","GET");}
export async function submitHookupPayment(payment_reference:string){return await request<HookupSubscription>("hookup","POST",{action:"submit-payment",payment_reference});}
export async function getEfootballData(){const user=auth.currentUser;if(!user)throw new Error("Sign in first.");const key=String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY??"");const res=await fetch(`${base()}?resource=efootball`,{headers:{Authorization:`Bearer ${await user.getIdToken()}`,apikey:key}});const data=await res.json().catch(()=>({})) as {error?:string;players?:EfootballPlayer[];tournaments?:EfootballTournament[];ownPlayer?:EfootballPlayer|null;hasAccess?:boolean};if(!res.ok)throw new Error(data.error||"Could not load eFootball data.");return {players:data.players??[],tournaments:data.tournaments??[],ownPlayer:data.ownPlayer??null,hasAccess:data.hasAccess===true};}
export async function registerEfootballPlayer(input:{player_name:string;whatsapp_number:string;squad_image_base64:string;squad_image_type:string;bio:string;payment_reference:string;account_for_sale:boolean;account_price_ksh:number|null}){const user=auth.currentUser;if(!user)throw new Error("Sign in first.");const key=String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY??"");const res=await fetch(`${base()}?resource=efootball`,{method:"POST",headers:{Authorization:`Bearer ${await user.getIdToken()}`,apikey:key,"Content-Type":"application/json"},body:JSON.stringify({action:"register-player",...input})});const data=await res.json().catch(()=>({})) as {error?:string;player?:EfootballPlayer};if(!res.ok)throw new Error(data.error||"Could not submit eFootball listing.");return data.player!;}
export async function updateEfootballSaleListing(input:{account_for_sale:boolean;account_price_ksh:number|null}){const user=auth.currentUser;if(!user)throw new Error("Sign in first.");const key=String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY??"");const res=await fetch(`${base()}?resource=efootball`,{method:"POST",headers:{Authorization:`Bearer ${await user.getIdToken()}`,apikey:key,"Content-Type":"application/json"},body:JSON.stringify({action:"update-sale",...input})});const data=await res.json().catch(()=>({})) as {error?:string;player?:EfootballPlayer};if(!res.ok)throw new Error(data.error||"Could not update account marketplace listing.");return data.player!;}
export async function createEfootballTournament(input:{title:string;details:string;tournament_number:string;event_date:string;contact:string;tournament_image_base64?:string;tournament_image_type?:string}){const user=auth.currentUser;if(!user)throw new Error("Sign in first.");const key=String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY??"");const res=await fetch(`${base()}?resource=efootball`,{method:"POST",headers:{Authorization:`Bearer ${await user.getIdToken()}`,apikey:key,"Content-Type":"application/json"},body:JSON.stringify({action:"create-tournament",...input})});const data=await res.json().catch(()=>({})) as {error?:string;tournament?:EfootballTournament};if(!res.ok)throw new Error(data.error||"Could not create tournament.");return data.tournament!;}
export async function getPendingCommunityPayments(){const user=auth.currentUser;if(!user)throw new Error("Sign in first.");const key=String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY??"");const res=await fetch(`${base()}?resource=admin-community`,{headers:{Authorization:`Bearer ${await user.getIdToken()}`,apikey:key}});const data=await res.json().catch(()=>({})) as {error?:string;hookups?:HookupSubscription[];players?:EfootballPlayer[];requests?:PaidRequestPayment[]};if(!res.ok)throw new Error(data.error||"Could not load community payment requests.");return {hookups:data.hookups??[],players:data.players??[],requests:data.requests??[]};}
export async function reviewCommunityPayment(kind:"hookup"|"efootball"|"request",id:string,decision:"approved"|"rejected",firebase_uid?:string){const user=auth.currentUser;if(!user)throw new Error("Sign in first.");const key=String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY??"");const resource=kind==="hookup"?"hookup":"admin-community";const body=kind==="hookup"?{action:"review-payment",firebase_uid,decision}:kind==="request"?{action:"review-request",id,decision}:{action:"review-efootball",id,decision};const res=await fetch(`${base()}?resource=${resource}`,{method:"POST",headers:{Authorization:`Bearer ${await user.getIdToken()}`,apikey:key,"Content-Type":"application/json"},body:JSON.stringify(body)});const data=await res.json().catch(()=>({})) as {error?:string};if(!res.ok)throw new Error(data.error||"Could not review payment.");}

export interface PaidRequestPayment { id: string; firebase_uid: string; email: string; request_type: "general" | "roommate_finder"; amount_ksh: number; request_title: string | null; request_details: string | null; image_url?: string | null; payment_reference: string; status: "pending" | "approved" | "rejected"; created_at: string; reviewed_at: string | null; used_at: string | null; }
export async function getPaidRequestPayments() {
 const user=auth.currentUser;
 if(!user)throw new Error("Sign in first.");
 const supabaseUrl=String(import.meta.env.VITE_SUPABASE_URL??"").trim().replace(/\/+$/,"");
 const key=String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY??"").trim();
 if(!supabaseUrl||!key)throw new Error("Request board is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.");
 let res:Response;
 try { res=await fetch(`${supabaseUrl}/functions/v1/community-api?resource=paid-requests`,{headers:{Authorization:`Bearer ${await user.getIdToken()}`,apikey:key}}); }
 catch { throw new Error("Could not connect to community-api. Check the Supabase URL, FRONTEND_ORIGINS and that community-api has been deployed."); }
 const data=await res.json().catch(()=>({})) as {error?:string;requests?:PaidRequestPayment[];publicRequests?:PaidRequestPayment[]};
 if(!res.ok)throw new Error(data.error||`Could not load requests (HTTP ${res.status}).`);
 return {requests:data.requests??[],publicRequests:data.publicRequests??[]};
}
export async function submitPaidRequestPayment(input:{request_type:"general"|"roommate_finder";payment_reference:string;request_title?:string;request_details?:string;image_base64?:string;image_type?:string}) {
 const user=auth.currentUser;
 if(!user)throw new Error("Sign in first.");
 const supabaseUrl=String(import.meta.env.VITE_SUPABASE_URL??"").trim().replace(/\/+$/,"");
 const key=String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY??"").trim();
 if(!supabaseUrl||!key)throw new Error("Request board is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.");
 let res:Response;
 try { res=await fetch(`${supabaseUrl}/functions/v1/community-api?resource=paid-requests`,{method:"POST",headers:{Authorization:`Bearer ${await user.getIdToken()}`,apikey:key,"Content-Type":"application/json"},body:JSON.stringify({action:"submit-payment",...input})}); }
 catch { throw new Error("Could not connect to community-api. Check the Supabase URL, FRONTEND_ORIGINS and that community-api has been deployed."); }
 const data=await res.json().catch(()=>({})) as {error?:string;request?:PaidRequestPayment};
 if(!res.ok)throw new Error(data.error||`Could not submit request payment (HTTP ${res.status}).`);
 return data.request!;
}
export async function reviewPaidRequestPayment(id:string,decision:"approved"|"rejected") { const user=auth.currentUser;if(!user)throw new Error("Sign in first.");const key=String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY??"");const res=await fetch(`${base()}?resource=admin-community`,{method:"POST",headers:{Authorization:`Bearer ${await user.getIdToken()}`,apikey:key,"Content-Type":"application/json"},body:JSON.stringify({action:"review-request",id,decision})});const data=await res.json().catch(()=>({})) as {error?:string};if(!res.ok)throw new Error(data.error||"Could not review request payment.");}
