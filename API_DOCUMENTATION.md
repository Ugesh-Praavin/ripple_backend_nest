# Ripple Backend API Documentation

## Overview

This NestJS backend handles civic issue reporting workflow using Firebase Authentication and Supabase database. All issue data is stored in the `reports` table.

**Base URL**: `http://localhost:3000` (or your deployed URL)

---

## Authentication

All protected endpoints require Firebase ID token in the Authorization header:

```
Authorization: Bearer <firebase_id_token>
```

The backend:
1. Verifies the Firebase ID token
2. Queries Supabase `public.users` table to get user role and block_id
3. Attaches user context to `req.user`:
   ```typescript
   {
     uid: string;
     email: string;
     role: "ADMIN" | "SUPERVISOR";
     block_id: string | null;
   }
   ```

---

## Admin Endpoints

### 1. Start a Report

**Endpoint**: `PATCH /admin/report/:id/start`

**Description**: Admin starts working on a report, changes status to "In Progress", and sets estimated resolution time.

**Authentication**: Required (ADMIN role)

**Path Parameters**:
- `id` (string, required): Report UUID

**Request Body**:
```json
{
  "estimated_time": "2 hours",
  "supervisor_id": "optional-supervisor-uuid"
}
```

**Request Body Fields**:
- `estimated_time` (string, required): Estimated time to resolve the report
- `supervisor_id` (string, optional): UUID of supervisor to assign

**Response** (200 OK):
```json
{
  "success": true,
  "report": {
    "id": "uuid",
    "user_id": "uuid",
    "title": "Pothole on Main Street",
    "description": "Large pothole near intersection",
    "location": "Main Street, Block 5",
    "coords": {"lat": 40.7128, "lng": -74.0060},
    "image_url": "https://...",
    "status": "In Progress",
    "estimated_resolution_time": "2 hours",
    "supervisor_id": "uuid",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

**Error Responses**:
- `400 Bad Request`: Report not found or already resolved
- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: User is not an ADMIN

**Example**:
```bash
curl -X PATCH http://localhost:3000/admin/report/123e4567-e89b-12d3-a456-426614174000/start \
  -H "Authorization: Bearer <firebase_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "estimated_time": "3 hours",
    "supervisor_id": "456e7890-e89b-12d3-a456-426614174001"
  }'
```

---

### 2. Get Current Admin User

**Endpoint**: `GET /admin/me`

**Description**: Returns the current authenticated admin user information.

**Authentication**: Required (ADMIN role)

**Response** (200 OK):
```json
{
  "uid": "firebase_uid",
  "email": "admin@example.com",
  "role": "ADMIN",
  "block_id": null
}
```

**Example**:
```bash
curl -X GET http://localhost:3000/admin/me \
  -H "Authorization: Bearer <firebase_token>"
```

---

## Supervisor Endpoints

### 1. Get Supervisor Reports

**Endpoint**: `GET /supervisor/reports`

**Description**: Returns all non-resolved reports that can be viewed by the supervisor.

**Authentication**: Required (SUPERVISOR role)

**Response** (200 OK):
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "title": "Broken Street Light",
    "description": "Street light not working",
    "location": "Oak Avenue, Block 3",
    "coords": {"lat": 40.7128, "lng": -74.0060},
    "image_url": "https://...",
    "status": "In Progress",
    "estimated_resolution_time": "2 hours",
    "supervisor_id": "uuid",
    "worker_name": null,
    "resolved_image_url": null,
    "resolved_class": null,
    "resolved_at": null,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
]
```

**Error Responses**:
- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: User is not a SUPERVISOR

**Example**:
```bash
curl -X GET http://localhost:3000/supervisor/reports \
  -H "Authorization: Bearer <firebase_token>"
```

---

### 2. Assign Worker to Report

**Endpoint**: `PATCH /supervisor/report/:id/assign-worker`

**Description**: Supervisor assigns a worker name to a report.

**Authentication**: Required (SUPERVISOR role)

**Path Parameters**:
- `id` (string, required): Report UUID

**Request Body**:
```json
{
  "worker_name": "John Doe"
}
```

**Request Body Fields**:
- `worker_name` (string, required): Name of the worker assigned to the report

**Response** (200 OK):
```json
{
  "success": true,
  "report": {
    "id": "uuid",
    "worker_name": "John Doe",
    "status": "In Progress",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

**Error Responses**:
- `400 Bad Request`: Report not found
- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: User is not a SUPERVISOR

**Example**:
```bash
curl -X PATCH http://localhost:3000/supervisor/report/123e4567-e89b-12d3-a456-426614174000/assign-worker \
  -H "Authorization: Bearer <firebase_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "worker_name": "John Doe"
  }'
```

---

### 3. Complete Report

**Endpoint**: `PATCH /supervisor/report/:id/complete`

**Description**: Supervisor marks work as completed by uploading a resolved image. This triggers ML verification if applicable.

**Authentication**: Required (SUPERVISOR role)

**Path Parameters**:
- `id` (string, required): Report UUID

**Request Body**:
```json
{
  "image_url": "https://supabase-storage-url/resolved-image.jpg"
}
```

**Request Body Fields**:
- `image_url` (string, required): URL of the resolved image (already uploaded to Supabase Storage)

**Response** (200 OK):

**If auto-resolved (ML confidence >= 70%)**:
```json
{
  "status": "Resolved",
  "report": {
    "id": "uuid",
    "status": "Resolved",
    "resolved_image_url": "https://...",
    "resolved_class": "pothole_fixed",
    "resolved_at": "2024-01-01T00:00:00Z"
  }
}
```

**If requires manual review (ML confidence < 70% or no ML)**:
```json
{
  "status": "Pending",
  "requires_manual_review": true
}
```

**ML Verification Logic**:
- ML verification runs automatically for these report types (detected from title/description):
  - Pothole
  - Broken Street Light
  - Garbage Overflow
  - Drainage Overflow
- If ML confidence >= 70%: Report is auto-resolved
- If ML confidence < 70%: Report marked for manual review (status stays "Pending")
- If report type doesn't require ML: Report is resolved immediately

**Error Responses**:
- `400 Bad Request`: Report not found or failed to update
- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: User is not a SUPERVISOR

**Example**:
```bash
curl -X PATCH http://localhost:3000/supervisor/report/123e4567-e89b-12d3-a456-426614174000/complete \
  -H "Authorization: Bearer <firebase_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "image_url": "https://supabase.co/storage/v1/object/public/resolved-images/report-123.jpg"
  }'
```

---

## Database Schema

### `reports` Table

Primary table for storing all civic issue reports.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | ID of user who created the report |
| `title` | TEXT | Report title |
| `description` | TEXT | Detailed description |
| `location` | TEXT | Human-readable location |
| `coords` | JSONB | Coordinates `{"lat": number, "lng": number}` |
| `image_url` | TEXT | URL of the reported issue image |
| `status` | TEXT | Status: `"Pending"`, `"In Progress"`, or `"Resolved"` |
| `estimated_resolution_time` | TEXT | Estimated time to resolve (set by admin) |
| `supervisor_id` | UUID | Assigned supervisor ID (optional) |
| `worker_name` | TEXT | Name of assigned worker (set by supervisor) |
| `resolved_image_url` | TEXT | URL of resolved image (uploaded by supervisor) |
| `resolved_class` | TEXT | ML predicted class (if ML verification used) |
| `resolved_at` | TIMESTAMPTZ | Timestamp when report was resolved |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

### `ml_verification` Table

Stores ML verification results for reports.

| Column | Type | Description |
|--------|------|-------------|
| `report_id` | UUID | Foreign key to `reports.id` |
| `predicted_class` | TEXT | ML predicted class |
| `confidence` | FLOAT | ML confidence score (0-1) |
| `verified` | BOOLEAN | Whether ML verification passed (>= 70%) |
| `verified_at` | TIMESTAMPTZ | Verification timestamp |

### `public.users` Table

Backend authentication/authorization table (separate from Flutter app users).

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `email` | TEXT | User email (matches Firebase) |
| `role` | TEXT | `"ADMIN"` or `"SUPERVISOR"` |
| `block_id` | UUID | Block assignment (for supervisors) |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

---

## Workflow Diagrams

### Admin Workflow

```
1. Admin receives report (status: "Pending")
2. Admin calls PATCH /admin/report/:id/start
   - Status → "In Progress"
   - Sets estimated_resolution_time
   - Optionally assigns supervisor_id
3. Report is ready for supervisor to work on
```

### Supervisor Workflow

```
1. Supervisor views reports: GET /supervisor/reports
2. Supervisor assigns worker: PATCH /supervisor/report/:id/assign-worker
3. Worker completes work
4. Supervisor uploads resolved image to Supabase Storage
5. Supervisor calls PATCH /supervisor/report/:id/complete
   - Saves resolved_image_url
   - Triggers ML verification (if applicable)
   - If ML confidence >= 70%: Auto-resolve
   - If ML confidence < 70%: Manual review needed
6. Report status → "Resolved" (or stays "Pending" for review)
```

### ML Verification Flow

```
1. Supervisor completes report with image
2. System checks if report type requires ML:
   - Pothole
   - Broken Street Light
   - Garbage Overflow
   - Drainage Overflow
3. If required:
   - Calls ML API: POST https://ripple-model-dfgk.onrender.com/predict
   - If confidence >= 70%: Auto-resolve
   - If confidence < 70%: Mark for manual review
   - Store result in ml_verification table
4. If not required:
   - Resolve immediately
```

---

## Error Codes

| Status Code | Description |
|-------------|-------------|
| `200 OK` | Request successful |
| `400 Bad Request` | Invalid request data or resource not found |
| `401 Unauthorized` | Missing or invalid authentication token |
| `403 Forbidden` | User doesn't have required role/permissions |
| `500 Internal Server Error` | Server error |

---

## Environment Variables

Required environment variables:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Firebase
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY=your-private-key
```

---

## ML API Integration

**ML API Endpoint**: `POST https://ripple-model-dfgk.onrender.com/predict`

**Request**: FormData with image file
**Response**:
```json
{
  "predicted_class": "pothole_fixed",
  "confidence": 0.85
}
```

**Supported Report Types for ML**:
- Pothole
- Broken Street Light
- Garbage Overflow
- Drainage Overflow

**Confidence Threshold**: 70% (0.7)

---

## Notes

1. **Flutter App Compatibility**: The Flutter app writes directly to the `reports` table. The backend only reads and updates existing reports.

2. **Status Values**: 
   - `"Pending"`: Initial state, waiting for admin action
   - `"In Progress"`: Admin has started working on it
   - `"Resolved"`: Work completed and verified

3. **Image Uploads**: Resolved images must be uploaded to Supabase Storage first. The `image_url` in the request should be the public URL from Supabase Storage.

4. **RLS**: Row Level Security (RLS) is assumed to be disabled for hackathon context. Adjust if needed for production.

5. **Block Assignment**: Supervisors can be assigned to specific blocks via `block_id` in the `public.users` table. Reports can be filtered by block if needed.

---

## Testing Examples

### Test Admin Start Report

```bash
# Replace with actual values
REPORT_ID="123e4567-e89b-12d3-a456-426614174000"
FIREBASE_TOKEN="your-firebase-id-token"

curl -X PATCH "http://localhost:3000/admin/report/${REPORT_ID}/start" \
  -H "Authorization: Bearer ${FIREBASE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "estimated_time": "2 hours"
  }'
```

### Test Supervisor Complete Report

```bash
REPORT_ID="123e4567-e89b-12d3-a456-426614174000"
FIREBASE_TOKEN="your-firebase-id-token"
IMAGE_URL="https://supabase.co/storage/v1/object/public/resolved-images/report-123.jpg"

curl -X PATCH "http://localhost:3000/supervisor/report/${REPORT_ID}/complete" \
  -H "Authorization: Bearer ${FIREBASE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"image_url\": \"${IMAGE_URL}\"
  }"
```

---

## Support

For issues or questions, refer to the codebase:
- `src/reports/reports.service.ts` - Business logic
- `src/admin/admin.controller.ts` - Admin endpoints
- `src/supervisor/supervisor.controller.ts` - Supervisor endpoints

