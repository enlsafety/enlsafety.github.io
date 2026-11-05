-- Nullable positions keep the established layout until an administrator reorders it.
alter table private.enl_platform_catalog add column home_extras jsonb;
