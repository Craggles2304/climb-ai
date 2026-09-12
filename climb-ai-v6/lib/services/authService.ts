'use client';
import {getBrowserClient} from '@/lib/supabase/client';
import {authConfigured} from '@/lib/auth/config';
import {anonId} from '@/lib/analytics';

export interface AuthUser{id:string;email:string}

export class AuthNotConfiguredError extends Error{
  constructor(){
    super('Accounts are not switched on yet. You can keep using demo mode.');
    this.name='AuthNotConfiguredError';
  }
}

export interface AuthService{
  configured():boolean;
  signIn(email:string,password:string):Promise<AuthUser>;
  signUp(email:string,password:string):Promise<AuthUser>;
  resendConfirmation(email:string):Promise<void>;
  signInWithGoogle(redirectTo?:string):Promise<void>;
  signOut():Promise<void>;
  currentUser():Promise<AuthUser|null>;
}

class SupabaseAuthService implements AuthService{
  configured(){return authConfigured()}

  private async client(){
    const c=await getBrowserClient();
    if(!c)throw new AuthNotConfiguredError();
    return c;
  }

  async signIn(email:string,password:string):Promise<AuthUser>{
    const {data,error}=await (await this.client()).auth.signInWithPassword({email,password});
    if(error)throw new Error(friendly(error.message));
    const user=data.user!;
    await claimAnonymousHistory();
    return {id:user.id,email:user.email??email};
  }

  async signUp(email:string,password:string):Promise<AuthUser>{
    const {data,error}=await (await this.client()).auth.signUp({
      email,password,
      options:{emailRedirectTo:authCallback('/onboarding')},
    });
    if(error)throw new Error(friendly(error.message));
    if(data.session)await claimAnonymousHistory();
    return {id:data.user?.id??'pending',email};
  }

  async resendConfirmation(email:string){
    const {error}=await (await this.client()).auth.resend({
      type:'signup',email,
      options:{emailRedirectTo:authCallback('/onboarding')},
    });
    if(error)throw new Error(friendly(error.message));
  }

  async signInWithGoogle(redirectTo?:string){
    const {error}=await (await this.client()).auth.signInWithOAuth({
      provider:'google',
      options:{
        redirectTo:authCallback(safeNext(redirectTo)),
        scopes:'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
      },
    });
    if(error)throw new Error(friendly(error.message));
  }

  async signOut(){
    const c=await getBrowserClient();
    if(c)await c.auth.signOut();
  }

  async currentUser():Promise<AuthUser|null>{
    const c=await getBrowserClient();
    if(!c)return null;
    const {data}=await c.auth.getUser();
    return data.user?{id:data.user.id,email:data.user.email??''}:null;
  }
}

class UnconfiguredAuthService implements AuthService{
  configured(){return false}
  private fail():never{throw new AuthNotConfiguredError()}
  async signIn(){return this.fail()}
  async signUp(){return this.fail()}
  async resendConfirmation(){return this.fail()}
  async signInWithGoogle(){return this.fail()}
  async signOut(){/* nothing to sign out of */}
  async currentUser(){return null}
}

async function claimAnonymousHistory(){
  try{
    await fetch('/api/auth/claim',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({anonId:anonId()}),
    });
  }catch{/* sign-in itself succeeded */}
}

function authCallback(next:string){
  if(typeof window==='undefined')return undefined;
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext(next))}`;
}

function safeNext(value?:string){
  if(!value||!value.startsWith('/')||value.startsWith('//'))return '/dashboard';
  return value;
}

function friendly(message:string):string{
  const m=message.toLowerCase();
  if(m.includes('email not confirmed')||m.includes('email_not_confirmed')||m.includes('not confirmed'))return 'Confirm your email before logging in. You can resend the confirmation link below.';
  if(m.includes('invalid login'))return 'That email and password do not match an account.';
  if(m.includes('already registered'))return 'There is already an account with that email. Try logging in.';
  if(m.includes('provider')||m.includes('oauth'))return 'Google sign-in is not enabled correctly yet. Please try again shortly.';
  if(m.includes('password'))return 'That password is too weak — use at least eight characters.';
  if(m.includes('rate'))return 'Too many attempts. Wait a minute and try again.';
  return 'We could not complete that. Your account is safe — try again shortly.';
}

export const authService:AuthService=
  authConfigured()?new SupabaseAuthService():new UnconfiguredAuthService();
