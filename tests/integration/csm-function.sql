CREATE OR REPLACE FUNCTION campbox_internal.apply_salary_client(p_id uuid, p_name text, p_active boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_camp_id uuid;
  v_matches integer;
  v_name_key text;
  v_linked_conflict integer;
begin
  if p_id is null or nullif(btrim(p_name), '') is null then
    return;
  end if;
  -- Normalize punctuation and spacing.
  v_name_key := regexp_replace(lower(p_name),'[^[:alnum:]]','','g');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('sales-csm:' || v_name_key));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('sales-csm-id:' || p_id::text));

  select id into v_camp_id from public.csm_camps
  where sales_client_id = p_id limit 1;

  if v_camp_id is null then
    -- Never steal another salary client's linked card.
    select count(*) into v_linked_conflict from public.csm_camps
    where sales_client_id is not null
      and regexp_replace(lower(name),'[^[:alnum:]]','','g') = v_name_key;
    if v_linked_conflict > 0 then
      insert into campbox_internal.csm_sales_sync_conflicts(sales_client_id,client_name,reason,detected_at)
      values(p_id,p_name,'Это название уже связано с другим Sales ID; требуется проверка',now())
      on conflict (sales_client_id) do update
      set client_name=excluded.client_name,reason=excluded.reason,detected_at=now();
      return;
    end if;

    select count(*) into v_matches from public.csm_camps
    where sales_client_id is null
      and regexp_replace(lower(name),'[^[:alnum:]]','','g') = v_name_key;
    if v_matches > 1 then
      insert into campbox_internal.csm_sales_sync_conflicts(sales_client_id,client_name,reason,detected_at)
      values(p_id,p_name,'Несколько существующих карточек КСМ с таким названием',now())
      on conflict (sales_client_id) do update
      set client_name=excluded.client_name,reason=excluded.reason,detected_at=now();
      return;
    end if;
    if v_matches = 1 then
      select id into v_camp_id from public.csm_camps
      where sales_client_id is null
        and regexp_replace(lower(name),'[^[:alnum:]]','','g') = v_name_key limit 1;
    end if;
  end if;

  if v_camp_id is null then
    -- No random manager or CSM assignment; queue is visible to CSM managers.
    insert into public.csm_camps(name,responsible_id,active,sales_client_id)
    values(btrim(p_name),null,coalesce(p_active,true),p_id);
  else
    -- Preserve responsible_id, CSM ID and all attached work.
    update public.csm_camps
    set name=btrim(p_name), active=coalesce(p_active,true),
        sales_client_id=p_id, updated_at=now()
    where id=v_camp_id;
  end if;
  delete from campbox_internal.csm_sales_sync_conflicts where sales_client_id=p_id;
end
$function$
