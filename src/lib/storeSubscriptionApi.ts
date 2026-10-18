import { auth } from "./firebase";
export interface StoreSubscription { id:string; created_by:string; seller_email:string; amount_ksh:number; payment_reference:string; status:"pending"|"active"|"rejected"|"expired"; submitted_at:string; reviewed_at:string|null; reviewed_by:string|null; starts_at:string|null; expires_at:string|null; }
async function request<T>(resource:string, method:"GET"|"POST", body?:Record<string,unknown>):Promise<T>{
 const user=auth.currentUser; if(!user) throw new Error("Sign in to manage your store subscription.");
 const url=String(import.meta.env.VITE_SUPABASE_URL??"").replace(/\/+$/,""); const key=String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY??""); if(!url||!key) throw new Error("Supabase is not configured.");
 let response:Response; try { response=await fetch(`${url}/functions/v1/marketplace-api?resource=${resource}`,{method,headers:{Authorization:`Bearer ${await user.getIdToken()}`,apikey:key,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{})}); } catch { throw new Error("Could not connect to marketplace-api. Deploy the updated function and check FRONTEND_ORIGINS."); }
 const result=await response.json().catch(()=>({})) as {error?:string;subscription?:T;subscriptions?:T}; if(!response.ok) throw new Error(result.error||`Subscription request failed (HTTP ${response.status}).`); return (method==="GET"?result.subscription:result.subscription) as T;
}
export const getStoreSubscription=()=>request<StoreSubscription|null>("store-subscription","GET");
export const submitStoreSubscription=(paymentReference:string)=>request<StoreSubscription>("store-subscription","POST",{action:"submit-subscription-payment",payment_reference:paymentReference});
export async function getPendingStoreSubscriptions(){
 const user=auth.currentUser;if(!user)throw new Error("Sign in first.");const url=String(import.meta.env.VITE_SUPABASE_URL??"").replace(/\/+$/,"");const key=String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY??"");const r=await fetch(`${url}/functions/v1/marketplace-api?resource=admin-store-subscriptions`,{headers:{Authorization:`Bearer ${await user.getIdToken()}`,apikey:key}});const d=await r.json().catch(()=>({})) as {error?:string;subscriptions?:StoreSubscription[]};if(!r.ok)throw new Error(d.error||"Could not load store subscriptions.");return d.subscriptions??[];
}
export async function reviewStoreSubscription(id:string,decision:"approved"|"rejected"){
 const user=auth.currentUser;if(!user)throw new Error("Sign in first.");const url=String(import.meta.env.VITE_SUPABASE_URL??"").replace(/\/+$/,"");const key=String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY??"");const r=await fetch(`${url}/functions/v1/marketplace-api?resource=admin-store-subscriptions`,{method:"POST",headers:{Authorization:`Bearer ${await user.getIdToken()}`,apikey:key,"Content-Type":"application/json"},body:JSON.stringify({action:"review-subscription",id,decision})});const d=await r.json().catch(()=>({})) as {error?:string};if(!r.ok)throw new Error(d.error||"Could not review subscription.");
}
