/* KELO-INDEX
 * area: CORE / APPROVAL WORKFLOW
 * owner: KeloApprovalRequestRuntime
 * keys: APPROVAL REQUEST EDITOR ADMIN NOTIFICATION REALTIME SUPABASE PREVIEW SIGNED URL
 * purpose: shared client for editor submissions, admin review inbox, secure visual previews and realtime approval notifications
 * authority: RPC + RLS; browser never publishes approved content directly
 */
const VERSION='approval-request-runtime-v1.1.0-visual-review';

export async function installApprovalRequestRuntime({root=window}={}){
  if(root.KeloApprovalRequestRuntime)return root.KeloApprovalRequestRuntime;
  let channel=null,starting=null,unread=0;
  const permissions=()=>root.KeloAccountPermissions||root.KeloPermissions;
  const client=()=>root.KeloOnlineAuth?.getClient?.();
  const toast=message=>typeof root.showToast==='function'?root.showToast(message):console.info('[ApprovalRequest]',message);
  const dispatch=(name,detail)=>{try{root.dispatchEvent(new CustomEvent(name,{detail}));}catch(_){}};

  async function rpc(name,args={}){
    const c=client();
    if(!c)throw new Error('AUTH_CLIENT_UNAVAILABLE');
    const result=await c.rpc(name,args);
    if(result.error)throw result.error;
    return result.data;
  }

  function emitUnread(value){
    unread=Math.max(0,Number(value)||0);
    dispatch('kelo:approval-unread',{count:unread});
    return unread;
  }

  async function refreshUnread(){
    if(!(permissions()?.hasRole?.('admin')||permissions()?.can?.('approval.notifications')))return emitUnread(0);
    try{return emitUnread(await rpc('get_my_approval_unread_count'));}
    catch(error){
      const code=String(error?.code||'');
      if(code!=='PGRST202'&&code!=='42883')console.warn('[ApprovalRequest unread]',error);
      return emitUnread(0);
    }
  }

  async function markRead(){
    try{await rpc('mark_my_approval_notifications_read');}catch(error){console.warn('[ApprovalRequest markRead]',error);}
    return emitUnread(0);
  }

  async function submit({type,title,summary=null,entityType=null,entityId=null,metadata={}}={}){
    return rpc('submit_approval_request',{
      p_request_type:type,
      p_title:title,
      p_summary:summary,
      p_entity_type:entityType,
      p_entity_id:entityId,
      p_metadata:metadata||{}
    });
  }

  async function list({status='pending',limit=100}={}){
    return rpc('list_approval_requests',{p_status:status,p_limit:limit});
  }

  async function signPreview(asset){
    const bucket=String(asset?.bucket||''),path=String(asset?.path||'');
    if(!bucket||!path)return {...asset,signedUrl:null};
    try{
      const c=client();
      if(!c?.storage)throw new Error('STORAGE_CLIENT_UNAVAILABLE');
      const result=await c.storage.from(bucket).createSignedUrl(path,300);
      if(result.error)throw result.error;
      return {...asset,signedUrl:result.data?.signedUrl||result.data?.signedURL||null};
    }catch(error){
      console.warn('[ApprovalRequest preview]',error);
      return {...asset,signedUrl:null,previewError:String(error?.message||error)};
    }
  }

  async function detail(id){
    const payload=await rpc('get_approval_request_detail',{p_request_id:id});
    const previewAssets=await Promise.all((payload?.previewAssets||[]).map(signPreview));
    return {...(payload||{}),previewAssets};
  }

  async function review(id,decision,note=null){
    return rpc('review_approval_request',{p_request_id:id,p_decision:decision,p_note:note});
  }

  async function startNotifications(){
    if(starting)return starting;
    starting=(async()=>{
      const p=permissions();
      if(!(p?.hasRole?.('admin')||p?.can?.('approval.notifications')))return false;
      const auth=root.KeloOnlineAuth;
      const credentials=await auth?.ready?.(7000);
      const userId=String(credentials?.accountId||p?.state?.()?.accountId||'');
      const c=client();
      if(!c||!userId)return false;
      await refreshUnread();
      if(channel)return true;
      channel=c.channel(`approval-notifications:${userId}`)
        .on('postgres_changes',{event:'INSERT',schema:'public',table:'account_notifications',filter:`user_id=eq.${userId}`},payload=>{
          const row=payload?.new||{};
          if(row.topic!=='approval_request')return;
          emitUnread(unread+1);
          const requestType=String(row?.data?.request_type||'contenido');
          toast(`ApprovalRequest: nueva solicitud de ${requestType}`);
          dispatch('kelo:approval-request-notification',{notification:row});
        })
        .subscribe(status=>{
          if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')console.warn('[ApprovalRequest realtime]',status);
        });
      return true;
    })().catch(error=>{console.warn('[ApprovalRequest notifications]',error);return false;}).finally(()=>{starting=null;});
    return starting;
  }

  async function stopNotifications(){
    if(!channel)return;
    try{await client()?.removeChannel?.(channel);}catch(_){}
    channel=null;
  }

  const api=Object.freeze({version:VERSION,submit,list,detail,review,refreshUnread,markRead,startNotifications,stopNotifications,get unread(){return unread;}});
  root.KeloApprovalRequestRuntime=api;
  root.addEventListener('kelo:account-signed-out',()=>{void stopNotifications();emitUnread(0);});
  return api;
}
