alter table private.enl_org_charts add column review_event text
  check (review_event is null or (review_event='approve' and confirmed)
    or (review_event='reopen' and not confirmed));
