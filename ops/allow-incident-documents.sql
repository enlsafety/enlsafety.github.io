-- Permit the attachment service's download-only document format on the existing private bucket.
update storage.buckets
set allowed_mime_types=array_append(allowed_mime_types,'application/octet-stream')
where id='enl-incident-files' and not public and allowed_mime_types is not null
  and not ('application/octet-stream'=any(allowed_mime_types));
