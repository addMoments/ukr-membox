TABLE User
name
mail
created_at
uid
is_active

TABLE Credentials
type google|password
value
user_uid
uid
created_at

TABLE Events
name
event_type
description
welcome_message
image
settings (JSONB)
admins (UUID[])
purchase_uid
created_at
activation_date
active_until
uid

VIEW events_public
uid
name
event_type
activation_date
active_until
description
welcome_message
image
settings

TABLE purchases
uid
provider
provider_id
purchase_type free|silver|gold|bronze
buyer_uid
created_at

Table uploads
uid
upload_type photo|video|text|voice
value (S3 path)
event_uid
client_uid
created_at
trashed_at

Table participants
uid 
event_uid
name
created_at
UNIQUE(name, event_uid)

Table global_attributes
uid
key
value
is_public
created_at
