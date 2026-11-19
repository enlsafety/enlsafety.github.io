-- Extend board kinds without changing existing posts or access policies.
ALTER TABLE private.enl_hub_content DROP CONSTRAINT enl_hub_content_kind_check;
ALTER TABLE private.enl_hub_content ADD CONSTRAINT enl_hub_content_kind_check CHECK (kind IN ('notice','event','alert','news','resource','request'));
