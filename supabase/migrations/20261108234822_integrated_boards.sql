alter table private.enl_hub_content
  drop constraint enl_hub_content_kind_check,
  drop constraint enl_hub_content_check,
  add constraint enl_hub_content_kind_check check (kind in ('notice','event','alert','news','resource')),
  add constraint enl_hub_content_event_times check (kind <> 'event' or (starts_at is not null and ends_at is not null and ends_at >= starts_at));

-- Files are read only on download, and saved in the same transaction as the post.
create table private.enl_board_files (
  content_id uuid primary key references private.enl_hub_content(id),
  name text not null check (length(name) between 1 and 180),
  bytes bytea not null check (octet_length(bytes) between 1 and 5242880)
);
alter table private.enl_board_files enable row level security;
revoke all on private.enl_board_files from public, anon, authenticated;
create index enl_board_posts_active on private.enl_hub_content(kind,created_at desc,id desc) where archived_at is null;
