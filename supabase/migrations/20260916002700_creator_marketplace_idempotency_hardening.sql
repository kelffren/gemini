begin;

create or replace function public.purchase_creator_market_listing(
  p_listing_id uuid,
  p_buyer_character_id uuid,
  p_correlation_id uuid
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_uid uuid := (select auth.uid()); v_listing public.creator_market_listings; v_pub public.content_publications;
  v_existing public.creator_market_transactions; v_tx public.creator_market_transactions; v_price bigint; v_payout bigint; v_fee bigint; v_treasury uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_correlation_id is null then raise exception 'CORRELATION_ID_REQUIRED'; end if;

  -- Serialize retries for the same purchase request before reading the idempotency record.
  perform pg_advisory_xact_lock(hashtextextended(p_correlation_id::text,0));

  select * into v_existing from public.creator_market_transactions where correlation_id=p_correlation_id;
  if v_existing.id is not null then
    if v_existing.buyer_user_id<>v_uid then raise exception 'CORRELATION_CONFLICT'; end if;
    return jsonb_build_object('ok',true,'idempotent',true,'transactionId',v_existing.id,'listingId',v_existing.listing_id,'revisionId',v_existing.revision_id,'priceKc',v_existing.price_kc,'creatorPayoutKc',v_existing.creator_payout_kc,'platformFeeKc',v_existing.platform_fee_kc,'licenseKey',v_existing.license_key);
  end if;

  if not exists(select 1 from public.characters c where c.id=p_buyer_character_id and c.account_id=v_uid and c.status='active') then raise exception 'BUYER_CHARACTER_NOT_OWNED'; end if;
  select * into v_listing from public.creator_market_listings where id=p_listing_id and status='active' for update;
  if v_listing.id is null then raise exception 'LISTING_NOT_FOUND'; end if;
  if v_listing.owner_user_id=v_uid then raise exception 'SELF_PURCHASE_FORBIDDEN'; end if;
  if not exists(select 1 from public.characters c where c.id=v_listing.payout_character_id and c.account_id=v_listing.owner_user_id and c.status='active') then raise exception 'PAYOUT_CHARACTER_UNAVAILABLE'; end if;

  select * into v_pub from public.content_publications where id=v_listing.publication_id and revision_id=v_listing.revision_id and is_active=true;
  if v_pub.id is null then raise exception 'CONTENT_NOT_PUBLISHED'; end if;
  if exists(select 1 from public.creator_content_entitlements e where e.buyer_user_id=v_uid and e.revision_id=v_listing.revision_id) then raise exception 'ALREADY_OWNED'; end if;

  v_price:=v_listing.price_kc;
  v_payout:=floor((v_price::numeric*v_listing.seller_share_bps::numeric)/10000)::bigint;
  v_fee:=v_price-v_payout;
  select platform_treasury_character_id into v_treasury from public.creator_market_config where singleton=true;
  if v_fee>0 and v_treasury is null then raise exception 'PLATFORM_TREASURY_NOT_CONFIGURED'; end if;

  -- Individual ledger correlations are unique because buyer/seller/treasury can theoretically resolve to the same character.
  -- Marketplace-level idempotency is guarded by p_correlation_id + advisory lock + creator_market_transactions unique constraint.
  if v_price>0 then
    perform public.apply_wallet_delta(p_buyer_character_id,'kc',-v_price,'creator_market_purchase',gen_random_uuid(),jsonb_build_object('listingId',v_listing.id,'correlationId',p_correlation_id));
  end if;
  if v_payout>0 then
    perform public.apply_wallet_delta(v_listing.payout_character_id,'kc',v_payout,'creator_market_sale',gen_random_uuid(),jsonb_build_object('listingId',v_listing.id,'buyerUserId',v_uid,'correlationId',p_correlation_id));
  end if;
  if v_fee>0 then
    perform public.apply_wallet_delta(v_treasury,'kc',v_fee,'creator_market_platform_fee',gen_random_uuid(),jsonb_build_object('listingId',v_listing.id,'correlationId',p_correlation_id));
  end if;

  insert into public.creator_market_transactions(correlation_id,listing_id,publication_id,revision_id,buyer_user_id,buyer_character_id,seller_user_id,seller_character_id,price_kc,creator_payout_kc,platform_fee_kc,license_key)
  values(p_correlation_id,v_listing.id,v_listing.publication_id,v_listing.revision_id,v_uid,p_buyer_character_id,v_listing.owner_user_id,v_listing.payout_character_id,v_price,v_payout,v_fee,v_listing.license_key)
  returning * into v_tx;

  insert into public.creator_content_entitlements(buyer_user_id,revision_id,listing_id,transaction_id,license_key)
  values(v_uid,v_listing.revision_id,v_listing.id,v_tx.id,v_listing.license_key);

  insert into public.server_audit_events(actor_user_id,character_id,event_key,target_type,target_id,request_id,metadata)
  values(v_uid,p_buyer_character_id,'creator_market_purchase','creator_market_listing',v_listing.id::text,p_correlation_id::text,jsonb_build_object('revisionId',v_listing.revision_id,'priceKc',v_price,'creatorPayoutKc',v_payout,'platformFeeKc',v_fee));

  return jsonb_build_object('ok',true,'idempotent',false,'transactionId',v_tx.id,'listingId',v_listing.id,'revisionId',v_listing.revision_id,'priceKc',v_price,'creatorPayoutKc',v_payout,'platformFeeKc',v_fee,'licenseKey',v_listing.license_key);
end;
$$;

revoke all on function public.purchase_creator_market_listing(uuid,uuid,uuid) from public,anon;
grant execute on function public.purchase_creator_market_listing(uuid,uuid,uuid) to authenticated,service_role;

commit;
