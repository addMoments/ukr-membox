App Server
Go server using Gorilla Mux. Runs in dev mode (HTTP, configurable port) or live mode (go run . true for HTTPS :443 with Let's Encrypt). Config loaded from .env JSON. Auth routes: /auth/signup/email, /auth/signin/email, /auth/whoami (protected). Non-API routes redirect to React dev server.

Authorization
Token Structure: JWT with claims: role (auth/webanon), ui (user UID), exp (7-day expiry), ip (client IP for "auth" role, "-" for guests), and iat (issued timestamp).

Transport: Unified for both dev and live modes—clients send JWT via Authorization: Bearer header. On successful login/signup, the server returns the JWT in the X-Auth-Token response header for client to store (e.g., localStorage).

IP Validation: Only enforced for "auth" role tokens. Guest tokens (role "webanon") have IP set to "-" and skip IP validation.

Auth Functions:
- auth.AuthMiddleware - Unified middleware for all protected routes. Extracts token from Authorization header, validates JWT, and adds claims to request context.
- auth.Authorize(w, r, role, userUID) - Creates JWT for any role. For "auth" role, userUID is required and IP is captured. For "webanon" guests, userUID can be empty (auto-generated) and IP is skipped.

Database Server
PostgreSQL + PostgREST with SSL. PostgREST runs on 443 as webanon role, shares the same jwt-secret—clients pass JWT via Authorization: Bearer to assume auth role.

S3 Storage
Uses S3-compatible storage (MinIO/AWS) for file uploads. Files stored under /events/{eventPackedUID}/{uploadPackedUID}/{filename}. Upload flow uses presigned URLs for direct client-to-S3 uploads.

---

Frontend Integration Notes

Endpoints:
- Go Server (SERV_ROOT): http://127.0.0.1:8083 - Auth, protected routes
- PostgREST (DB_ROOT): Set in src/consts.ts - Direct table/RPC access

Go Server Routes (SERV_ROOT):

Auth Routes (/auth):
- POST /auth/signup/email - Email signup (no auth). Body: {email, password, confirmPassword, name, agreed}. Returns "goto:/events" on success. Token in X-Auth-Token header.
- POST /auth/signin/email - Email signin (no auth). Body: {email, password}. Returns "goto:/events" on success. Token in X-Auth-Token header.
- GET /auth/whoami - Returns user claims from JWT (protected)

API Routes (/api):
- POST /api/events/new - Create new event (protected). Body: {activationDate (unix ms), bannerImage, eventName, eventType, plan}. Creates mock purchase + event. Returns "goto:/events/{packedUID}".

Guest Routes (/api/guest):
- POST /api/guest/upload/{eventPackedUid}/{utype} - Get presigned URLs for file upload (protected, any role). Body: ["filename1.jpg", "filename2.png"]. Returns {filename: {upUrl, filePath}} for each file. Valid utypes: photo, video, voice.

Link Handler (/l):
- GET /l/{path} - Short link redirector. 
  - /l/q{packedUID} - QR code link, redirects to /guest/{packedUID}
  - /l/c{...} - Collaborator invitation (not implemented)

PostgREST Tables (DB_ROOT):
- /users - uid, name, mail, created_at, is_active
- /events - uid, name, description, welcome_message, event_type, image, admins (UUID[]), activation_date, active_until, purchase_uid, settings (JSONB)
- /events_public - Public view: uid, name, event_type, activation_date, active_until, description, welcome_message, image, settings
- /credentials - uid, user_uid, type (password/google), value
- /purchases - uid, provider_id, provider, purchase_type (free/silver/gold/bronze), buyer_uid
- /participants - uid, name, event_uid (unique per event)
- /uploads - uid, upload_type (photo/video/voice/text), client_uid, event_uid, value (S3 path), trashed_at
- /global_attributes - key/value store, is_public flag

PostgREST RPC Functions:
- GET/POST /rpc/current_user_uid - Returns current authenticated user's UID from JWT

Client Files (src/client/):
- core.ts: fetchWithCreds - adds Authorization: Bearer header from stored token
- auth.ts: signInEmail, signUpEmail, whoAmI (Go server), dbWhoAmI (PostgREST RPC)
- events.ts: getMyEvents

Auth Flow:
1. Client calls /auth/signin/email or /auth/signup/email
2. Server returns JWT in X-Auth-Token response header
3. Client stores token (e.g., localStorage)
4. Client sends token via Authorization: Bearer header on subsequent requests
5. Same flow for both dev and live environments

UUID Packing:
Server uses packed UUIDs in URLs (base64url encoded binary UUID) for shorter URLs. Utils provide PackUUID and UnpackUUID functions.

File Upload Flow:
1. Client calls POST /api/guest/upload/{eventPackedUid}/{utype} with array of filenames
2. Server returns presigned S3 URLs for each file
3. Client uploads directly to S3 using presigned URLs
4. Server creates upload records in database with S3 paths
